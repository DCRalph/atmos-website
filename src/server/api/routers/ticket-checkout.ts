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
 * The shape of this router is the seamless flow: `quote` prices a basket with
 * nothing but tier ids, `start` takes the money, and the buyer's email arrives
 * with the payment rather than before it. `claimFree` is the one exception —
 * a free ticket still has to be delivered somewhere, so that path asks for an
 * email up front.
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

      const order = await createPendingOrder({
        eventId: input.eventId,
        lines: input.lines.filter((line) => line.quantity > 0),
        discountCodeInput: input.discountCode ?? null,
        utm: input.utm,
        ipAddress: ip === "unknown" ? null : ip,
        userId: ctx.session?.user.id ?? null,
      }).catch(inventoryErrorToTrpc);

      if (order.isFree) {
        return { ...order, clientSecret: null, publishableKey: null };
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
      };
    }),

  /**
   * Issue a free order. This is the only place a buyer is asked for anything
   * before they have "paid" — there is no payment to harvest an email from.
   */
  claimFree: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
        email: z.email(),
        name: z.string().trim().min(1).max(120),
        acceptTerms: z.literal(true),
        marketingOptIn: z.boolean().default(false),
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

      const email = input.email.toLowerCase().trim();

      // Per-email caps are enforceable here because, unlike a card checkout,
      // we know who is claiming before anything is issued.
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

      const needsApproval = order.items.some(
        (item) => item.tier.requiresApproval,
      );

      if (needsApproval) {
        await ctx.db.ticketOrder.update({
          where: { id: order.id },
          data: {
            status: TicketOrderStatus.AWAITING_APPROVAL,
            buyerEmail: email,
            buyerName: input.name,
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
        buyerName: input.name,
        paymentMethod: PaymentMethodKind.FREE,
        termsAccepted: true,
        marketingOptIn: input.marketingOptIn,
      });

      await maybeSubscribe(email, input.marketingOptIn);
      await sendTicketEmail({ orderId: order.id });

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
