import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  ActivityType,
  PaymentMethodKind,
  TicketOrderStatus,
  TicketStatus,
} from "~Prisma/client";
import {
  adminProcedure,
  createTRPCRouter,
  eventOrganiserProcedure,
} from "~/server/api/trpc";
import { getStripe, isStripeConfigured } from "~/server/stripe";
import {
  sendRefundEmail,
  sendTicketEmail,
} from "~/server/ticketing/email/send";
import {
  cancelPendingOrder,
  createPendingOrder,
  issueTicketsForOrder,
  orderAccessToken,
  voidTicket,
} from "~/server/ticketing/orders";
import { logActivity } from "~/server/utils/activity-log";
import { sellAtDoor } from "~/server/ticketing/box-office";
import { ACCESS_LEVEL_VALUES } from "~/lib/ticketing/access-levels";
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
  orders: eventOrganiserProcedure
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

  order: eventOrganiserProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.db.ticketOrder.findUnique({
        where: { id: input.id },
        include: {
          event: true,
          items: { include: { tier: { select: { name: true } } } },
          tickets: {
            select: {
              id: true,
              ticketNumber: true,
              status: true,
              accessLevel: true,
              attendeeName: true,
              attendeeEmail: true,
              pricePaidCents: true,
              voidedAt: true,
              voidReason: true,
              createdAt: true,
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
        ticketsUrl: ctx.isAdmin ? ticketsUrl(orderAccessToken(order)) : null,
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
          {
            idempotencyKey: `refund-${order.id}-${input.ticketIds.sort().join("-")}`,
          },
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
          ...(rest.buyerName !== undefined
            ? { buyerName: rest.buyerName }
            : {}),
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
      return sellAtDoor({
        eventId: input.eventId,
        lines: input.lines,
        paymentMethod: input.paymentMethod,
        buyerName: input.buyerName,
        buyerEmail: input.buyerEmail,
        attendeeNames: input.attendeeNames,
        notes: input.notes,
        sendEmail: input.sendEmail,
        soldByUserId: ctx.session.user.id,
      });
    }),

  // ------------------------------------------------------------------ comps

  /**
   * Give tickets away to somebody by name.
   *
   * An artist gets an AAA ticket and, more often than not, a couple of GA
   * ones for whoever they're bringing — so this takes a set of lines rather
   * than a quantity, and each line's tier decides what that ticket gets past.
   * It is one order, so the recipient gets one email with everything in it.
   *
   * Runs the same issuance path as a sale; a comp is a sale for nothing, not a
   * different kind of ticket.
   */
  issueComps: adminProcedure
    .input(
      z.object({
        eventId: z.string(),
        recipientName: z.string().trim().min(1).max(120),
        recipientEmail: z.email().optional(),
        lines: z
          .array(
            z.object({
              tierId: z.string(),
              quantity: z.number().int().min(1).max(20),
            }),
          )
          .min(1),
        notes: z.string().trim().max(500).optional(),
        sendEmail: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sale = await sellAtDoor({
        eventId: input.eventId,
        lines: input.lines,
        paymentMethod: PaymentMethodKind.COMP,
        buyerName: input.recipientName,
        buyerEmail: input.recipientEmail,
        // The first ticket is the person being comped; the rest are guests
        // they'll hand out themselves, so only that one gets a name.
        attendeeNames: [input.recipientName],
        notes: input.notes,
        sendEmail: input.sendEmail,
        soldByUserId: ctx.session.user.id,
      });

      await logActivity({
        type: ActivityType.TICKET_COMPED,
        action: `Comped ${sale.ticketCount} ticket(s) to ${input.recipientName}`,
        userId: ctx.session.user.id,
        details: {
          eventId: input.eventId,
          orderId: sale.orderId,
          recipientEmail: input.recipientEmail,
        },
      });

      return sale;
    }),

  /** Every comp issued for an event, newest first. */
  comps: adminProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orders = await ctx.db.ticketOrder.findMany({
        where: {
          eventId: input.eventId,
          paymentMethod: PaymentMethodKind.COMP,
          status: TicketOrderStatus.PAID,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          buyerName: true,
          buyerEmail: true,
          notes: true,
          createdAt: true,
          accessTokenVersion: true,
          tickets: {
            where: { status: TicketStatus.VALID },
            orderBy: { ticketNumber: "asc" },
            select: {
              id: true,
              ticketNumber: true,
              accessLevel: true,
              attendeeName: true,
              tier: { select: { name: true } },
            },
          },
        },
      });

      return orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        recipientName: order.buyerName,
        recipientEmail: order.buyerEmail,
        notes: order.notes,
        createdAt: order.createdAt,
        ticketsUrl: ticketsUrl(orderAccessToken(order)),
        tickets: order.tickets.map((ticket) => ({
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          accessLevel: ticket.accessLevel,
          attendeeName: ticket.attendeeName,
          tierName: ticket.tier.name,
        })),
      }));
    }),

  /**
   * Change what one ticket gets past, without touching the tier it came from
   * or reissuing anything. The QR is unchanged — the door reads the level at
   * scan time, so an upgrade takes effect on the next scan.
   */
  setTicketAccessLevel: adminProcedure
    .input(
      z.object({
        ticketId: z.string(),
        accessLevel: z.enum(ACCESS_LEVEL_VALUES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.ticket.update({
        where: { id: input.ticketId },
        data: { accessLevel: input.accessLevel },
        select: { id: true, ticketNumber: true, eventId: true },
      });

      await logActivity({
        type: ActivityType.TICKET_ACCESS_CHANGED,
        action: `${ticket.ticketNumber} set to ${input.accessLevel}`,
        userId: ctx.session.user.id,
        details: { ticketId: ticket.id, eventId: ticket.eventId },
      });

      return { ok: true as const };
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
