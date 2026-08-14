import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  ActivityType,
  PaymentMethodKind,
  type Prisma,
  TicketEmailType,
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
  sendCompTicketEmail,
  sendRefundEmail,
  sendTicketEmail,
} from "~/server/ticketing/email/send";
import {
  cancelPendingOrder,
  deleteTickets,
  issueTicketsForOrder,
  orderAccessToken,
  ticketAccessToken,
  voidTicket,
} from "~/server/ticketing/orders";
import {
  assignHandout,
  compAccounting,
  issueComp,
  reassignHandout,
} from "~/server/ticketing/comps";
import { InventoryError } from "~/server/ticketing/inventory";
import {
  MAX_PLUS_PER_LINK,
  MAX_PRIMARY_LINKS,
  deleteTicketLinkBatch,
  getTicketLinkBatch,
  issueTicketLinkBatch,
  listTicketLinkBatches,
} from "~/server/ticketing/ticket-link-batches";
import { ADMITTING_RESULTS, admissionStates } from "~/server/ticketing/scan";
import { logActivity } from "~/server/utils/activity-log";
import {
  ACCESS_LEVEL_VALUES,
  ticketTypeName,
} from "~/lib/ticketing/access-levels";
import { ticketUrl, ticketsUrl } from "~/server/ticketing/urls";
import { schedulePassUpdate } from "~/server/wallet/apple-push";

/**
 * The filters the admin lists offer, as Prisma fragments.
 *
 * Kept here rather than inlined into each query so "named" means the same thing
 * on the tickets tab as it does on the orders tab — the whole point of a filter
 * is that the answer matches the question you thought you asked.
 */
const TICKET_KINDS = ["SOLD", "COMP", "LINK"] as const;
const NAMED_STATES = ["NAMED", "UNNAMED"] as const;
const DOOR_STATES = ["ARRIVED", "NOT_ARRIVED"] as const;

/** A ticket has a name on it, or it doesn't. Empty strings are stored as null. */
function namedWhere(
  state: (typeof NAMED_STATES)[number],
): Prisma.TicketWhereInput {
  return state === "NAMED"
    ? { NOT: { attendeeName: null } }
    : { attendeeName: null };
}

/** Somebody came in on it, by the same results the door counts. */
function doorWhere(
  state: (typeof DOOR_STATES)[number],
): Prisma.TicketWhereInput {
  const scanned = { result: { in: [...ADMITTING_RESULTS] } };
  return state === "ARRIVED"
    ? { scans: { some: scanned } }
    : { scans: { none: scanned } };
}

/**
 * Where a ticket came from.
 *
 * A comp was minted, a link was issued as a bearer link out of a tier, and
 * everything else was sold — including free tiers, which are still a checkout.
 */
function kindWhere(
  kind: (typeof TICKET_KINDS)[number],
): Prisma.TicketWhereInput {
  if (kind === "COMP") return { isComp: true };
  if (kind === "LINK") return { linkBatchId: { not: null } };
  return { isComp: false, linkBatchId: null };
}

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
        paymentMethod: z
          .enum([
            PaymentMethodKind.STRIPE,
            PaymentMethodKind.CASH,
            PaymentMethodKind.TERMINAL,
            PaymentMethodKind.TAP_TO_PAY,
            PaymentMethodKind.COMP,
            PaymentMethodKind.FREE,
            PaymentMethodKind.ADMIN,
          ])
          .optional(),
        /**
         * Whether every live ticket on the order has a name yet. `MISSING` is
         * the chase-list: orders whose tickets nobody has claimed.
         */
        names: z.enum(["COMPLETE", "MISSING"]).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const search = input.search;
      const unnamedTicket = {
        attendeeName: null,
        status: TicketStatus.VALID,
      } satisfies Prisma.TicketWhereInput;

      const orders = await ctx.db.ticketOrder.findMany({
        where: {
          ...(input.eventId ? { eventId: input.eventId } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.paymentMethod
            ? { paymentMethod: input.paymentMethod }
            : {}),
          ...(input.names === "MISSING"
            ? { tickets: { some: unnamedTicket } }
            : input.names === "COMPLETE"
              ? { tickets: { none: unnamedTicket } }
              : {}),
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

  /** Individual tickets for an event — search, inspect, then void or refund. */
  tickets: adminProcedure
    .input(
      z.object({
        eventId: z.string(),
        search: z.string().trim().max(80).optional(),
        status: z
          .enum([TicketStatus.VALID, TicketStatus.VOID, TicketStatus.REFUNDED])
          .optional(),
        /** Sold, comped, or issued as a bearer link. */
        kind: z.enum(TICKET_KINDS).optional(),
        /** Whether anybody's name is on it — the "who is this for" question. */
        named: z.enum(NAMED_STATES).optional(),
        /** Whether it has been used to get in. */
        door: z.enum(DOOR_STATES).optional(),
        accessLevel: z.enum(ACCESS_LEVEL_VALUES).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const search = input.search;

      const tickets = await ctx.db.ticket.findMany({
        where: {
          eventId: input.eventId,
          ...(input.status ? { status: input.status } : {}),
          ...(input.kind ? kindWhere(input.kind) : {}),
          ...(input.named ? namedWhere(input.named) : {}),
          ...(input.door ? doorWhere(input.door) : {}),
          ...(input.accessLevel ? { accessLevel: input.accessLevel } : {}),
          ...(search
            ? {
                OR: [
                  { ticketNumber: { contains: search, mode: "insensitive" } },
                  { attendeeName: { contains: search, mode: "insensitive" } },
                  { attendeeEmail: { contains: search, mode: "insensitive" } },
                  {
                    order: {
                      orderNumber: { contains: search, mode: "insensitive" },
                    },
                  },
                  {
                    order: {
                      buyerName: { contains: search, mode: "insensitive" },
                    },
                  },
                  {
                    order: {
                      buyerEmail: { contains: search, mode: "insensitive" },
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          accessLevel: true,
          attendeeName: true,
          attendeeEmail: true,
          pricePaidCents: true,
          isComp: true,
          nameLockedAt: true,
          voidedAt: true,
          voidReason: true,
          createdAt: true,
          orderId: true,
          hostTicketId: true,
          // Half of the `/t/[token]` link built below. Nothing secret on its
          // own — the signature is what makes a token work — but the finished
          // URL is the only form anything downstream should be using.
          accessTokenVersion: true,
          // Deleting a comp grant takes the hand-outs with it, so the panel has
          // to be able to say how many that is before anyone confirms.
          _count: { select: { handouts: true } },
          tier: { select: { name: true } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              buyerName: true,
              buyerEmail: true,
              paymentMethod: true,
              totalCents: true,
              status: true,
            },
          },
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
      });

      const hasMore = tickets.length > input.limit;
      const page = hasMore ? tickets.slice(0, input.limit) : tickets;
      const states = await admissionStates(page.map((ticket) => ticket.id));

      return {
        tickets: page.map((ticket) => {
          const admission = states.get(ticket.id);
          return {
            ...ticket,
            typeName: ticketTypeName(ticket),
            // What you send somebody who has lost their email — one ticket,
            // their own QR, and no way through to the rest of the order.
            ticketUrl: ticketUrl(ticketAccessToken(ticket)),
            admittedAt: admission?.admittedAt ?? null,
            departedAt: admission?.departedAt ?? null,
            deniedAt: admission?.deniedAt ?? null,
          };
        }),
        nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
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
        schedulePassUpdate(ticket.id);
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
      schedulePassUpdate(input.ticketId);

      await logActivity({
        type: ActivityType.TICKET_VOIDED,
        action: `Voided a ticket — ${input.reason}`,
        userId: ctx.session.user.id,
        details: { ticketId: input.ticketId },
      });

      return { ok: true as const };
    }),

  /**
   * Delete tickets outright — the row, its scans, and its wallet registrations.
   *
   * Void is still the right answer for a ticket that was real: it keeps the
   * history, and the door can say why somebody was turned away. This is for
   * tickets that should never have existed, where the void row is only noise on
   * a list somebody has to read at a door. Nothing is refunded on the way — a
   * paid ticket is refunded first, and the panel says so.
   *
   * A comp grant goes as a grant: deleting the recipient's ticket takes the
   * plus-ones they were given to hand out with it.
   */
  deleteTickets: adminProcedure
    .input(
      z.object({
        ticketIds: z.array(z.string()).min(1).max(200),
        reason: z.string().trim().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteTickets(input.ticketIds);
      if (deleted.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Those tickets have already gone.",
        });
      }

      // Written after the fact on purpose: this is the only record the deleted
      // tickets leave behind, so it carries who they belonged to and what was
      // paid, not just how many there were.
      await logActivity({
        type: ActivityType.TICKET_DELETED,
        action: `Deleted ${deleted.length} ticket${
          deleted.length === 1 ? "" : "s"
        } — ${input.reason}`,
        userId: ctx.session.user.id,
        details: {
          reason: input.reason,
          eventId: deleted[0]?.eventId,
          tickets: deleted.map((ticket) => ({
            ticketNumber: ticket.ticketNumber,
            orderId: ticket.orderId,
            attendeeName: ticket.attendeeName,
            attendeeEmail: ticket.attendeeEmail,
            pricePaidCents: ticket.pricePaidCents,
            isComp: ticket.isComp,
            withGrant: ticket.viaHost,
          })),
        },
      });

      return {
        ok: true as const,
        deleted: deleted.length,
        /** Hand-outs that came along with a comp grant, so the UI can say so. */
        withGrant: deleted.filter((ticket) => ticket.viaHost).length,
      };
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

  // ------------------------------------------------------------------ comps

  /**
   * Give somebody a ticket, and any they need to hand out.
   *
   * An artist needs an AAA and, more often than not, a couple of GAs for
   * whoever they're bringing. All of it is minted here: the tickets belong to
   * no tier, so the level is chosen directly and an AAA can be given away at an
   * event that has never sold one.
   *
   * The recipient's own ticket carries their name and is locked at issue, which
   * is what makes passing it on pointless — it still turns up at the door in
   * their name. The hand-outs are separate tickets with their own links.
   */
  issueComp: adminProcedure
    .input(
      z.object({
        eventId: z.string(),
        recipientName: z.string().trim().min(1).max(120),
        recipientEmail: z.email().optional(),
        accessLevel: z.enum(ACCESS_LEVEL_VALUES),
        handouts: z
          .array(
            z.object({
              accessLevel: z.enum(ACCESS_LEVEL_VALUES),
              quantity: z.number().int().min(1).max(20),
            }),
          )
          .max(6)
          .default([]),
        notes: z.string().trim().max(500).optional(),
        sendEmail: z.boolean().default(true),
        /** Sent back after the admin has read and accepted an overage warning. */
        acknowledge: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const comp = await issueComp({
        eventId: input.eventId,
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
        accessLevel: input.accessLevel,
        handouts: input.handouts,
        notes: input.notes,
        acknowledge: input.acknowledge,
        issuedByUserId: ctx.session.user.id,
      });

      await logActivity({
        type: ActivityType.TICKET_COMPED,
        action: `Comped ${input.accessLevel} to ${input.recipientName}${
          comp.handoutCount > 0 ? ` +${comp.handoutCount} to hand out` : ""
        }`,
        userId: ctx.session.user.id,
        details: {
          eventId: input.eventId,
          orderId: comp.orderId,
          recipientEmail: input.recipientEmail,
          handoutCount: comp.handoutCount,
        },
      });

      // Their ticket only, never the ones they have to hand out.
      if (input.sendEmail && input.recipientEmail) {
        await sendCompTicketEmail({ ticketId: comp.hostTicketId });
      }

      return comp;
    }),

  /** The comp counts for an event, from the one place that computes them. */
  compAccounting: eventOrganiserProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => compAccounting(input.eventId, ctx.db)),

  /** Every comp grant for an event, newest first. */
  comps: adminProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      // A grant is a host ticket plus its hand-outs, so it is listed from the
      // host rather than from the order.
      //
      // Comps issued before this — drawn from a tier, sharing one order link —
      // are not `isComp` and so do not appear here. They are untouched and
      // still work; find them under Orders, filtered by the COMP method.
      const hosts = await ctx.db.ticket.findMany({
        where: {
          eventId: input.eventId,
          isComp: true,
          hostTicketId: null,
          status: TicketStatus.VALID,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          ticketNumber: true,
          accessLevel: true,
          attendeeName: true,
          attendeeEmail: true,
          accessTokenVersion: true,
          createdAt: true,
          tier: { select: { name: true } },
          // Whether the person it was given to actually turned up, so the list
          // can be filtered down to the ones still outside.
          scans: {
            where: { result: { in: [...ADMITTING_RESULTS] } },
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          },
          order: {
            select: { id: true, orderNumber: true, notes: true },
          },
          handouts: {
            where: { status: TicketStatus.VALID },
            orderBy: { ticketNumber: "asc" },
            select: {
              id: true,
              ticketNumber: true,
              accessLevel: true,
              attendeeName: true,
              attendeeEmail: true,
              sentAt: true,
              nameLockedAt: true,
              accessTokenVersion: true,
              tier: { select: { name: true } },
              scans: {
                where: { result: { in: [...ADMITTING_RESULTS] } },
                take: 1,
                orderBy: { createdAt: "asc" },
                select: { createdAt: true },
              },
            },
          },
        },
      });

      return hosts.map((host) => ({
        id: host.id,
        orderId: host.order.id,
        orderNumber: host.order.orderNumber,
        recipientName: host.attendeeName,
        recipientEmail: host.attendeeEmail,
        accessLevel: host.accessLevel,
        typeName: ticketTypeName(host),
        ticketNumber: host.ticketNumber,
        notes: host.order.notes,
        createdAt: host.createdAt,
        admittedAt: host.scans[0]?.createdAt ?? null,
        ticketUrl: ticketUrl(ticketAccessToken(host)),
        handouts: host.handouts.map((handout) => ({
          id: handout.id,
          ticketNumber: handout.ticketNumber,
          accessLevel: handout.accessLevel,
          typeName: ticketTypeName(handout),
          guestName: handout.attendeeName,
          guestEmail: handout.attendeeEmail,
          sentAt: handout.sentAt,
          admittedAt: handout.scans[0]?.createdAt ?? null,
          ticketUrl: ticketUrl(ticketAccessToken(handout)),
        })),
      }));
    }),

  /**
   * Put a hand-out in somebody's name on the recipient's behalf, and send it.
   *
   * The same call the artist makes from their own page — here for when they've
   * texted the office a name instead.
   */
  sendHandout: adminProcedure
    .input(
      z.object({
        ticketId: z.string(),
        guestName: z.string().trim().min(1).max(120),
        guestEmail: z.email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.ticket.findUnique({
        where: { id: input.ticketId },
        select: { id: true, hostTicketId: true, nameLockedAt: true },
      });
      if (!ticket?.hostTicketId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That isn't a ticket somebody has to hand out.",
        });
      }

      const assigned = await assignHandout({
        ticketId: input.ticketId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
      });

      if (input.guestEmail) {
        await sendCompTicketEmail({
          ticketId: input.ticketId,
          type: TicketEmailType.HANDOUT,
        });
      }

      await logActivity({
        type: ActivityType.TICKET_HANDOUT_SENT,
        action: `Sent a hand-out to ${input.guestName}`,
        userId: ctx.session.user.id,
        details: { ticketId: input.ticketId },
      });

      return assigned;
    }),

  /**
   * Take a hand-out back so it can go to somebody else. Kills the link already
   * sent, and is refused once the ticket has been used to get in.
   */
  reassignHandout: adminProcedure
    .input(z.object({ ticketId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await reassignHandout(input.ticketId);

      await logActivity({
        type: ActivityType.TICKET_HANDOUT_SENT,
        action: `Took back a hand-out for reassignment`,
        userId: ctx.session.user.id,
        details: { ticketId: input.ticketId },
      });

      return { ok: true as const };
    }),

  /** Re-send one comp ticket to the person it belongs to. */
  resendCompTicket: adminProcedure
    .input(
      z.object({
        ticketId: z.string(),
        overrideEmail: z.email().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await sendCompTicketEmail({
        ticketId: input.ticketId,
        type: TicketEmailType.RESEND,
        overrideEmail: input.overrideEmail,
      });
      if (!result.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Couldn't send that email.",
        });
      }
      return { ok: true as const };
    }),

  /**
   * Rename a ticket that whoever holds it can no longer change themselves.
   *
   * The escape hatch for a locked name — a typo on an artist's ticket, or a
   * correction after somebody has already walked in. Admin only, and logged,
   * because everywhere else the lock is the point.
   */
  setTicketName: adminProcedure
    .input(
      z.object({
        ticketId: z.string(),
        attendeeName: z.string().trim().max(120),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.ticket.update({
        where: { id: input.ticketId },
        data: {
          attendeeName: input.attendeeName || null,
          nameLockedAt: input.attendeeName ? new Date() : null,
        },
        select: { id: true, ticketNumber: true, eventId: true },
      });

      await logActivity({
        type: ActivityType.TICKET_ACCESS_CHANGED,
        action: `${ticket.ticketNumber} renamed to ${input.attendeeName || "nobody"}`,
        userId: ctx.session.user.id,
        details: { ticketId: ticket.id, eventId: ticket.eventId },
      });

      return { ok: true as const };
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

  // ----------------------------------------------------------- ticket links

  /**
   * Mint unnamed bearer links from a tier, optionally with plus tickets to
   * hand out. Consumes allocation and capacity — not a comp.
   */
  createTicketLinkBatch: adminProcedure
    .input(
      z.object({
        eventId: z.string(),
        tierId: z.string(),
        primaryCount: z.number().int().min(1).max(MAX_PRIMARY_LINKS),
        plusCount: z.number().int().min(0).max(MAX_PLUS_PER_LINK),
        label: z.string().trim().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const batch = await issueTicketLinkBatch({
          eventId: input.eventId,
          tierId: input.tierId,
          primaryCount: input.primaryCount,
          plusCount: input.plusCount,
          label: input.label,
          issuedByUserId: ctx.session.user.id,
        });

        await logActivity({
          type: ActivityType.TICKET_LINK_BATCH_CREATED,
          action: `Issued ${batch.primaryCount} ticket link${
            batch.primaryCount === 1 ? "" : "s"
          } from ${batch.tierName}${
            batch.plusCount > 0 ? ` (+${batch.plusCount} each)` : ""
          }`,
          userId: ctx.session.user.id,
          details: {
            eventId: input.eventId,
            batchId: batch.id,
            tierId: input.tierId,
            primaryCount: batch.primaryCount,
            plusCount: batch.plusCount,
          },
        });

        return batch;
      } catch (cause) {
        if (cause instanceof InventoryError) {
          throw new TRPCError({ code: "CONFLICT", message: cause.message });
        }
        throw cause;
      }
    }),

  /** Batches for an event, newest first. Links are loaded separately. */
  ticketLinkBatches: adminProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => listTicketLinkBatches(input.eventId)),

  /** Every primary bearer link in a batch. */
  ticketLinkBatch: adminProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ input }) => getTicketLinkBatch(input.batchId)),

  /**
   * Bin a whole batch: the links, every ticket behind them, and the order they
   * were issued through. For a list sent to the wrong people, or a run of links
   * generated by mistake — one act to undo one act.
   */
  deleteTicketLinkBatch: adminProcedure
    .input(
      z.object({
        batchId: z.string(),
        reason: z.string().trim().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await deleteTicketLinkBatch(input.batchId);

      await logActivity({
        type: ActivityType.TICKET_DELETED,
        action: `Deleted the ${
          result.label ?? result.tierName
        } link batch and its ${result.ticketsDeleted} ticket${
          result.ticketsDeleted === 1 ? "" : "s"
        } — ${input.reason}`,
        userId: ctx.session.user.id,
        details: {
          batchId: input.batchId,
          reason: input.reason,
          ticketsDeleted: result.ticketsDeleted,
          claimed: result.use.claimed,
          arrived: result.use.arrived,
        },
      });

      return { ok: true as const, ...result };
    }),
});
