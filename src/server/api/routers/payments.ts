import { z } from "zod";

import {
  PaymentMethodKind,
  TicketOrderStatus,
  type Prisma,
  type PrismaClient,
} from "~Prisma/client";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { toCsv } from "~/lib/csv";
import { PAYMENT_RANGES, paymentRangeStart } from "~/lib/payments";
import { paymentMethodLabel } from "~/lib/ticketing/payment-methods";
import { stripePaymentUrl } from "~/server/stripe";

/**
 * Every payment the site has taken, for the admin's Payments page: ticket
 * orders that moved money, and donations. Comps, free tickets, admin links and
 * lifetime passes are zero-value, so they are not payments and never appear.
 * Merch is sold through Shopify and is not here either.
 *
 * Amounts follow the event dashboard: gross is what was charged, net is gross
 * less refunds. A refund counts against the period of the payment it undoes.
 */

/** The ways a ticket order takes money, in the order the page lists them. */
const TAKING_METHODS = [
  PaymentMethodKind.STRIPE,
  PaymentMethodKind.TAP_TO_PAY,
  PaymentMethodKind.TERMINAL,
  PaymentMethodKind.CASH,
];

const PAID_STATUSES = [
  TicketOrderStatus.PAID,
  TicketOrderStatus.PARTIALLY_REFUNDED,
  TicketOrderStatus.REFUNDED,
];

const rangeInput = z.object({ range: z.enum(PAYMENT_RANGES) });

const orderWhere = (since: Date | null): Prisma.TicketOrderWhereInput => ({
  status: { in: PAID_STATUSES },
  paymentMethod: { in: TAKING_METHODS },
  totalCents: { gt: 0 },
  paidAt: since ? { gte: since } : { not: null },
});

const donationWhere = (since: Date | null): Prisma.DonationWhereInput =>
  since ? { paidAt: { gte: since } } : {};

const ORDER_ROW = {
  id: true,
  orderNumber: true,
  buyerName: true,
  buyerEmail: true,
  paymentMethod: true,
  totalCents: true,
  refundedCents: true,
  paidAt: true,
  stripePaymentIntentId: true,
  event: { select: { id: true, name: true } },
} satisfies Prisma.TicketOrderSelect;

const DONATION_ROW = {
  id: true,
  donorName: true,
  donorEmail: true,
  amountCents: true,
  refundedCents: true,
  paidAt: true,
  stripePaymentIntentId: true,
  gig: { select: { id: true, title: true } },
} satisfies Prisma.DonationSelect;

/** One payment, whichever kind, as the list and the export show it. */
type PaymentRow = {
  id: string;
  source: "tickets" | "donation";
  paidAt: Date;
  /** The event or gig it was for. */
  forLabel: string;
  /** The order number. Null on a donation. */
  reference: string | null;
  name: string | null;
  email: string | null;
  method: string;
  amountCents: number;
  refundedCents: number;
  /** Where it lives in the admin. Null on a donation to a deleted gig. */
  href: string | null;
  stripeUrl: string | null;
};

function orderRow(
  order: Prisma.TicketOrderGetPayload<{ select: typeof ORDER_ROW }>,
): PaymentRow {
  return {
    id: order.id,
    source: "tickets",
    // `orderWhere` only admits paid orders, which all carry `paidAt`.
    paidAt: order.paidAt ?? new Date(0),
    forLabel: order.event.name,
    reference: order.orderNumber,
    name: order.buyerName,
    email: order.buyerEmail,
    method: paymentMethodLabel(order.paymentMethod),
    amountCents: order.totalCents,
    refundedCents: order.refundedCents,
    href: `/admin/events/${order.event.id}`,
    stripeUrl: order.stripePaymentIntentId
      ? stripePaymentUrl(order.stripePaymentIntentId)
      : null,
  };
}

function donationRow(
  donation: Prisma.DonationGetPayload<{ select: typeof DONATION_ROW }>,
): PaymentRow {
  return {
    id: donation.id,
    source: "donation",
    paidAt: donation.paidAt,
    forLabel: donation.gig?.title ?? "Deleted gig",
    reference: null,
    name: donation.donorName,
    email: donation.donorEmail,
    method: "Donation",
    amountCents: donation.amountCents,
    refundedCents: donation.refundedCents,
    href: donation.gig ? `/admin/gigs/${donation.gig.id}` : null,
    stripeUrl: stripePaymentUrl(donation.stripePaymentIntentId),
  };
}

const newestFirst = (a: PaymentRow, b: PaymentRow) =>
  b.paidAt.getTime() - a.paidAt.getTime();

export const paymentsRouter = createTRPCRouter({
  /** Everything the Payments page draws for one range. */
  overview: adminProcedure.input(rangeInput).query(async ({ ctx, input }) => {
    const since = paymentRangeStart(input.range);
    const orders = orderWhere(since);
    const donations = donationWhere(since);

    const [byMethod, donated, byEvent, byGig, latestOrders, latestDonations] =
      await Promise.all([
        ctx.db.ticketOrder.groupBy({
          by: ["paymentMethod"],
          where: orders,
          _sum: { totalCents: true, refundedCents: true },
          _count: { _all: true },
        }),
        ctx.db.donation.aggregate({
          where: donations,
          _sum: { amountCents: true, refundedCents: true },
          _count: { _all: true },
        }),
        ctx.db.ticketOrder.groupBy({
          by: ["eventId"],
          where: orders,
          _sum: { totalCents: true, refundedCents: true },
        }),
        ctx.db.donation.groupBy({
          by: ["gigId"],
          where: donations,
          _sum: { amountCents: true, refundedCents: true },
        }),
        ctx.db.ticketOrder.findMany({
          where: orders,
          orderBy: { paidAt: "desc" },
          take: 10,
          select: ORDER_ROW,
        }),
        ctx.db.donation.findMany({
          where: donations,
          orderBy: { paidAt: "desc" },
          take: 10,
          select: DONATION_ROW,
        }),
      ]);

    const donationGross = donated._sum.amountCents ?? 0;
    const donationRefunded = donated._sum.refundedCents ?? 0;
    const methods = [
      ...TAKING_METHODS.map((method) => {
        const group = byMethod.find((row) => row.paymentMethod === method);
        const gross = group?._sum.totalCents ?? 0;
        const refunded = group?._sum.refundedCents ?? 0;
        return {
          key: method,
          label:
            method === PaymentMethodKind.STRIPE
              ? "Online tickets"
              : paymentMethodLabel(method),
          count: group?._count._all ?? 0,
          grossCents: gross,
          refundedCents: refunded,
          netCents: gross - refunded,
        };
      }),
      {
        key: "DONATION" as const,
        label: "Donations",
        count: donated._count._all,
        grossCents: donationGross,
        refundedCents: donationRefunded,
        netCents: donationGross - donationRefunded,
      },
    ];

    const sum = (pick: (row: (typeof methods)[number]) => number) =>
      methods.reduce((total, row) => total + pick(row), 0);
    const grossCents = sum((row) => row.grossCents);
    const netCents = sum((row) => row.netCents);
    const count = sum((row) => row.count);
    // Donations are given online, so they count with online tickets.
    const onlineCents = methods
      .filter((row) => row.key === "STRIPE" || row.key === "DONATION")
      .reduce((total, row) => total + row.netCents, 0);

    return {
      totals: {
        grossCents,
        refundedCents: grossCents - netCents,
        netCents,
        count,
        averageCents: count ? Math.round(grossCents / count) : 0,
        /** Share of net taken online, 0 to 100. Null with nothing taken. */
        onlinePercent:
          netCents > 0 ? Math.round((onlineCents / netCents) * 100) : null,
        donationCents: donationGross - donationRefunded,
      },
      methods,
      nights: await nightsFor(ctx.db, byEvent, byGig),
      latest: [
        ...latestOrders.map(orderRow),
        ...latestDonations.map(donationRow),
      ]
        .sort(newestFirst)
        .slice(0, 10),
    };
  }),

  /** Every payment in the range, newest first, as a CSV. */
  exportCsv: adminProcedure.input(rangeInput).query(async ({ ctx, input }) => {
    const since = paymentRangeStart(input.range);
    const [orders, donations] = await Promise.all([
      ctx.db.ticketOrder.findMany({
        where: orderWhere(since),
        select: ORDER_ROW,
      }),
      ctx.db.donation.findMany({
        where: donationWhere(since),
        select: DONATION_ROW,
      }),
    ]);
    const rows = [...orders.map(orderRow), ...donations.map(donationRow)].sort(
      newestFirst,
    );
    const money = (cents: number) => (cents / 100).toFixed(2);

    return {
      filename: `atmos-payments-${input.range}.csv`,
      csv: toCsv([
        [
          "Paid",
          "Source",
          "For",
          "Order",
          "Name",
          "Email",
          "Method",
          "Amount",
          "Refunded",
          "Stripe",
        ],
        ...rows.map((row) => [
          row.paidAt.toISOString(),
          row.source === "donation" ? "Donation" : "Tickets",
          row.forLabel,
          row.reference ?? "",
          row.name ?? "",
          row.email ?? "",
          row.method,
          money(row.amountCents),
          money(row.refundedCents),
          row.stripeUrl ?? "",
        ]),
      ]),
    };
  }),
});

/**
 * Takings per night: an event's ticket sales and its gig's donations on one
 * row, newest night first. An event with no gig stands alone, and so does a
 * gig that took donations without selling tickets here.
 */
async function nightsFor(
  db: PrismaClient,
  byEvent: {
    eventId: string;
    _sum: { totalCents: number | null; refundedCents: number | null };
  }[],
  byGig: {
    gigId: string | null;
    _sum: { amountCents: number | null; refundedCents: number | null };
  }[],
) {
  const events = await db.ticketEvent.findMany({
    where: { id: { in: byEvent.map((row) => row.eventId) } },
    select: { id: true, name: true, startsAt: true, gigId: true },
  });
  const gigs = await db.gig.findMany({
    where: {
      id: {
        in: [
          ...byGig.flatMap((row) => row.gigId ?? []),
          ...events.flatMap((event) => event.gigId ?? []),
        ],
      },
    },
    select: {
      id: true,
      title: true,
      gigStartTime: true,
      donationsEnabled: true,
    },
  });
  const gigById = new Map(gigs.map((gig) => [gig.id, gig]));

  type Night = {
    key: string;
    title: string;
    date: Date | null;
    href: string | null;
    ticketsCents: number;
    donationsCents: number;
    /** False on a night with donations switched off, shown as "off". */
    donationsEnabled: boolean;
  };
  const nights = new Map<string, Night>();
  const nightFor = (key: string, make: () => Omit<Night, "key">) => {
    let night = nights.get(key);
    if (!night) {
      night = { key, ...make() };
      nights.set(key, night);
    }
    return night;
  };
  const gigNight = (gigId: string) => {
    const gig = gigById.get(gigId);
    return nightFor(`gig:${gigId}`, () => ({
      title: gig?.title ?? "Deleted gig",
      date: gig?.gigStartTime ?? null,
      href: `/admin/gigs/${gigId}`,
      ticketsCents: 0,
      donationsCents: 0,
      donationsEnabled: gig?.donationsEnabled ?? false,
    }));
  };

  for (const row of byEvent) {
    const event = events.find((candidate) => candidate.id === row.eventId);
    if (!event) continue;
    const night = event.gigId
      ? gigNight(event.gigId)
      : nightFor(`event:${event.id}`, () => ({
          title: event.name,
          date: event.startsAt,
          href: `/admin/events/${event.id}`,
          ticketsCents: 0,
          donationsCents: 0,
          donationsEnabled: false,
        }));
    night.ticketsCents +=
      (row._sum.totalCents ?? 0) - (row._sum.refundedCents ?? 0);
  }
  for (const row of byGig) {
    const night = row.gigId
      ? gigNight(row.gigId)
      : nightFor("gig:deleted", () => ({
          title: "Deleted gigs",
          date: null,
          href: null,
          ticketsCents: 0,
          donationsCents: 0,
          donationsEnabled: true,
        }));
    night.donationsCents +=
      (row._sum.amountCents ?? 0) - (row._sum.refundedCents ?? 0);
  }

  return [...nights.values()].sort(
    (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0),
  );
}
