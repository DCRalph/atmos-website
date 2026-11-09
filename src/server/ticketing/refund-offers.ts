import "server-only";

import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import { TRPCError } from "@trpc/server";

import {
  ActivityType,
  PaymentMethodKind,
  TicketEmailType,
  TicketOrderStatus,
  TicketStatus,
  type Prisma,
} from "~Prisma/client";
import { env } from "~/env";
import {
  discountedTicketCents,
  maskEmail,
  offerAmountCents,
  readOfferId,
  signOfferId,
  type OfferAmount,
} from "~/lib/ticketing/refund-offers";
import { db } from "~/server/db";
import { sendEmail, sendEmailBatch } from "~/server/email/send";
import { sendRefundEmail } from "~/server/ticketing/email/send";
import {
  renderRefundCodeEmail,
  renderRefundOfferEmail,
} from "~/server/ticketing/email/templates";
import { refundOrderThroughStripe } from "~/server/ticketing/refunds";
import { getTicketingSettings } from "~/server/ticketing/settings";
import { logActivity } from "~/server/utils/activity-log";

/**
 * Refund offers: an admin offers, the buyer takes.
 *
 * The admin picks the orders (one, or every paid order on chosen tiers of an
 * event), the amount ("everything" or "tickets only", keeping booking fees),
 * a message and a closing date. Each buyer is emailed a link to
 * `/refund/<token>`. Taking it emails a 6-digit code to the order's address;
 * the right code refunds through Stripe exactly as the admin "Refund order"
 * button does. Nothing is refunded unless an admin offered it, and an offer
 * that has been taken, withdrawn or has closed does nothing.
 */

/** How long a code works once it is emailed. */
const CODE_TTL_MS = 10 * 60_000;
/** Wrong codes allowed before a new one has to be sent. */
const MAX_CODE_TRIES = 5;
/** Resend allows at most 100 emails per batch call. */
const BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Links and codes
// ---------------------------------------------------------------------------

/** Derived from the auth secret, so there is no new secret to set. */
function key() {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update("refund-offer")
    .digest("base64url");
}

export function offerUrl(offerId: string) {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/refund/${signOfferId(key(), offerId)}`;
}

/** Codes are stored hashed with the offer they belong to. */
const codeHash = (offerId: string, code: string) =>
  createHmac("sha256", key()).update(`${offerId}:${code}`).digest("hex");

// ---------------------------------------------------------------------------
// Who can be offered what
// ---------------------------------------------------------------------------

/** An offer that can still be taken. */
export const OPEN_OFFER = (now = new Date()) =>
  ({
    claimedAt: null,
    withdrawnAt: null,
    expiresAt: { gt: now },
  }) satisfies Prisma.RefundOfferWhereInput;

/**
 * Orders a refund can be offered on: paid by card through Stripe, with an
 * email to send it to, a ticket still valid, and no offer already open.
 * Door sales, comps and free orders are not, and neither is anything already
 * fully refunded.
 */
const offerable = () =>
  ({
    paymentMethod: PaymentMethodKind.STRIPE,
    stripePaymentIntentId: { not: null },
    buyerEmail: { not: null },
    status: {
      in: [TicketOrderStatus.PAID, TicketOrderStatus.PARTIALLY_REFUNDED],
    },
    tickets: { some: { status: TicketStatus.VALID } },
    refundOffers: { none: OPEN_OFFER() },
  }) satisfies Prisma.TicketOrderWhereInput;

const ORDER_FOR_OFFER = {
  id: true,
  orderNumber: true,
  buyerEmail: true,
  totalCents: true,
  refundedCents: true,
  subtotalCents: true,
  discountCents: true,
  tickets: {
    where: { status: TicketStatus.VALID },
    select: { pricePaidCents: true },
  },
  event: { select: { name: true, startsAt: true, timezone: true } },
} satisfies Prisma.TicketOrderSelect;

type OrderForOffer = Prisma.TicketOrderGetPayload<{
  select: typeof ORDER_FOR_OFFER;
}>;

/** The orders an offer would go to: one order, or an event's chosen tiers. */
export function offerTargetWhere(
  target: { orderId: string } | { eventId: string; tierIds: string[] },
): Prisma.TicketOrderWhereInput {
  if ("orderId" in target) return { ...offerable(), id: target.orderId };
  return {
    ...offerable(),
    eventId: target.eventId,
    tickets: {
      some: { status: TicketStatus.VALID, tierId: { in: target.tierIds } },
    },
  };
}

/** How many orders an offer would reach, and what it could cost at most. */
export async function previewOffer(where: Prisma.TicketOrderWhereInput) {
  const orders = await db.ticketOrder.findMany({
    where,
    select: ORDER_FOR_OFFER,
  });
  return {
    orders: orders.length,
    everythingCents: orders.reduce(
      (sum, order) => sum + offerAmountCents(order, "everything"),
      0,
    ),
    ticketsOnlyCents: orders.reduce(
      (sum, order) => sum + offerAmountCents(order, "ticketsOnly"),
      0,
    ),
  };
}

// ---------------------------------------------------------------------------
// Offering
// ---------------------------------------------------------------------------

type OfferEmail = {
  offerId: string;
  orderId: string;
  to: string;
  email: ReturnType<typeof renderRefundOfferEmail>;
};

async function offerEmail(
  offer: {
    id: string;
    amountCents: number;
    message: string;
    expiresAt: Date;
  },
  order: OrderForOffer,
  supportEmail: string | null,
): Promise<OfferEmail> {
  return {
    offerId: offer.id,
    orderId: order.id,
    to: order.buyerEmail ?? "",
    email: renderRefundOfferEmail({
      eventName: order.event.name,
      eventStartsAt: order.event.startsAt,
      timezone: order.event.timezone,
      orderNumber: order.orderNumber,
      message: offer.message,
      amountCents: offer.amountCents,
      ticketCount: order.tickets.length,
      expiresAt: offer.expiresAt,
      url: offerUrl(offer.id),
      supportEmail,
    }),
  };
}

/**
 * Send offer emails in batches, and record which went. `sendId` names this
 * send, so a deliberate resend is not mistaken by Resend for a retry of the
 * first one.
 */
async function sendOfferEmails(
  emails: OfferEmail[],
  replyTo: string | null,
  sendId: string,
) {
  let sent = 0;
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const key = createHash("sha256")
      .update(batch.map((item) => item.offerId).join(","))
      .digest("hex");
    const result = await sendEmailBatch(
      batch.map((item) => ({
        from: "tickets" as const,
        to: item.to,
        ...item.email,
        replyTo: replyTo ?? undefined,
      })),
      { idempotencyKey: `refund-offer/${sendId}/${key}`, permissive: true },
    );
    const now = new Date();
    const went = batch.filter((_, index) => {
      const outcome = result.results?.[index];
      return result.ok && outcome !== undefined && "id" in outcome;
    });
    if (went.length) {
      await db.refundOffer.updateMany({
        where: { id: { in: went.map((item) => item.offerId) } },
        data: { emailedAt: now },
      });
    }
    await db.ticketEmailLog.createMany({
      data: batch.map((item, index) => {
        const outcome = result.results?.[index];
        const ok = result.ok && outcome !== undefined && "id" in outcome;
        return {
          orderId: item.orderId,
          type: TicketEmailType.REFUND_OFFER,
          toEmail: item.to,
          providerMessageId: ok ? outcome.id : null,
          status: ok ? "sent" : "failed",
          error: ok
            ? null
            : outcome && "error" in outcome
              ? outcome.error
              : (result.error ?? "Not sent"),
        };
      }),
    });
    sent += went.length;
  }
  return sent;
}

/**
 * Offer a refund on every order `where` matches, and email each buyer. An
 * order that already has an open offer is left alone, so offering twice to
 * an event only reaches the orders added since.
 */
export async function createOffers({
  where,
  amount,
  message,
  expiresAt,
  admin,
}: {
  where: Prisma.TicketOrderWhereInput;
  amount: OfferAmount;
  message: string;
  expiresAt: Date;
  admin: { id: string; name: string };
}) {
  const orders = await db.ticketOrder.findMany({
    where,
    select: ORDER_FOR_OFFER,
  });
  const offeredBy = admin.name.split(" ")[0] ?? null;

  const created = [];
  for (const order of orders) {
    const amountCents = offerAmountCents(order, amount);
    if (amountCents <= 0) continue;
    const offer = await db.refundOffer.create({
      data: {
        orderId: order.id,
        amountCents,
        includesFees: amount === "everything",
        message,
        offeredById: admin.id,
        offeredBy,
        expiresAt,
      },
    });
    created.push({ offer, order });
  }

  const settings = await getTicketingSettings();
  const emails = await Promise.all(
    created.map(({ offer, order }) =>
      offerEmail(offer, order, settings.supportEmail),
    ),
  );
  const emailed = await sendOfferEmails(emails, settings.supportEmail, "offer");

  await logActivity({
    type: ActivityType.REFUND_OFFERED,
    action: `Offered refunds on ${created.length} order${created.length === 1 ? "" : "s"}`,
    userId: admin.id,
    details: {
      orderIds: created.map(({ order }) => order.id),
      amount,
      totalCents: created.reduce(
        (sum, { offer }) => sum + offer.amountCents,
        0,
      ),
      expiresAt: expiresAt.toISOString(),
    },
  });

  return { offered: created.length, emailed };
}

/** The offer email again, for a buyer who lost it. */
export async function resendOffer(offerId: string) {
  const offer = await db.refundOffer.findFirst({
    where: { id: offerId, ...OPEN_OFFER() },
    include: { order: { select: ORDER_FOR_OFFER } },
  });
  if (!offer) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That offer has been taken, withdrawn or has closed.",
    });
  }
  const settings = await getTicketingSettings();
  const emailed = await sendOfferEmails(
    [await offerEmail(offer, offer.order, settings.supportEmail)],
    settings.supportEmail,
    `resend-${Date.now()}`,
  );
  return { emailed: emailed > 0 };
}

/** One test copy to the admin, with a link that goes nowhere real. */
export async function sendTestOffer({
  orderId,
  amount,
  message,
  expiresAt,
  admin,
}: {
  orderId: string;
  amount: OfferAmount;
  message: string;
  expiresAt: Date;
  admin: { name: string; email: string };
}) {
  const order = await db.ticketOrder.findUnique({
    where: { id: orderId },
    select: ORDER_FOR_OFFER,
  });
  if (!order) throw new TRPCError({ code: "NOT_FOUND" });
  const settings = await getTicketingSettings();
  const { email } = await offerEmail(
    {
      id: "test",
      amountCents: offerAmountCents(order, amount),
      message,
      expiresAt,
    },
    order,
    settings.supportEmail,
  );
  return sendEmail({
    from: "tickets",
    to: admin.email,
    subject: `[Test] ${email.subject}`,
    html: email.html,
    text: email.text,
  });
}

// ---------------------------------------------------------------------------
// Taking an offer
// ---------------------------------------------------------------------------

type OfferState = "open" | "taken" | "withdrawn" | "closed";

function stateOf(offer: {
  claimedAt: Date | null;
  withdrawnAt: Date | null;
  expiresAt: Date;
}): OfferState {
  if (offer.claimedAt) return "taken";
  if (offer.withdrawnAt) return "withdrawn";
  return offer.expiresAt > new Date() ? "open" : "closed";
}

async function offerByToken(token: string) {
  const offerId = readOfferId(key(), token);
  if (!offerId) return null;
  return db.refundOffer.findUnique({
    where: { id: offerId },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          buyerEmail: true,
          subtotalCents: true,
          discountCents: true,
          tickets: {
            where: { status: TicketStatus.VALID },
            select: { pricePaidCents: true, tier: { select: { name: true } } },
          },
          event: {
            select: {
              name: true,
              startsAt: true,
              timezone: true,
              gig: { select: { posterFileUploadId: true } },
            },
          },
        },
      },
    },
  });
}

/** What the refund page shows. Null for a link that is not ours. */
export async function loadOffer(token: string) {
  const offer = await offerByToken(token);
  if (!offer) return null;
  const { order } = offer;

  // One line per tier: "2 × General admission".
  const lines = new Map<string, { count: number; cents: number }>();
  for (const ticket of order.tickets) {
    const tier = ticket.tier?.name ?? "Ticket";
    const line = lines.get(tier) ?? { count: 0, cents: 0 };
    lines.set(tier, {
      count: line.count + 1,
      cents: line.cents + ticket.pricePaidCents,
    });
  }
  const ticketCents = order.tickets.reduce((s, t) => s + t.pricePaidCents, 0);
  const paidForTickets = discountedTicketCents(order);

  return {
    state: stateOf(offer),
    eventName: order.event.name,
    eventStartsAt: order.event.startsAt,
    timezone: order.event.timezone,
    posterFileId: order.event.gig?.posterFileUploadId ?? null,
    message: offer.message,
    amountCents: offer.amountCents,
    expiresAt: offer.expiresAt,
    ticketCount: order.tickets.length,
    lines: [...lines].map(([tier, line]) => ({ tier, ...line })),
    discountCents: ticketCents - paidForTickets,
    // Shown only when the offer gives the fees back, as the gap between what
    // the tickets cost and the amount.
    feeCents: Math.max(0, offer.amountCents - paidForTickets),
    maskedEmail: order.buyerEmail ? maskEmail(order.buyerEmail) : null,
  };
}

export type LoadedOffer = NonNullable<Awaited<ReturnType<typeof loadOffer>>>;

async function openOfferOrThrow(token: string) {
  const offer = await offerByToken(token);
  if (!offer) throw new TRPCError({ code: "NOT_FOUND" });
  if (stateOf(offer) !== "open") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This offer has ended.",
    });
  }
  if (!offer.order.buyerEmail) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This order has no email to send a code to.",
    });
  }
  return { ...offer, buyerEmail: offer.order.buyerEmail };
}

/** Email a fresh code to the order's address. A new code resets the tries. */
export async function sendOfferCode(token: string) {
  const offer = await openOfferOrThrow(token);
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await db.refundOffer.update({
    where: { id: offer.id },
    data: {
      codeHash: codeHash(offer.id, code),
      codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
      codeAttempts: 0,
    },
  });
  const email = renderRefundCodeEmail({
    code,
    eventName: offer.order.event.name,
  });
  const result = await sendEmail({
    from: "tickets",
    to: offer.buyerEmail,
    ...email,
  });
  await db.ticketEmailLog.create({
    data: {
      orderId: offer.order.id,
      type: TicketEmailType.REFUND_CODE,
      toEmail: offer.buyerEmail,
      providerMessageId: result.messageId ?? null,
      status: result.ok ? "sent" : "failed",
      error: result.error ?? null,
    },
  });
  if (!result.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "We couldn't send the code. Try again in a moment.",
    });
  }
  return { sentTo: maskEmail(offer.buyerEmail) };
}

/**
 * Check the code and refund. The offer is marked taken before Stripe is
 * asked, so two taps refund once. If anything fails it is opened again for
 * another try, which is safe: the refund is tagged with the offer, so a retry
 * after Stripe already refunded only finishes the cancelling.
 */
export async function takeOffer(token: string, code: string) {
  const offer = await openOfferOrThrow(token);
  if (
    !offer.codeHash ||
    !offer.codeExpiresAt ||
    offer.codeExpiresAt < new Date()
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That code has expired. Send a new one.",
    });
  }
  if (offer.codeAttempts >= MAX_CODE_TRIES) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many tries. Send a new code.",
    });
  }
  const given = Buffer.from(codeHash(offer.id, code.trim()));
  const expected = Buffer.from(offer.codeHash);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    await db.refundOffer.update({
      where: { id: offer.id },
      data: { codeAttempts: { increment: 1 } },
    });
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That code isn't right.",
    });
  }

  const claimed = await db.refundOffer.updateMany({
    where: { id: offer.id, ...OPEN_OFFER() },
    data: { claimedAt: new Date(), codeHash: null },
  });
  if (!claimed.count) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This offer has ended.",
    });
  }

  let refunded;
  try {
    refunded = await refundOrderThroughStripe({
      orderId: offer.order.id,
      amountCents: offer.amountCents,
      reason: "Refund offer taken by the buyer",
      idempotencyKey: () => `refund-offer-${offer.id}`,
      offerId: offer.id,
    });
  } catch (cause) {
    await db.refundOffer.update({
      where: { id: offer.id },
      data: { claimedAt: null },
    });
    throw cause;
  }

  await logActivity({
    type: ActivityType.TICKET_ORDER_REFUNDED,
    action: `${offer.order.orderNumber} took a refund offer`,
    details: {
      orderId: offer.order.id,
      offerId: offer.id,
      amountCents: refunded.amountCents,
      tickets: refunded.ticketNumbers.length,
    },
  });
  await sendRefundEmail({
    orderId: offer.order.id,
    amountCents: refunded.amountCents,
    ticketNumbers: refunded.ticketNumbers,
  });

  return { amountCents: refunded.amountCents };
}
