import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ActivityType } from "~Prisma/client";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { defaultOfferExpiry } from "~/lib/ticketing/refund-offers";
import { enforceRateLimit } from "~/server/ticketing/rate-limit";
import {
  OPEN_OFFER,
  createOffers,
  loadOffer,
  offerTargetWhere,
  previewOffer,
  resendOffer,
  sendOfferCode,
  sendTestOffer,
  takeOffer,
} from "~/server/ticketing/refund-offers";
import { logActivity } from "~/server/utils/activity-log";

/**
 * Refund offers. Admins offer, from one order or across an event; buyers
 * take one from the link in its email (`/refund/<token>`). Offering, testing,
 * withdrawing and resending all email a buyer or change what they can do,
 * so Will GPT asks before any of them.
 */

/** One order, or every paid order with a ticket on these tiers. */
const target = z.union([
  z.object({ orderId: z.string() }),
  z.object({ eventId: z.string(), tierIds: z.array(z.string()).min(1) }),
]);

const offerInput = z.object({
  target,
  amount: z.enum(["everything", "ticketsOnly"]),
  message: z.string().trim().min(1).max(2000),
  expiresAt: z.date(),
});

const token = z.object({ token: z.string().min(10).max(200) });

/** The caller's address, for rate limits on the public steps. */
function ipOf(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export const refundOffersRouter = createTRPCRouter({
  /** How many orders an offer would reach, and what it could cost at most. */
  preview: adminProcedure
    .input(z.object({ target }))
    .query(({ input }) => previewOffer(offerTargetWhere(input.target))),

  /**
   * What the event dialog needs: its tiers with how many orders each could
   * be offered, how earlier offers went, and a default closing date (a day
   * before the event starts).
   */
  forEvent: adminProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.ticketEvent.findUnique({
        where: { id: input.eventId },
        select: {
          startsAt: true,
          tiers: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true },
          },
        },
      });
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });

      const tiers = await Promise.all(
        event.tiers.map(async (tier) => ({
          ...tier,
          orders: await ctx.db.ticketOrder.count({
            where: offerTargetWhere({
              eventId: input.eventId,
              tierIds: [tier.id],
            }),
          }),
        })),
      );
      const offers = await ctx.db.refundOffer.findMany({
        where: { order: { eventId: input.eventId } },
        select: {
          amountCents: true,
          claimedAt: true,
          withdrawnAt: true,
          expiresAt: true,
        },
      });
      const now = new Date();
      return {
        tiers,
        defaultExpiresAt: defaultOfferExpiry(event.startsAt),
        offered: offers.length,
        open: offers.filter(
          (o) => !o.claimedAt && !o.withdrawnAt && o.expiresAt > now,
        ).length,
        taken: offers.filter((o) => o.claimedAt).length,
      };
    }),

  /** The default closing date for one order's offer. */
  defaultExpiry: adminProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.db.ticketOrder.findUnique({
        where: { id: input.orderId },
        select: { event: { select: { startsAt: true } } },
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      return defaultOfferExpiry(order.event.startsAt);
    }),

  /** Offer, and email every buyer it reaches. */
  offer: adminProcedure.input(offerInput).mutation(async ({ ctx, input }) => {
    if (input.expiresAt.getTime() < Date.now() + 60 * 60_000) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Leave it open for at least an hour.",
      });
    }
    const result = await createOffers({
      where: offerTargetWhere(input.target),
      amount: input.amount,
      message: input.message,
      expiresAt: input.expiresAt,
      admin: { id: ctx.session.user.id, name: ctx.session.user.name },
    });
    if (!result.offered) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "There is nothing to offer a refund on here.",
      });
    }
    return result;
  }),

  /** One copy of the email to the signed-in admin, as the first buyer it
   * would reach would see it. */
  sendTest: adminProcedure
    .input(offerInput)
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.ticketOrder.findFirst({
        where: offerTargetWhere(input.target),
        select: { id: true },
      });
      if (!order) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There is nothing to offer a refund on here.",
        });
      }
      const result = await sendTestOffer({
        orderId: order.id,
        amount: input.amount,
        message: input.message,
        expiresAt: input.expiresAt,
        admin: { name: ctx.session.user.name, email: ctx.session.user.email },
      });
      if (!result.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "The test did not send.",
        });
      }
      return { to: ctx.session.user.email };
    }),

  /** Close an open offer. Its link stops working at once. */
  withdraw: adminProcedure
    .input(z.object({ offerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.refundOffer.updateMany({
        where: { id: input.offerId, ...OPEN_OFFER() },
        data: { withdrawnAt: new Date() },
      });
      if (!count) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That offer has already been taken or has closed.",
        });
      }
      await logActivity({
        type: ActivityType.REFUND_OFFER_WITHDRAWN,
        action: "Withdrew a refund offer",
        userId: ctx.session.user.id,
        details: { offerId: input.offerId },
      });
      return { ok: true };
    }),

  /** Email an open offer to its buyer again. */
  resend: adminProcedure
    .input(z.object({ offerId: z.string() }))
    .mutation(({ input }) => resendOffer(input.offerId)),

  /** What the refund page shows. Null for a link that is not ours. */
  get: publicProcedure
    .input(token)
    .query(({ input }) => loadOffer(input.token)),

  /** Email a code to the order's address. */
  sendCode: publicProcedure.input(token).mutation(async ({ ctx, input }) => {
    await enforceRateLimit({
      key: `refund-code:${ipOf(ctx.headers)}`,
      limit: 10,
      windowSeconds: 900,
      message: "Too many codes. Give it a few minutes.",
    });
    await enforceRateLimit({
      key: `refund-code:${input.token}`,
      limit: 5,
      windowSeconds: 3600,
      message: "Too many codes for this refund. Try again in an hour.",
    });
    return sendOfferCode(input.token);
  }),

  /** Check the code and refund. */
  take: publicProcedure
    .input(
      token.extend({
        code: z
          .string()
          .trim()
          .regex(/^\d{6}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit({
        key: `refund-take:${ipOf(ctx.headers)}`,
        limit: 20,
        windowSeconds: 900,
      });
      return takeOffer(input.token, input.code);
    }),
});
