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
  generateOrderNumber,
} from "~/server/ticketing/numbering";
import { maybeMarkSoldOut, ticketAccessToken } from "~/server/ticketing/orders";
import { generateQrSecret } from "~/server/ticketing/qr";
import { ticketUrl } from "~/server/ticketing/urls";

export const MAX_PRIMARY_LINKS = 100;
export const MAX_PLUS_PER_LINK = 10;

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
  links: {
    ticketId: string;
    ticketNumber: string;
    ticketUrl: string;
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
  const orderNumber = await generateOrderNumber();

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

      const order = await tx.ticketOrder.create({
        data: {
          orderNumber,
          eventId,
          status: TicketOrderStatus.PAID,
          paymentMethod: PaymentMethodKind.ADMIN,
          paidAt: new Date(),
          soldByUserId: issuedByUserId,
          notes: trimmedLabel,
          termsVersion: event.termsVersion,
          termsAcceptedAt: new Date(),
          items: {
            create: {
              tierId: tier.id,
              quantity: ticketCount,
              unitPriceCents: 0,
            },
          },
        },
        select: { id: true, orderNumber: true },
      });

      const batch = await tx.ticketLinkBatch.create({
        data: {
          eventId,
          tierId: tier.id,
          orderId: order.id,
          label: trimmedLabel,
          primaryCount,
          plusCount,
          createdByUserId: issuedByUserId,
        },
        select: { id: true, createdAt: true },
      });

      const createdHosts = await tx.ticket.createManyAndReturn({
        data: Array.from({ length: primaryCount }, (_, index) => ({
          ticketNumber: buildTicketNumber(
            order.orderNumber,
            index * ticketsPerLink,
          ),
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
      const hostByNumber = new Map(
        createdHosts.map((host) => [host.ticketNumber, host]),
      );
      const hosts = Array.from({ length: primaryCount }, (_, index) => {
        const ticketNumber = buildTicketNumber(
          order.orderNumber,
          index * ticketsPerLink,
        );
        const host = hostByNumber.get(ticketNumber);
        if (!host) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "A ticket in this batch didn't come back from the database.",
          });
        }
        return host;
      });

      if (plusCount > 0) {
        await tx.ticket.createMany({
          data: hosts.flatMap((host, index) =>
            Array.from({ length: plusCount }, (_, plusIndex) => ({
              ticketNumber: buildTicketNumber(
                order.orderNumber,
                index * ticketsPerLink + 1 + plusIndex,
              ),
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
        links: hosts.map((host) => ({
          ticketId: host.id,
          ticketNumber: host.ticketNumber,
          ticketUrl: ticketUrl(ticketAccessToken(host)),
        })),
      };
    },
    { timeout: 60_000 },
  );
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
    links: batch.tickets.map((ticket) => ({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketUrl: ticketUrl(ticketAccessToken(ticket)),
    })),
  };
}
