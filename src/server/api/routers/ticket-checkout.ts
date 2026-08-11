import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { PaymentMethodKind, TicketOrderStatus } from "~Prisma/client";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import { getStripe, isStripeConfigured } from "~/server/stripe";
import { computeOrderTotals } from "~/lib/ticketing/money";
import { applyDiscountCode } from "~/server/ticketing/discounts";
import { InventoryError } from "~/server/ticketing/inventory";
import {
  cancelPendingOrder,
  createPendingOrder,
  findOrderByAccessToken,
  issueTicketsForOrder,
  syncMarketingConsent,
} from "~/server/ticketing/orders";
import { sendTicketEmail } from "~/server/ticketing/email/send";
import { enforceRateLimit } from "~/server/ticketing/rate-limit";
import {
  getTicketingSettings,
  resolveBookingFee,
} from "~/server/ticketing/settings";
import { db } from "~/server/db";

/**
 * Public checkout.
 *
 * Nobody is asked who they are until they have a ticket. `quote` prices a
 * basket from tier ids alone, `start` takes the money, `claimFree` hands over a
 * free ticket on a tick-box — and the buyer's name and email are collected
 * afterwards, on `/tickets/[token]/details`.
 *
 * Two tier settings can't work that way round and still keep their promise, so
 * they alone are asked up front: `requiresApproval` (there is no ticket yet,
 * and an approval nobody can be told about is useless) and `maxPerEmail` (a cap
 * you check after issuing is not a cap). `start` reports that as
 * `needsDetailsUpFront` so the client knows which form to show.
 */

const linesSchema = z
  .array(
    z.object({
      tierId: z.string().min(1),
      quantity: z.number().int().min(0).max(50),
    }),
  )
  .min(1);

function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

function inventoryErrorToTrpc(cause: unknown): never {
  if (cause instanceof InventoryError) {
    throw new TRPCError({ code: "CONFLICT", message: cause.message });
  }
  throw cause;
}

export const ticketCheckoutRouter = createTRPCRouter({
  /**
   * Price a basket without reserving anything. Drives the live total in the
   * buy panel, including the booking fee, which NZ rules require us to show
   * before the buyer commits rather than at the last step.
   */
  quote: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        lines: linesSchema,
        discountCode: z.string().trim().max(64).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const lines = input.lines.filter((line) => line.quantity > 0);
      if (lines.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose at least one ticket.",
        });
      }

      if (input.discountCode) {
        await enforceRateLimit({
          key: `discount:${clientIp(ctx.headers)}`,
          limit: 20,
          windowSeconds: 300,
          message: "Too many code attempts. Wait a few minutes and try again.",
        });
      }

      const event = await ctx.db.ticketEvent.findUnique({
        where: { id: input.eventId },
        select: {
          id: true,
          gstRateBp: true,
          bookingFeeFixedCents: true,
          bookingFeePercentBp: true,
        },
      });
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      const tiers = await ctx.db.ticketTier.findMany({
        where: { eventId: event.id, id: { in: lines.map((l) => l.tierId) } },
        select: { id: true, priceCents: true, name: true },
      });
      const priceByTier = new Map(tiers.map((t) => [t.id, t.priceCents]));

      const pricedLines = lines.map((line) => ({
        ...line,
        unitPriceCents: priceByTier.get(line.tierId) ?? 0,
      }));

      let discount: Awaited<ReturnType<typeof applyDiscountCode>> | null = null;
      let discountError: string | null = null;
      if (input.discountCode) {
        try {
          discount = await applyDiscountCode(ctx.db, {
            code: input.discountCode,
            eventId: event.id,
            lines: pricedLines,
          });
        } catch (cause) {
          // A bad code should grey out the discount line, not blow up the
          // whole quote and leave the buyer staring at an error page.
          discountError =
            cause instanceof TRPCError ? cause.message : "That code isn't valid.";
        }
      }

      const settings = await getTicketingSettings();
      const totals = computeOrderTotals({
        lines: pricedLines,
        discountCents: discount?.amountCents ?? 0,
        fee: resolveBookingFee(event, settings),
        gstRateBp: event.gstRateBp,
      });

      return {
        ...totals,
        isFree: totals.totalCents === 0,
        discount: discount
          ? { code: discount.code, amountCents: discount.amountCents }
          : null,
        discountError,
        unlockedTierIds: discount?.unlockedTierIds ?? [],
      };
    }),

  /**
   * Reserve stock and open a payment. Returns the Stripe client secret for the
   * embedded Payment Element, or flags the order as free so the client can skip
   * straight to `claimFree`.
   */
  start: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        lines: linesSchema,
        discountCode: z.string().trim().max(64).optional(),
        /** A previous hold from this browser, released before taking a new one. */
        replaceOrderId: z.string().optional(),
        utm: z
          .object({
            source: z.string().max(120).optional(),
            medium: z.string().max(120).optional(),
            campaign: z.string().max(120).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ip = clientIp(ctx.headers);
      await enforceRateLimit({
        key: `checkout:${ip}`,
        limit: 30,
        windowSeconds: 600,
        message: "Too many checkout attempts. Give it a minute.",
      });

      if (input.replaceOrderId) {
        await cancelPendingOrder(input.replaceOrderId).catch(() => undefined);
      }

      const lines = input.lines.filter((line) => line.quantity > 0);

      const order = await createPendingOrder({
        eventId: input.eventId,
        lines,
        discountCodeInput: input.discountCode ?? null,
        utm: input.utm,
        ipAddress: ip === "unknown" ? null : ip,
        userId: ctx.session?.user.id ?? null,
      }).catch(inventoryErrorToTrpc);

      const needsDetailsUpFront = await gatedTierCount(
        lines.map((line) => line.tierId),
      );

      if (order.isFree) {
        return {
          ...order,
          clientSecret: null,
          publishableKey: null,
          needsDetailsUpFront,
        };
      }

      if (!isStripeConfigured()) {
        await cancelPendingOrder(order.orderId).catch(() => undefined);
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Card payments aren't set up yet.",
        });
      }

      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create(
        {
          amount: order.totalCents,
          currency: "nzd",
          automatic_payment_methods: { enabled: true },
          // The webhook finds the order from here; never trust the client.
          metadata: {
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            eventId: input.eventId,
          },
          description: `Tickets — order ${order.orderNumber}`,
        },
        // Retrying `start` for the same order must not open a second payment.
        { idempotencyKey: `order-pi-${order.orderId}` },
      );

      await db.ticketOrder.update({
        where: { id: order.orderId },
        data: { stripePaymentIntentId: intent.id },
      });

      return {
        ...order,
        clientSecret: intent.client_secret,
        publishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
        needsDetailsUpFront,
      };
    }),

  /**
   * Issue a free order.
   *
   * Normally this needs nothing but the terms tick — the ticket appears, and
   * the details page afterwards is what makes it deliverable. `email` and
   * `name` are only sent for the gated tiers described at the top of this file,
   * and are required in exactly that case.
   */
  claimFree: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
        acceptTerms: z.literal(true),
        marketingOptIn: z.boolean().default(false),
        email: z.email().optional(),
        name: z.string().trim().min(1).max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit({
        key: `claimfree:${clientIp(ctx.headers)}`,
        limit: 15,
        windowSeconds: 600,
      });

      const order = await findOrderByAccessToken(input.accessToken);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.totalCents !== 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This order needs to be paid for.",
        });
      }
      if (order.status === TicketOrderStatus.PAID) {
        return { ok: true as const, alreadyIssued: true };
      }
      if (order.status !== TicketOrderStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reservation has expired. Please start again.",
        });
      }

      const needsUpFront = order.items.some(
        (item) => item.tier.requiresApproval || item.tier.maxPerEmail !== null,
      );
      if (needsUpFront && !input.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This ticket needs an email address.",
        });
      }

      const email = input.email?.toLowerCase().trim() ?? null;

      // Only checkable while we still know who is claiming and nothing has been
      // issued — which is exactly why a capped tier asks up front.
      if (email) {
        for (const item of order.items) {
          if (item.tier.maxPerEmail === null) continue;
          const already = await ctx.db.ticket.count({
            where: {
              tierId: item.tierId,
              status: "VALID",
              order: { buyerEmail: email },
            },
          });
          if (already + item.quantity > item.tier.maxPerEmail) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `There's a limit of ${item.tier.maxPerEmail} × ${item.tier.name} per person.`,
            });
          }
        }
      }

      const needsApproval = order.items.some(
        (item) => item.tier.requiresApproval,
      );

      if (needsApproval) {
        if (!email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This ticket needs an email address.",
          });
        }
        await ctx.db.ticketOrder.update({
          where: { id: order.id },
          data: {
            status: TicketOrderStatus.AWAITING_APPROVAL,
            buyerEmail: email,
            buyerName: input.name ?? null,
            termsAcceptedAt: new Date(),
            marketingOptIn: input.marketingOptIn,
            // Approval queues shouldn't time out and dump the request.
            expiresAt: null,
          },
        });
        await maybeSubscribe(email, input.marketingOptIn);
        return { ok: true as const, awaitingApproval: true };
      }

      await issueTicketsForOrder({
        orderId: order.id,
        buyerEmail: email,
        buyerName: input.name ?? null,
        paymentMethod: PaymentMethodKind.FREE,
        termsAccepted: true,
        marketingOptIn: input.marketingOptIn,
      });

      // Without an email there is nowhere to send it yet; the details page
      // picks that up the moment the buyer gives us one.
      if (email) {
        await maybeSubscribe(email, input.marketingOptIn);
        await sendTicketEmail({ orderId: order.id });
      }

      return { ok: true as const, alreadyIssued: false };
    }),

  /**
   * Record terms acceptance before the payment is confirmed.
   *
   * Kept separate from `start` because the buyer ticks the box on the payment
   * step, after the hold has been taken — and the acceptance has to be stored
   * against the order regardless of whether the payment then succeeds.
   */
  acceptTerms: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
        acceptTerms: z.literal(true),
        marketingOptIn: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      const order = await findOrderByAccessToken(input.accessToken);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.status !== TicketOrderStatus.PENDING) {
        return { ok: true as const };
      }

      await db.ticketOrder.update({
        where: { id: order.id },
        data: {
          termsAcceptedAt: new Date(),
          marketingOptIn: input.marketingOptIn,
        },
      });

      return { ok: true as const };
    }),

  /**
   * Called by the success page the moment Stripe reports success in the
   * browser. Issuing here as well as in the webhook is what makes the tickets
   * feel instant; both paths are idempotent so only one of them does the work.
   */
  confirm: publicProcedure
    .input(z.object({ accessToken: z.string() }))
    .mutation(async ({ input }) => {
      const order = await findOrderByAccessToken(input.accessToken);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.status === TicketOrderStatus.PAID) {
        return { status: "PAID" as const };
      }
      if (!order.stripePaymentIntentId || !isStripeConfigured()) {
        return { status: order.status };
      }

      const stripe = getStripe();
      const intent = await stripe.paymentIntents.retrieve(
        order.stripePaymentIntentId,
        { expand: ["latest_charge"] },
      );

      if (intent.status !== "succeeded") {
        return { status: order.status };
      }

      const charge =
        typeof intent.latest_charge === "object" ? intent.latest_charge : null;

      const result = await issueTicketsForOrder({
        orderId: order.id,
        buyerEmail:
          intent.receipt_email ?? charge?.billing_details?.email ?? null,
        buyerName: charge?.billing_details?.name ?? null,
        paymentIntentId: intent.id,
        chargeId: charge?.id ?? null,
        paymentMethod: PaymentMethodKind.STRIPE,
      });

      if (!result.alreadyIssued) {
        await syncMarketingConsent(order.id);
        await sendTicketEmail({ orderId: order.id });
      }

      return { status: "PAID" as const };
    }),

  /** Poll while the webhook catches up. */
  status: publicProcedure
    .input(z.object({ accessToken: z.string() }))
    .query(async ({ input }) => {
      const order = await findOrderByAccessToken(input.accessToken);
      if (!order) return null;

      return {
        status: order.status,
        orderNumber: order.orderNumber,
        ticketCount: order.tickets.length,
        buyerEmail: order.buyerEmail,
        expiresAt: order.expiresAt,
      };
    }),

  /** Give the stock back when someone abandons the payment step. */
  release: publicProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ input }) => {
      await cancelPendingOrder(input.orderId).catch(() => undefined);
      return { ok: true as const };
    }),

  /** Whether the buy panel should render at all. */
  config: publicProcedure.query(async () => {
    const settings = await getTicketingSettings();
    return {
      stripeReady: isStripeConfigured(),
      publishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
      supportEmail: settings.supportEmail,
      holdMinutes: settings.holdMinutes,
    };
  }),
});

/**
 * Whether this basket contains a tier whose rules only hold if we know the
 * buyer before issuing. See the note at the top of this file.
 */
async function gatedTierCount(tierIds: string[]): Promise<boolean> {
  if (tierIds.length === 0) return false;
  const gated = await db.ticketTier.count({
    where: {
      id: { in: tierIds },
      OR: [{ requiresApproval: true }, { maxPerEmail: { not: null } }],
    },
  });
  return gated > 0;
}

/**
 * Ticket buyers are only added to the newsletter when they explicitly tick the
 * box — the Unsolicited Electronic Messages Act needs express consent, and a
 * purchase is not consent to marketing.
 */
async function maybeSubscribe(email: string, optedIn: boolean): Promise<void> {
  if (!optedIn) return;
  await db.newsletterSubscription
    .upsert({
      where: { email },
      update: { removed: false },
      create: { email },
    })
    .catch(() => undefined);
}
