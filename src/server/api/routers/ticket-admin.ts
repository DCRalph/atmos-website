import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  ActivityType,
  PaymentMethodKind,
  TicketOrderStatus,
  TicketStatus,
} from "~Prisma/client";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { getStripe, isStripeConfigured } from "~/server/stripe";
import { sendRefundEmail, sendTicketEmail } from "~/server/ticketing/email/send";
import {
  cancelPendingOrder,
  createPendingOrder,
  issueTicketsForOrder,
  orderAccessToken,
  voidTicket,
} from "~/server/ticketing/orders";
import { logActivity } from "~/server/utils/activity-log";
import { ticketsUrl } from "~/server/ticketing/urls";
import { pushPassUpdate } from "~/server/wallet/apple-push";

/**
 * Admin operations on orders and tickets: the box office, refunds, resends,
 * voids, and the approval queue for guest-list tiers.
 */

/**
 * A ticket's share of the order — its face value plus an even split of the
 * booking fee. Refunding face value only would quietly keep the fee on a
 * ticket the buyer never got to use.
 */
function refundableCentsForTicket(
  ticket: { pricePaidCents: number },
  order: { bookingFeeCents: number; tickets: unknown[] },
): number {
  const perTicketFee =
    order.tickets.length > 0
      ? Math.round(order.bookingFeeCents / order.tickets.length)
      : 0;
  return ticket.pricePaidCents + perTicketFee;
}

export const ticketAdminRouter = createTRPCRouter({
  orders: adminProcedure
    .input(
      z.object({
        eventId: z.string().optional(),
        status: z
          .enum([
            TicketOrderStatus.PENDING,
            TicketOrderStatus.PAID,
            TicketOrderStatus.FAILED,
            TicketOrderStatus.EXPIRED,
            TicketOrderStatus.CANCELLED,
            TicketOrderStatus.REFUNDED,
            TicketOrderStatus.PARTIALLY_REFUNDED,
            TicketOrderStatus.AWAITING_APPROVAL,
          ])
          .optional(),
        search: z.string().trim().max(80).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const search = input.search;

      const orders = await ctx.db.ticketOrder.findMany({
        where: {
          ...(input.eventId ? { eventId: input.eventId } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(search
            ? {
                OR: [
                  { orderNumber: { contains: search, mode: "insensitive" } },
                  { buyerEmail: { contains: search, mode: "insensitive" } },
                  { buyerName: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          event: { select: { id: true, name: true, slug: true } },
          _count: { select: { tickets: true } },
        },
      });

      const hasMore = orders.length > input.limit;
      const page = hasMore ? orders.slice(0, input.limit) : orders;

      return {
        orders: page,
        nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
      };
    }),

  order: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.db.ticketOrder.findUnique({
        where: { id: input.id },
        include: {
          event: true,
          items: { include: { tier: { select: { name: true } } } },
          tickets: {
            include: {
              tier: { select: { name: true } },
              scans: {
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                  id: true,
                  result: true,
                  createdAt: true,
                  deviceLabel: true,
                },
              },
            },
            orderBy: { ticketNumber: "asc" },
          },
          emails: { orderBy: { createdAt: "desc" }, take: 20 },
          redemptions: { include: { code: { select: { code: true } } } },
        },
      });

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      return {
        ...order,
        ticketsUrl: ticketsUrl(orderAccessToken(order)),
      };
    }),

  /**
   * Refund tickets through Stripe and kill their QR codes immediately, rather
   * than waiting for the webhook — a refunded ticket must stop working at the
   * door the moment the refund is issued.
   */
  refundTickets: adminProcedure
    .input(
      z.object({
        orderId: z.string(),
        ticketIds: z.array(z.string()).min(1),
        /** Overrides the computed amount, for partial or goodwill refunds. */
        amountCentsOverride: z.number().int().min(0).optional(),
        reason: z.string().trim().max(200).default("Refunded by admin"),
        notifyBuyer: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.ticketOrder.findUnique({
        where: { id: input.orderId },
        include: { tickets: { select: { id: true, pricePaidCents: true } } },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      const targets = order.tickets.filter((ticket) =>
        input.ticketIds.includes(ticket.id),
      );
      if (targets.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "None of those tickets belong to this order.",
        });
      }

      const computed = targets.reduce(
        (sum, ticket) => sum + refundableCentsForTicket(ticket, order),
        0,
      );
      const amountCents = input.amountCentsOverride ?? computed;

      const alreadyRefunded = order.refundedCents;
      if (alreadyRefunded + amountCents > order.totalCents) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `That would refund more than the ${(order.totalCents / 100).toFixed(2)} paid.`,
        });
      }

      // A card refund only applies to money that actually went through Stripe.
      if (
        amountCents > 0 &&
        order.paymentMethod === PaymentMethodKind.STRIPE &&
        order.stripePaymentIntentId
      ) {
        if (!isStripeConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Stripe isn't configured, so this can't be refunded here.",
          });
        }
        await getStripe().refunds.create(
          {
            payment_intent: order.stripePaymentIntentId,
            amount: amountCents,
            metadata: { orderId: order.id, reason: input.reason },
          },
          { idempotencyKey: `refund-${order.id}-${input.ticketIds.sort().join("-")}` },
        );
      }

      for (const ticket of targets) {
        await voidTicket({
          ticketId: ticket.id,
          reason: input.reason,
          status: TicketStatus.REFUNDED,
        });
        // Kill the pass in their wallet too, not just the QR on our side.
        void pushPassUpdate(ticket.id).catch(() => undefined);
      }

      const remainingValid = await ctx.db.ticket.count({
        where: { orderId: order.id, status: TicketStatus.VALID },
      });

      const updated = await ctx.db.ticketOrder.update({
        where: { id: order.id },
        data: {
          refundedCents: { increment: amountCents },
          refundedAt: new Date(),
          status:
            remainingValid === 0
              ? TicketOrderStatus.REFUNDED
              : TicketOrderStatus.PARTIALLY_REFUNDED,
        },
      });

      await logActivity({
        type: ActivityType.TICKET_ORDER_REFUNDED,
        action: `Refunded ${targets.length} ticket(s) on ${order.orderNumber}`,
        userId: ctx.session.user.id,
        details: { orderId: order.id, amountCents, reason: input.reason },
      });

      if (input.notifyBuyer && order.buyerEmail) {
        const ticketNumbers = await ctx.db.ticket.findMany({
          where: { id: { in: targets.map((t) => t.id) } },
          select: { ticketNumber: true },
        });
        await sendRefundEmail({
          orderId: order.id,
          amountCents,
          ticketNumbers: ticketNumbers.map((t) => t.ticketNumber),
        });
      }

      return { ok: true as const, refundedCents: updated.refundedCents };
    }),

  /** Cancel a ticket without refunding — comps, duplicates, fraud. */
  voidTicket: adminProcedure
    .input(
      z.object({
        ticketId: z.string(),
        reason: z.string().trim().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await voidTicket({ ticketId: input.ticketId, reason: input.reason });
      void pushPassUpdate(input.ticketId).catch(() => undefined);

      await logActivity({
        type: ActivityType.TICKET_VOIDED,
        action: `Voided a ticket — ${input.reason}`,
        userId: ctx.session.user.id,
        details: { ticketId: input.ticketId },
      });

      return { ok: true as const };
    }),

  resendTickets: adminProcedure
    .input(
      z.object({
        orderId: z.string(),
        overrideEmail: z.email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await sendTicketEmail({
        orderId: input.orderId,
        type: "RESEND",
        overrideEmail: input.overrideEmail,
      });

      if (!result.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Couldn't send that email.",
        });
      }

      await logActivity({
        type: ActivityType.TICKET_RESENT,
        action: `Resent tickets for order`,
        userId: ctx.session.user.id,
        details: { orderId: input.orderId, to: input.overrideEmail },
      });

      return { ok: true as const };
    }),

  /** Change the buyer's email — the single most common support request. */
  updateBuyer: adminProcedure
    .input(
      z.object({
        orderId: z.string(),
        buyerEmail: z.email().optional(),
        buyerName: z.string().trim().max(120).optional(),
        buyerPhone: z.string().trim().max(40).optional(),
        notes: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { orderId, ...rest } = input;
      const order = await ctx.db.ticketOrder.update({
        where: { id: orderId },
        data: {
          ...(rest.buyerEmail !== undefined
            ? { buyerEmail: rest.buyerEmail.toLowerCase().trim() }
            : {}),
          ...(rest.buyerName !== undefined ? { buyerName: rest.buyerName } : {}),
          ...(rest.buyerPhone !== undefined
            ? { buyerPhone: rest.buyerPhone }
            : {}),
          ...(rest.notes !== undefined ? { notes: rest.notes } : {}),
        },
      });
      return order;
    }),

  /**
   * Revoke the buyer's ticket link and issue a fresh one. For when a link has
   * been forwarded around and needs to stop working.
   */
  rotateAccessLink: adminProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.ticketOrder.update({
        where: { id: input.orderId },
        data: { accessTokenVersion: { increment: 1 } },
      });
      return { ticketsUrl: ticketsUrl(orderAccessToken(order)) };
    }),

  // ------------------------------------------------------------ box office

  /**
   * Sell or comp a ticket at the door. Runs through the same inventory and
   * issuance path as an online sale, so stock, scanning and analytics all stay
   * consistent — the only difference is where the money came from.
   */
  boxOfficeSale: adminProcedure
    .input(
      z.object({
        eventId: z.string(),
        lines: z
          .array(
            z.object({
              tierId: z.string(),
              quantity: z.number().int().min(1).max(20),
            }),
          )
          .min(1),
        paymentMethod: z.enum([
          PaymentMethodKind.CASH,
          PaymentMethodKind.TERMINAL,
          PaymentMethodKind.COMP,
        ]),
        buyerName: z.string().trim().max(120).optional(),
        buyerEmail: z.email().optional(),
        attendeeNames: z.array(z.string().trim().max(120)).default([]),
        notes: z.string().trim().max(500).optional(),
        sendEmail: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await createPendingOrder({
        eventId: input.eventId,
        lines: input.lines,
        ipAddress: null,
      });

      // A comp is free regardless of what the tier costs.
      if (input.paymentMethod === PaymentMethodKind.COMP) {
        await ctx.db.ticketOrder.update({
          where: { id: order.orderId },
          data: {
            subtotalCents: 0,
            discountCents: 0,
            bookingFeeCents: 0,
            totalCents: 0,
            gstCents: 0,
          },
        });
      }

      const issued = await issueTicketsForOrder({
        orderId: order.orderId,
        buyerEmail: input.buyerEmail ?? null,
        buyerName: input.buyerName ?? null,
        paymentMethod: input.paymentMethod,
        soldByUserId: ctx.session.user.id,
        termsAccepted: true,
      });

      if (input.notes) {
        await ctx.db.ticketOrder.update({
          where: { id: order.orderId },
          data: { notes: input.notes },
        });
      }

      if (input.attendeeNames.length > 0) {
        const tickets = await ctx.db.ticket.findMany({
          where: { orderId: order.orderId },
          orderBy: { ticketNumber: "asc" },
          select: { id: true },
        });
        await ctx.db.$transaction(
          tickets
            .map((ticket, index) => ({ ticket, name: input.attendeeNames[index] }))
            .filter((entry) => Boolean(entry.name))
            .map((entry) =>
              ctx.db.ticket.update({
                where: { id: entry.ticket.id },
                data: { attendeeName: entry.name },
              }),
            ),
        );
      }

      await logActivity({
        type: ActivityType.BOX_OFFICE_SALE,
        action: `Box office ${input.paymentMethod.toLowerCase()} sale — ${issued.ticketIds.length} ticket(s)`,
        userId: ctx.session.user.id,
        details: {
          orderId: order.orderId,
          eventId: input.eventId,
          paymentMethod: input.paymentMethod,
        },
      });

      if (input.sendEmail && input.buyerEmail) {
        await sendTicketEmail({ orderId: order.orderId });
      }

      const saved = await ctx.db.ticketOrder.findUniqueOrThrow({
        where: { id: order.orderId },
        select: { id: true, orderNumber: true, accessTokenVersion: true },
      });

      return {
        orderId: saved.id,
        orderNumber: saved.orderNumber,
        ticketCount: issued.ticketIds.length,
        ticketsUrl: ticketsUrl(orderAccessToken(saved)),
      };
    }),

  // -------------------------------------------------------- approval queue

  pendingApprovals: adminProcedure
    .input(z.object({ eventId: z.string().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      return ctx.db.ticketOrder.findMany({
        where: {
          status: TicketOrderStatus.AWAITING_APPROVAL,
          ...(input.eventId ? { eventId: input.eventId } : {}),
        },
        orderBy: { createdAt: "asc" },
        include: {
          event: { select: { id: true, name: true } },
          items: { include: { tier: { select: { name: true } } } },
        },
      });
    }),

  decideApproval: adminProcedure
    .input(
      z.object({
        orderId: z.string(),
        approve: z.boolean(),
        reason: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.ticketOrder.findUnique({
        where: { id: input.orderId },
        select: { id: true, status: true, buyerEmail: true, orderNumber: true },
      });
      if (order?.status !== TicketOrderStatus.AWAITING_APPROVAL) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That request is no longer awaiting approval.",
        });
      }

      if (!input.approve) {
        // Puts the held allocation back on sale as well as closing the request.
        await cancelPendingOrder(order.id, TicketOrderStatus.CANCELLED);

        await logActivity({
          type: ActivityType.TICKET_EVENT_UPDATED,
          action: `Declined guest list request ${order.orderNumber}`,
          userId: ctx.session.user.id,
          details: { orderId: order.id, reason: input.reason },
        });

        return { ok: true as const, approved: false };
      }

      await issueTicketsForOrder({ orderId: order.id });
      await sendTicketEmail({ orderId: order.id });

      await logActivity({
        type: ActivityType.TICKET_ISSUED,
        action: `Approved guest list request ${order.orderNumber}`,
        userId: ctx.session.user.id,
        details: { orderId: order.id },
      });

      return { ok: true as const, approved: true };
    }),
});
