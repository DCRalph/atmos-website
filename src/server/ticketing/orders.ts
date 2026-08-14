import "server-only";

import { TRPCError } from "@trpc/server";

import {
  PaymentMethodKind,
  type Prisma,
  TicketEventStatus,
  TicketOrderStatus,
  TicketStatus,
} from "~Prisma/client";
import { db } from "~/server/db";
import {
  computeOrderTotals,
  type BookingFeeConfig,
} from "~/lib/ticketing/money";
import {
  commitHold,
  eventHeadcount,
  holdInventory,
  InventoryError,
  releaseHold,
  returnToStock,
  withEventInventoryLock,
} from "~/server/ticketing/inventory";
import {
  buildOrderAccessToken,
  buildTicketAccessToken,
  buildTicketNumber,
  generateOrderNumber,
  parseOrderAccessToken,
  parseTicketAccessToken,
  verifyOrderAccessToken,
  verifyTicketAccessToken,
} from "~/server/ticketing/numbering";
import { ADMITTING_RESULTS } from "~/server/ticketing/scan";
import { generateQrSecret } from "~/server/ticketing/qr";
import {
  applyDiscountCode,
  recordRedemption,
  type AppliedDiscount,
} from "~/server/ticketing/discounts";
import {
  getTicketingSettings,
  resolveBookingFee,
} from "~/server/ticketing/settings";

/**
 * The order lifecycle.
 *
 * PENDING -> PAID is the only transition that mints tickets, and it is claimed
 * with a conditional update so that the Stripe webhook and the browser landing
 * on the success page can both call it and exactly one of them wins. Everything
 * downstream (ticket rows, stock commit, email) happens inside that same
 * transaction, so a half-issued order is not representable.
 */

type Tx = Prisma.TransactionClient;

export type CheckoutLine = { tierId: string; quantity: number };

export class CheckoutError extends TRPCError {
  constructor(message: string, code: TRPCError["code"] = "BAD_REQUEST") {
    super({ code, message });
  }
}

/** Everything the buy panel and the payment step need to agree on a price. */
export type PricedOrder = {
  orderId: string;
  orderNumber: string;
  accessToken: string;
  expiresAt: Date | null;
  subtotalCents: number;
  discountCents: number;
  bookingFeeCents: number;
  totalCents: number;
  gstCents: number;
  quantity: number;
  isFree: boolean;
};

function assertEventSellable(
  event: {
    status: TicketEventStatus;
    salesOpenAt: Date | null;
    salesCloseAt: Date | null;
  },
  /**
   * A staff member selling to somebody in front of them. Online sales being
   * closed, paused, or sold out says nothing about whether the door can take
   * twenty dollars at 11pm — and stock is still enforced by `holdInventory`,
   * so this cannot oversell. Only a cancelled or unpublished event is a real no.
   */
  boxOffice = false,
): void {
  const now = new Date();

  if (event.status === TicketEventStatus.CANCELLED) {
    throw new CheckoutError("This event has been cancelled.");
  }

  if (boxOffice) {
    if (
      event.status === TicketEventStatus.DRAFT ||
      event.status === TicketEventStatus.ARCHIVED
    ) {
      throw new CheckoutError("This event isn't published.", "NOT_FOUND");
    }
    return;
  }
  if (event.status === TicketEventStatus.SALES_PAUSED) {
    throw new CheckoutError("Ticket sales are paused for this event.");
  }
  if (event.status === TicketEventStatus.SOLD_OUT) {
    throw new CheckoutError("This event is sold out.");
  }
  if (event.status !== TicketEventStatus.PUBLISHED) {
    throw new CheckoutError("Tickets are not on sale.", "NOT_FOUND");
  }
  if (event.salesOpenAt && now < event.salesOpenAt) {
    throw new CheckoutError("Tickets are not on sale yet.");
  }
  if (event.salesCloseAt && now > event.salesCloseAt) {
    throw new CheckoutError("Ticket sales have closed.");
  }
}

/**
 * Reserve stock and price an order. Nothing is asked of the buyer at this
 * point — no email, no name — which is the whole point of the flow.
 *
 * The terms are the exception, and they are not a personal detail: they are
 * ticked alongside the quantities, before anything is held, so acceptance is
 * on the order from the moment it exists rather than bolted on at the payment
 * step and lost if the buyer wanders off.
 */
export async function createPendingOrder({
  eventId,
  lines,
  discountCodeInput,
  utm,
  ipAddress,
  userId,
  termsAccepted,
  boxOffice = false,
}: {
  eventId: string;
  lines: CheckoutLine[];
  discountCodeInput?: string | null;
  utm?: { source?: string; medium?: string; campaign?: string };
  ipAddress?: string | null;
  userId?: string | null;
  termsAccepted?: boolean;
  /** Staff selling in person — see `assertEventSellable`. */
  boxOffice?: boolean;
}): Promise<PricedOrder> {
  const cleanedLines = lines.filter((line) => line.quantity > 0);
  if (cleanedLines.length === 0) {
    throw new CheckoutError("Choose at least one ticket.");
  }

  const settings = await getTicketingSettings();
  const orderNumber = await generateOrderNumber();

  return withEventInventoryLock(eventId, async (tx) => {
    const event = await tx.ticketEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
        salesOpenAt: true,
        salesCloseAt: true,
        gstRateBp: true,
        bookingFeeFixedCents: true,
        bookingFeePercentBp: true,
        termsVersion: true,
      },
    });
    if (!event) throw new CheckoutError("Event not found.", "NOT_FOUND");
    assertEventSellable(event, boxOffice);

    const tiers = await tx.ticketTier.findMany({
      where: { eventId, id: { in: cleanedLines.map((l) => l.tierId) } },
      select: { id: true, priceCents: true, name: true },
    });
    const priceByTier = new Map(tiers.map((t) => [t.id, t.priceCents]));
    if (tiers.length !== cleanedLines.length) {
      throw new CheckoutError("One of those ticket types no longer exists.");
    }

    let discount: AppliedDiscount | null = null;
    if (discountCodeInput) {
      discount = await applyDiscountCode(tx, {
        code: discountCodeInput,
        eventId,
        lines: cleanedLines.map((line) => ({
          ...line,
          unitPriceCents: priceByTier.get(line.tierId) ?? 0,
        })),
      });
    }

    await holdInventory(tx, {
      eventId,
      lines: cleanedLines,
      unlockedHiddenTiers: discount?.unlockedTierIds ?? [],
    });

    const fee: BookingFeeConfig = resolveBookingFee(event, settings);
    const totals = computeOrderTotals({
      lines: cleanedLines.map((line) => ({
        unitPriceCents: priceByTier.get(line.tierId) ?? 0,
        quantity: line.quantity,
      })),
      discountCents: discount?.amountCents ?? 0,
      fee,
      gstRateBp: event.gstRateBp,
    });

    const isFree = totals.totalCents === 0;
    const expiresAt = new Date(Date.now() + settings.holdMinutes * 60_000);

    const order = await tx.ticketOrder.create({
      data: {
        orderNumber,
        eventId,
        status: TicketOrderStatus.PENDING,
        userId: userId ?? null,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        bookingFeeCents: totals.bookingFeeCents,
        totalCents: totals.totalCents,
        gstCents: totals.gstCents,
        gstRateBp: event.gstRateBp,
        discountCodeId: discount?.codeId ?? null,
        paymentMethod: isFree
          ? PaymentMethodKind.FREE
          : PaymentMethodKind.STRIPE,
        expiresAt,
        termsVersion: event.termsVersion,
        termsAcceptedAt: termsAccepted ? new Date() : null,
        utmSource: utm?.source ?? null,
        utmMedium: utm?.medium ?? null,
        utmCampaign: utm?.campaign ?? null,
        ipAddress: ipAddress ?? null,
        items: {
          create: cleanedLines.map((line) => ({
            tierId: line.tierId,
            quantity: line.quantity,
            unitPriceCents: priceByTier.get(line.tierId) ?? 0,
          })),
        },
      },
      select: {
        id: true,
        orderNumber: true,
        expiresAt: true,
        accessTokenVersion: true,
      },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      accessToken: buildOrderAccessToken(order.id, order.accessTokenVersion),
      expiresAt: order.expiresAt,
      ...totals,
      isFree,
    } satisfies PricedOrder;
  });
}

export type IssueResult = {
  orderId: string;
  alreadyIssued: boolean;
  ticketIds: string[];
};

/**
 * Mint the tickets for an order. Safe to call repeatedly and concurrently:
 * the `PENDING -> PAID` update is conditional, so the second caller sees
 * `alreadyIssued` and does nothing.
 *
 * The caller is responsible for sending email — deliberately outside the
 * transaction, so a slow mail API can never roll back a paid order.
 */
export async function issueTicketsForOrder({
  orderId,
  buyerEmail,
  buyerName,
  buyerPhone,
  paymentIntentId,
  chargeId,
  paymentMethod,
  soldByUserId,
  termsAccepted,
  marketingOptIn,
}: {
  orderId: string;
  buyerEmail?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  paymentMethod?: PaymentMethodKind;
  soldByUserId?: string | null;
  termsAccepted?: boolean;
  marketingOptIn?: boolean;
}): Promise<IssueResult> {
  const existing = await db.ticketOrder.findUnique({
    where: { id: orderId },
    select: { id: true, eventId: true, status: true },
  });
  if (!existing) {
    throw new CheckoutError("Order not found.", "NOT_FOUND");
  }

  if (existing.status === TicketOrderStatus.PAID) {
    const tickets = await db.ticket.findMany({
      where: { orderId },
      select: { id: true },
    });
    return {
      orderId,
      alreadyIssued: true,
      ticketIds: tickets.map((t) => t.id),
    };
  }

  return withEventInventoryLock(existing.eventId, async (tx) => {
    // Claim the transition. `updateMany` with a status filter is atomic, so a
    // racing webhook and success-page call cannot both proceed.
    const claimed = await tx.ticketOrder.updateMany({
      where: {
        id: orderId,
        status: {
          in: [TicketOrderStatus.PENDING, TicketOrderStatus.AWAITING_APPROVAL],
        },
      },
      data: {
        status: TicketOrderStatus.PAID,
        paidAt: new Date(),
        expiresAt: null,
        ...(buyerEmail ? { buyerEmail: buyerEmail.toLowerCase().trim() } : {}),
        ...(buyerName ? { buyerName } : {}),
        ...(buyerPhone ? { buyerPhone } : {}),
        ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
        ...(chargeId ? { stripeChargeId: chargeId } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(soldByUserId ? { soldByUserId } : {}),
        ...(termsAccepted ? { termsAcceptedAt: new Date() } : {}),
        ...(marketingOptIn !== undefined ? { marketingOptIn } : {}),
      },
    });

    if (claimed.count === 0) {
      const tickets = await tx.ticket.findMany({
        where: { orderId },
        select: { id: true },
      });
      return {
        orderId,
        alreadyIssued: true,
        ticketIds: tickets.map((t) => t.id),
      };
    }

    const order = await tx.ticketOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        eventId: true,
        buyerEmail: true,
        discountCodeId: true,
        discountCents: true,
        items: {
          select: {
            tierId: true,
            quantity: true,
            unitPriceCents: true,
            tier: { select: { accessLevel: true } },
          },
          orderBy: { tierId: "asc" },
        },
      },
    });

    await commitHold(tx, order.items);

    const ticketIds: string[] = [];
    let seat = 0;
    for (const item of order.items) {
      for (let i = 0; i < item.quantity; i++) {
        const ticket = await tx.ticket.create({
          data: {
            ticketNumber: buildTicketNumber(order.orderNumber, seat),
            orderId: order.id,
            eventId: order.eventId,
            tierId: item.tierId,
            qrSecret: generateQrSecret(),
            pricePaidCents: item.unitPriceCents,
            status: TicketStatus.VALID,
            // Snapshotted, not joined: editing a tier later must not re-band
            // tickets already sitting in people's wallets.
            accessLevel: item.tier.accessLevel,
          },
          select: { id: true },
        });
        ticketIds.push(ticket.id);
        seat++;
      }
    }

    if (order.discountCodeId && order.discountCents > 0) {
      await recordRedemption(tx, {
        codeId: order.discountCodeId,
        orderId: order.id,
        email: order.buyerEmail,
        amountCents: order.discountCents,
      });
    }

    await maybeMarkSoldOut(tx, order.eventId);

    return { orderId, alreadyIssued: false, ticketIds };
  });
}

/**
 * Flip an event to SOLD_OUT once nothing is left, so the public page and the
 * gig card stop advertising tickets without an admin having to notice.
 */
export async function maybeMarkSoldOut(tx: Tx, eventId: string): Promise<void> {
  const event = await tx.ticketEvent.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      capacity: true,
      tiers: {
        select: {
          allocation: true,
          soldCount: true,
          heldCount: true,
          isActive: true,
          isHidden: true,
        },
      },
    },
  });
  if (event?.status !== TicketEventStatus.PUBLISHED) return;

  const visibleTiers = event.tiers.filter((t) => t.isActive && !t.isHidden);
  const anythingLeft = visibleTiers.some(
    (t) => t.allocation - t.soldCount - t.heldCount > 0,
  );

  // Comps fill seats without touching a tier counter, so comping the last of
  // the room has to be able to close sales just as selling it would.
  const { headcount: committed } = await eventHeadcount(tx, eventId);
  const atCapacity = event.capacity !== null && committed >= event.capacity;

  if (!anythingLeft || atCapacity) {
    await tx.ticketEvent.update({
      where: { id: eventId },
      data: { status: TicketEventStatus.SOLD_OUT },
    });
  }
}

/**
 * Release an unissued order's stock immediately.
 *
 * Covers both a held checkout and a guest-list request sitting in the approval
 * queue — both are holding inventory that has to go back if they don't become
 * tickets.
 */
export async function cancelPendingOrder(
  orderId: string,
  status: Extract<
    TicketOrderStatus,
    "CANCELLED" | "FAILED" | "EXPIRED"
  > = TicketOrderStatus.CANCELLED,
): Promise<void> {
  const releasable: TicketOrderStatus[] = [
    TicketOrderStatus.PENDING,
    TicketOrderStatus.AWAITING_APPROVAL,
  ];

  const order = await db.ticketOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      eventId: true,
      status: true,
      items: { select: { tierId: true, quantity: true } },
    },
  });
  if (!order || !releasable.includes(order.status)) return;

  await withEventInventoryLock(order.eventId, async (tx) => {
    const claimed = await tx.ticketOrder.updateMany({
      where: { id: orderId, status: { in: releasable } },
      data: { status, expiresAt: null },
    });
    if (claimed.count === 0) return;
    await releaseHold(tx, order.items);
  });
}

/**
 * Void a single ticket and put its seat back on sale. Used by refunds and by
 * the admin "void ticket" action. Bumping `qrVersion` kills any QR already in
 * someone's wallet.
 */
export async function voidTicket({
  ticketId,
  reason,
  status = TicketStatus.VOID,
}: {
  ticketId: string;
  reason: string;
  status?: TicketStatus;
}): Promise<void> {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, eventId: true, tierId: true, status: true },
  });
  if (ticket?.status !== TicketStatus.VALID) return;

  await withEventInventoryLock(ticket.eventId, async (tx) => {
    const claimed = await tx.ticket.updateMany({
      where: { id: ticketId, status: TicketStatus.VALID },
      data: {
        status,
        voidedAt: new Date(),
        voidReason: reason,
        qrVersion: { increment: 1 },
      },
    });
    if (claimed.count === 0) return;
    // A comp came out of no tier, so there is no counter to give back to — it
    // frees its seat simply by dropping out of the comp count.
    if (ticket.tierId) await returnToStock(tx, ticket.tierId);

    // A refund can un-sell-out an event.
    const event = await tx.ticketEvent.findUnique({
      where: { id: ticket.eventId },
      select: { status: true },
    });
    if (event?.status === TicketEventStatus.SOLD_OUT) {
      await tx.ticketEvent.update({
        where: { id: ticket.eventId },
        data: { status: TicketEventStatus.PUBLISHED },
      });
    }
  });
}

/** One ticket as it was, kept for the log once the row is gone. */
export type DeletedTicket = {
  id: string;
  ticketNumber: string;
  eventId: string;
  orderId: string;
  attendeeName: string | null;
  attendeeEmail: string | null;
  pricePaidCents: number;
  isComp: boolean;
  /** True when it came along as part of a comp grant being deleted. */
  viaHost: boolean;
};

/**
 * Delete tickets outright.
 *
 * Voiding is the normal way to kill a ticket: the row stays, the door can still
 * explain why somebody was turned away, and the money it was bought with is
 * still attached to an order. Deleting is for tickets that should never have
 * existed — a test order, a comp to the wrong person, a duplicate — where the
 * void row is just noise on a door list that has to be read at a glance.
 *
 * It takes everything with it. Scans cascade, the wallet registrations go so we
 * stop pushing to a phone holding a pass with no ticket behind it, and a comp
 * grant leaves as a grant: deleting somebody's ticket without the plus-ones
 * they were given to hand out would leave guests holding links to a party
 * nobody invited them to.
 *
 * Seats come back the same way a void returns them, and an event that sold out
 * on the deleted tickets opens again.
 */
export async function deleteTickets(
  ticketIds: readonly string[],
): Promise<DeletedTicket[]> {
  if (ticketIds.length === 0) return [];

  const selected = await db.ticket.findMany({
    where: { id: { in: [...ticketIds] } },
    select: {
      id: true,
      ticketNumber: true,
      eventId: true,
      orderId: true,
      tierId: true,
      status: true,
      isComp: true,
      attendeeName: true,
      attendeeEmail: true,
      pricePaidCents: true,
    },
  });
  if (selected.length === 0) return [];

  const chosen = new Set(selected.map((ticket) => ticket.id));
  const handouts = await db.ticket.findMany({
    where: { hostTicketId: { in: selected.map((t) => t.id) } },
    select: {
      id: true,
      ticketNumber: true,
      eventId: true,
      orderId: true,
      tierId: true,
      status: true,
      isComp: true,
      attendeeName: true,
      attendeeEmail: true,
      pricePaidCents: true,
    },
  });

  const doomed = [
    ...selected,
    ...handouts.filter((handout) => !chosen.has(handout.id)),
  ];

  const byEvent = new Map<string, typeof doomed>();
  for (const ticket of doomed) {
    const bucket = byEvent.get(ticket.eventId);
    if (bucket) bucket.push(ticket);
    else byEvent.set(ticket.eventId, [ticket]);
  }

  for (const [eventId, tickets] of byEvent) {
    await withEventInventoryLock(eventId, async (tx) => {
      for (const ticket of tickets) {
        // A void already gave its seat back, and a comp was never drawn from a
        // tier — only a live tier ticket has a counter to return to.
        if (ticket.status === TicketStatus.VALID && ticket.tierId) {
          await returnToStock(tx, ticket.tierId);
        }
      }

      await tx.ticket.deleteMany({
        where: { id: { in: tickets.map((ticket) => ticket.id) } },
      });

      const event = await tx.ticketEvent.findUnique({
        where: { id: eventId },
        select: { status: true },
      });
      if (event?.status === TicketEventStatus.SOLD_OUT) {
        await tx.ticketEvent.update({
          where: { id: eventId },
          data: { status: TicketEventStatus.PUBLISHED },
        });
      }
    });
  }

  // Outside the lock: a stale registration is harmless, and failing the delete
  // over one would leave the ticket gone and the caller told it wasn't.
  await db.walletPassRegistration.deleteMany({
    where: { serialNumber: { in: doomed.map((ticket) => ticket.id) } },
  });

  return doomed.map((ticket) => ({
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    eventId: ticket.eventId,
    orderId: ticket.orderId,
    attendeeName: ticket.attendeeName,
    attendeeEmail: ticket.attendeeEmail,
    pricePaidCents: ticket.pricePaidCents,
    isComp: ticket.isComp,
    viaHost: !chosen.has(ticket.id),
  }));
}

/**
 * Look up an order from its `/tickets/[token]` URL.
 *
 * The signature is checked against the row's current `accessTokenVersion`, so
 * a revoked link stops working even though the order id inside it is still
 * valid.
 */
export async function findOrderByAccessToken(token: string) {
  const parsed = parseOrderAccessToken(token);
  if (!parsed) return null;

  const order = await db.ticketOrder.findUnique({
    where: { id: parsed.orderId },
    include: {
      // The gig comes along for its poster: an event linked to a gig inherits
      // that artwork when it has none of its own.
      event: { include: { gig: { select: { posterFileUploadId: true } } } },
      items: { include: { tier: true } },
      tickets: {
        where: { status: { not: TicketStatus.VOID } },
        include: { tier: true },
        orderBy: { ticketNumber: "asc" },
      },
    },
  });
  if (!order) return null;
  if (!verifyOrderAccessToken(parsed, order)) return null;

  return order;
}

/**
 * Look up one ticket from its `/t/[token]` URL.
 *
 * The comp equivalent of `findOrderByAccessToken`: the token unlocks a single
 * ticket rather than everything somebody bought, so the page it feeds can only
 * ever render one QR. Hand-outs come along when the ticket is a host, because
 * that is the list the recipient hands out from.
 */
export async function findTicketByAccessToken(token: string) {
  const parsed = parseTicketAccessToken(token);
  if (!parsed) return null;

  const ticket = await db.ticket.findUnique({
    where: { id: parsed.ticketId },
    include: {
      tier: true,
      event: { include: { gig: { select: { posterFileUploadId: true } } } },
      order: {
        select: { orderNumber: true, paymentMethod: true, notes: true },
      },
      handouts: {
        where: { status: { not: TicketStatus.VOID } },
        orderBy: { ticketNumber: "asc" },
        include: {
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
  if (!ticket) return null;
  if (ticket.status === TicketStatus.VOID) return null;
  if (!verifyTicketAccessToken(parsed, ticket)) return null;

  return ticket;
}

/** Rebuild one person's `/t/[token]` link. */
export function ticketAccessToken(ticket: {
  id: string;
  accessTokenVersion: number;
}): string {
  return buildTicketAccessToken(ticket.id, ticket.accessTokenVersion);
}

/**
 * Add a buyer to the newsletter, but only if they ticked the box.
 *
 * Buying a ticket is not consent to marketing — the Unsolicited Electronic
 * Messages Act needs that to be express — so this is driven entirely by the
 * `marketingOptIn` flag captured at checkout.
 */
export async function syncMarketingConsent(orderId: string): Promise<void> {
  const order = await db.ticketOrder.findUnique({
    where: { id: orderId },
    select: { marketingOptIn: true, buyerEmail: true },
  });
  if (!order?.marketingOptIn || !order.buyerEmail) return;

  await db.newsletterSubscription
    .upsert({
      where: { email: order.buyerEmail },
      update: { removed: false },
      create: { email: order.buyerEmail },
    })
    .catch(() => undefined);
}

/** Rebuild the buyer's ticket link — for re-sending email, and admin tools. */
export function orderAccessToken(order: {
  id: string;
  accessTokenVersion: number;
}): string {
  return buildOrderAccessToken(order.id, order.accessTokenVersion);
}

export { InventoryError };
