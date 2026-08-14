import "server-only";

import { TRPCError } from "@trpc/server";

import {
  PaymentMethodKind,
  TicketOrderStatus,
  TicketStatus,
} from "~Prisma/client";
import { db } from "~/server/db";
import {
  InventoryError,
  compCountForEvent,
  committedAgainstCapacity,
  recordDirectSale,
  remainingInTier,
  withEventInventoryLock,
} from "~/server/ticketing/inventory";
import {
  buildTicketNumber,
  generateOrderNumbers,
} from "~/server/ticketing/numbering";
import {
  deleteTickets,
  maybeMarkSoldOut,
  ticketAccessToken,
} from "~/server/ticketing/orders";
import { generateQrSecret } from "~/server/ticketing/qr";
import { ADMITTING_RESULTS } from "~/server/ticketing/scan";
import { ticketUrl } from "~/server/ticketing/urls";

export const MAX_PRIMARY_LINKS = 100;
export const MAX_PLUS_PER_LINK = 10;

/**
 * What has happened to a batch since it was handed out.
 *
 * A bearer link starts anonymous, so "claimed" is the only signal that one
 * reached a person: somebody's name is on it. `arrived` counts every ticket in
 * the batch that has been used to get in, hand-outs included.
 */
export type TicketLinkBatchUse = {
  claimed: number;
  arrived: number;
};

export type IssuedTicketLinkBatch = {
  id: string;
  eventId: string;
  tierId: string;
  tierName: string;
  label: string | null;
  primaryCount: number;
  plusCount: number;
  ticketCount: number;
  createdAt: Date;
  createdByUserId: string;
  use: TicketLinkBatchUse;
  links: {
    ticketId: string;
    ticketNumber: string;
    ticketUrl: string;
    /** Null until somebody puts a name to it. */
    attendeeName: string | null;
    admittedAt: Date | null;
  }[];
};

/**
 * Mint a batch of unnamed ticket links drawn from a tier.
 *
 * Unlike a comp, every ticket here consumes allocation and event capacity —
 * they are real seats, just issued as bearer links instead of a sale. Primary
 * tickets are immediately usable with no name on them. Plus tickets attach
 * through the same host/hand-out relation comps use, so the existing `/t/`
 * page can copy or assign them.
 */
export async function issueTicketLinkBatch({
  eventId,
  tierId,
  primaryCount,
  plusCount,
  label,
  issuedByUserId,
}: {
  eventId: string;
  tierId: string;
  primaryCount: number;
  plusCount: number;
  label?: string | null;
  issuedByUserId: string;
}): Promise<IssuedTicketLinkBatch> {
  if (
    !Number.isInteger(primaryCount) ||
    primaryCount < 1 ||
    primaryCount > MAX_PRIMARY_LINKS
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Issue between 1 and ${MAX_PRIMARY_LINKS} links at a time.`,
    });
  }
  if (
    !Number.isInteger(plusCount) ||
    plusCount < 0 ||
    plusCount > MAX_PLUS_PER_LINK
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Each link can include at most ${MAX_PLUS_PER_LINK} extra tickets.`,
    });
  }

  const ticketsPerLink = 1 + plusCount;
  const ticketCount = primaryCount * ticketsPerLink;
  let trimmedLabel: string | null = null;
  if (label) {
    const trimmed = label.trim();
    if (trimmed.length > 0) trimmedLabel = trimmed;
  }
  // Read-only, so it happens before the lock rather than inside it.
  const orderNumbers = await generateOrderNumbers(primaryCount);

  return withEventInventoryLock(
    eventId,
    async (tx) => {
      const event = await tx.ticketEvent.findUnique({
        where: { id: eventId },
        select: { id: true, termsVersion: true, capacity: true },
      });
      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Event not found.",
        });
      }

      const tier = await tx.ticketTier.findUnique({
        where: { id: tierId },
        select: {
          id: true,
          eventId: true,
          name: true,
          accessLevel: true,
          allocation: true,
          soldCount: true,
          heldCount: true,
        },
      });
      if (!tier) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That ticket type isn't on this event.",
        });
      }
      if (tier.eventId !== eventId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That ticket type isn't on this event.",
        });
      }

      const remaining = remainingInTier(tier);
      if (remaining < ticketCount) {
        throw new InventoryError(
          remaining === 0
            ? `${tier.name} is sold out.`
            : `Only ${remaining} × ${tier.name} left.`,
          "INSUFFICIENT_STOCK",
          tier.id,
        );
      }

      if (event.capacity !== null) {
        const tiers = await tx.ticketTier.findMany({
          where: { eventId },
          select: { soldCount: true, heldCount: true },
        });
        const committed =
          committedAgainstCapacity(tiers) +
          (await compCountForEvent(tx, eventId));
        if (committed + ticketCount > event.capacity) {
          const left = Math.max(0, event.capacity - committed);
          throw new InventoryError(
            left === 0
              ? "This event is at capacity."
              : `Only ${left} seats left for this event.`,
            "EVENT_CAPACITY",
          );
        }
      }

      const batch = await tx.ticketLinkBatch.create({
        data: {
          eventId,
          tierId: tier.id,
          label: trimmedLabel,
          primaryCount,
          plusCount,
          createdByUserId: issuedByUserId,
        },
        select: { id: true, createdAt: true },
      });

      const issuedAt = new Date();

      // One order per link. Whoever holds it has a party of one or three, and
      // an order is the unit everything else is about: its own number, its own
      // ticket link, its own line in the orders list.
      const orders = await tx.ticketOrder.createManyAndReturn({
        data: orderNumbers.map((orderNumber) => ({
          orderNumber,
          eventId,
          status: TicketOrderStatus.PAID,
          paymentMethod: PaymentMethodKind.ADMIN,
          paidAt: issuedAt,
          soldByUserId: issuedByUserId,
          notes: trimmedLabel,
          termsVersion: event.termsVersion,
          termsAcceptedAt: issuedAt,
          linkBatchId: batch.id,
        })),
        select: { id: true, orderNumber: true },
      });

      await tx.ticketOrderItem.createMany({
        data: orders.map((order) => ({
          orderId: order.id,
          tierId: tier.id,
          quantity: ticketsPerLink,
          unitPriceCents: 0,
        })),
      });

      const createdHosts = await tx.ticket.createManyAndReturn({
        data: orders.map((order) => ({
          ticketNumber: buildTicketNumber(order.orderNumber, 0),
          orderId: order.id,
          eventId,
          tierId: tier.id,
          accessLevel: tier.accessLevel,
          qrSecret: generateQrSecret(),
          pricePaidCents: 0,
          status: TicketStatus.VALID,
          linkBatchId: batch.id,
        })),
        select: {
          id: true,
          ticketNumber: true,
          accessTokenVersion: true,
        },
      });
      // Matched back by ticket number rather than by position: nothing promises
      // rows come back in the order they went in.
      const hostByNumber = new Map(
        createdHosts.map((host) => [host.ticketNumber, host]),
      );
      const links = orders.map((order) => {
        const host = hostByNumber.get(buildTicketNumber(order.orderNumber, 0));
        if (!host) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "A ticket in this batch didn't come back from the database.",
          });
        }
        return { order, host };
      });

      if (plusCount > 0) {
        await tx.ticket.createMany({
          data: links.flatMap(({ order, host }) =>
            Array.from({ length: plusCount }, (_, plusIndex) => ({
              // Seat 1 onwards of that person's own order, so a plus one reads
              // as `ATN-4F7K2X-02` beside their `ATN-4F7K2X-01`.
              ticketNumber: buildTicketNumber(order.orderNumber, 1 + plusIndex),
              orderId: order.id,
              eventId,
              tierId: tier.id,
              accessLevel: tier.accessLevel,
              hostTicketId: host.id,
              qrSecret: generateQrSecret(),
              pricePaidCents: 0,
              status: TicketStatus.VALID,
              linkBatchId: batch.id,
            })),
          ),
        });
      }

      await recordDirectSale(tx, tier.id, ticketCount);
      await maybeMarkSoldOut(tx, eventId);

      return {
        id: batch.id,
        eventId,
        tierId: tier.id,
        tierName: tier.name,
        label: trimmedLabel,
        primaryCount,
        plusCount,
        ticketCount,
        createdAt: batch.createdAt,
        createdByUserId: issuedByUserId,
        // Nothing has happened to a batch nobody has been sent yet.
        use: { claimed: 0, arrived: 0 },
        links: links.map(({ host }) => ({
          ticketId: host.id,
          ticketNumber: host.ticketNumber,
          ticketUrl: ticketUrl(ticketAccessToken(host)),
          attendeeName: null,
          admittedAt: null,
        })),
      };
    },
    { timeout: 60_000 },
  );
}

/**
 * Claimed and arrived counts for a set of batches, in two queries rather than
 * two per batch. Batches with neither simply don't come back.
 */
async function readBatchUse(
  batchIds: string[],
): Promise<Map<string, TicketLinkBatchUse>> {
  const use = new Map<string, TicketLinkBatchUse>();
  if (batchIds.length === 0) return use;

  const bump = (
    id: string | null,
    key: keyof TicketLinkBatchUse,
    n: number,
  ) => {
    if (!id) return;
    const current = use.get(id) ?? { claimed: 0, arrived: 0 };
    current[key] = n;
    use.set(id, current);
  };

  const [claimed, arrived] = await Promise.all([
    db.ticket.groupBy({
      by: ["linkBatchId"],
      where: {
        linkBatchId: { in: batchIds },
        status: TicketStatus.VALID,
        NOT: { attendeeName: null },
      },
      _count: { _all: true },
    }),
    db.ticket.groupBy({
      by: ["linkBatchId"],
      where: {
        linkBatchId: { in: batchIds },
        scans: { some: { result: { in: [...ADMITTING_RESULTS] } } },
      },
      _count: { _all: true },
    }),
  ]);

  for (const row of claimed) bump(row.linkBatchId, "claimed", row._count._all);
  for (const row of arrived) bump(row.linkBatchId, "arrived", row._count._all);
  return use;
}

export async function listTicketLinkBatches(
  eventId: string,
): Promise<Omit<IssuedTicketLinkBatch, "links">[]> {
  const batches = await db.ticketLinkBatch.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      eventId: true,
      tierId: true,
      label: true,
      primaryCount: true,
      plusCount: true,
      createdAt: true,
      createdByUserId: true,
      tier: { select: { name: true } },
    },
  });

  const use = await readBatchUse(batches.map((batch) => batch.id));

  return batches.map((batch) => ({
    id: batch.id,
    eventId: batch.eventId,
    tierId: batch.tierId,
    tierName: batch.tier.name,
    label: batch.label,
    primaryCount: batch.primaryCount,
    plusCount: batch.plusCount,
    ticketCount: batch.primaryCount * (1 + batch.plusCount),
    createdAt: batch.createdAt,
    createdByUserId: batch.createdByUserId,
    use: use.get(batch.id) ?? { claimed: 0, arrived: 0 },
  }));
}

export async function getTicketLinkBatch(
  batchId: string,
): Promise<IssuedTicketLinkBatch> {
  const batch = await db.ticketLinkBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      eventId: true,
      tierId: true,
      label: true,
      primaryCount: true,
      plusCount: true,
      createdAt: true,
      createdByUserId: true,
      tier: { select: { name: true } },
      tickets: {
        where: { hostTicketId: null, status: TicketStatus.VALID },
        orderBy: { ticketNumber: "asc" },
        select: {
          id: true,
          ticketNumber: true,
          accessTokenVersion: true,
          attendeeName: true,
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
  if (!batch) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That batch isn't here any more.",
    });
  }

  const use = await readBatchUse([batch.id]);

  return {
    id: batch.id,
    eventId: batch.eventId,
    tierId: batch.tierId,
    tierName: batch.tier.name,
    label: batch.label,
    primaryCount: batch.primaryCount,
    plusCount: batch.plusCount,
    ticketCount: batch.primaryCount * (1 + batch.plusCount),
    createdAt: batch.createdAt,
    createdByUserId: batch.createdByUserId,
    use: use.get(batch.id) ?? { claimed: 0, arrived: 0 },
    links: batch.tickets.map((ticket) => ({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketUrl: ticketUrl(ticketAccessToken(ticket)),
      attendeeName: ticket.attendeeName,
      admittedAt: ticket.scans[0]?.createdAt ?? null,
    })),
  };
}

/**
 * Delete a batch, every ticket in it, and the order it was issued through.
 *
 * A batch is one act — "twenty links for the press list" — and undoing it has
 * to be one act too, or you are left picking twenty tickets out of a list of
 * four hundred. The tickets go through the same path a single delete does, so
 * seats come back, wallet registrations are dropped, and an event that sold out
 * on them opens again.
 *
 * The order goes with them. It was minted for this batch alone, it has no money
 * on it, and left behind it would show in the orders list as a paid order with
 * nothing in it.
 */
export async function deleteTicketLinkBatch(batchId: string): Promise<{
  label: string | null;
  tierName: string;
  ticketsDeleted: number;
  use: TicketLinkBatchUse;
}> {
  const batch = await db.ticketLinkBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      label: true,
      tier: { select: { name: true } },
      tickets: { select: { id: true } },
      orders: { select: { id: true } },
    },
  });
  if (!batch) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That batch isn't here any more.",
    });
  }

  const use = (await readBatchUse([batch.id])).get(batch.id) ?? {
    claimed: 0,
    arrived: 0,
  };

  // Held now: deleting the batch sets `linkBatchId` to null on its orders, so
  // after that they can no longer be found from here.
  const orderIds = batch.orders.map((order) => order.id);

  const deleted = await deleteTickets(batch.tickets.map((ticket) => ticket.id));

  await db.ticketLinkBatch.delete({ where: { id: batch.id } });

  // The orders were minted for these links and nothing else, so once the
  // tickets are gone they are empty rows that would otherwise show in the
  // orders list as paid orders with nothing on them. Anything that somehow
  // still has a ticket stays.
  const empty = await db.ticketOrder.findMany({
    where: { id: { in: orderIds }, tickets: { none: {} } },
    select: { id: true },
  });
  if (empty.length > 0) {
    await db.ticketOrder.deleteMany({
      where: { id: { in: empty.map((order) => order.id) } },
    });
  }

  return {
    label: batch.label,
    tierName: batch.tier.name,
    ticketsDeleted: deleted.length,
    use,
  };
}
