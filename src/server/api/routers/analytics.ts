import { z } from "zod";

import {
  Prisma,
  TicketEventStatus,
  type PaymentMethodKind,
} from "~Prisma/client";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  BOUGHT_ORDER,
  ONLINE_ORDER,
  VISIT,
} from "~/server/ticketing/order-sql";
import {
  campaignResults,
  NO_RESULTS,
} from "~/server/ticketing/campaign-results";
import { salesByDaysOut } from "~/server/ticketing/lead-time";
import { checkoutJourney } from "~/server/ticketing/journey";
import { declineReport } from "~/server/ticketing/declines";
import {
  CAMPAIGN_SOURCE_LABELS,
  CAMPAIGN_TYPE_LABELS,
  campaignSourceOf,
  campaignTypeOf,
} from "~/lib/ticketing/campaigns";
import { toCsv } from "~/lib/csv";
import { eventDayKey } from "~/lib/ticketing/dates";
import { formatNZD } from "~/lib/ticketing/money";
import { sumDoorTotals } from "~/lib/ticketing/door-totals";

/**
 * Analytics across events: the admin Analytics page. Where the event
 * dashboard reads one event, this reads every event at once, so the patterns
 * that only show over many nights can be seen: when in the week people buy,
 * how far out, which kind of campaign sells, how events compare.
 *
 * Everything is scoped the same way, by which events rather than which
 * dates: the patterns want all the data there is, and a date range belongs
 * on the event page. Aggregation stays in SQL, as on the event dashboard.
 */

const SCOPES = ["all", "past", "upcoming"] as const;

const scopeInput = z.object({
  scope: z.enum(SCOPES).default("all"),
  /** Only events on or after this moment. */
  from: z.date().optional(),
  /** Only events up to this moment. */
  to: z.date().optional(),
  /** Narrow to these events within the scope. Empty means all of them. */
  eventIds: z.array(z.string()).max(500).default([]),
});

type ScopeInput = z.infer<typeof scopeInput>;

/** The scope as SQL over `ticket_event e`. Drafts and cancelled events never count. */
function scopeSql(input: ScopeInput): Prisma.Sql {
  const clauses = [Prisma.sql`e.status NOT IN ('DRAFT', 'CANCELLED')`];
  if (input.scope === "past") clauses.push(Prisma.sql`e."startsAt" < now()`);
  if (input.scope === "upcoming") {
    clauses.push(Prisma.sql`e."startsAt" >= now()`);
  }
  if (input.from) clauses.push(Prisma.sql`e."startsAt" >= ${input.from}`);
  if (input.to) clauses.push(Prisma.sql`e."startsAt" <= ${input.to}`);
  if (input.eventIds.length > 0) {
    clauses.push(Prisma.sql`e.id IN (${Prisma.join(input.eventIds)})`);
  }
  return Prisma.join(clauses, " AND ");
}

/** The same scope for Prisma queries. */
function scopeWhere(input: ScopeInput): Prisma.TicketEventWhereInput {
  const now = new Date();
  const startsAt: Prisma.DateTimeFilter = {};
  if (input.scope === "past") startsAt.lt = now;
  if (input.scope === "upcoming") startsAt.gte = now;
  if (input.from && (!startsAt.gte || input.from > startsAt.gte)) {
    startsAt.gte = input.from;
  }
  if (input.to) startsAt.lte = input.to;
  return {
    status: { notIn: [TicketEventStatus.DRAFT, TicketEventStatus.CANCELLED] },
    ...(Object.keys(startsAt).length > 0 ? { startsAt } : {}),
    ...(input.eventIds.length > 0 ? { id: { in: input.eventIds } } : {}),
  };
}

const PAID = Prisma.sql`o.status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')`;

const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : null;

const byId = <T extends { id: string }>(rows: T[]) =>
  new Map(rows.map((row) => [row.id, row]));

/**
 * One row per event with everything the comparison table and the headline
 * need. Six grouped queries rather than one per event: forty events is forty
 * round trips otherwise.
 */
async function eventRows(db: Prisma.TransactionClient, input: ScopeInput) {
  const scope = scopeSql(input);
  const [events, orders, tickets, admitted, views, buyers] = await Promise.all([
    db.ticketEvent.findMany({
      where: scopeWhere(input),
      orderBy: { startsAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        startsAt: true,
        timezone: true,
        capacity: true,
        venueHireCents: true,
        doorTotals: true,
        tiers: {
          select: {
            priceCents: true,
            groupSize: true,
            allocation: true,
            soldCount: true,
            sortOrder: true,
          },
        },
        costs: { select: { amountCents: true } },
        campaigns: { select: { spendCents: true } },
      },
    }),
    db.$queryRaw<
      {
        id: string;
        orders: number;
        netCents: number;
        abandoned: number;
        optIns: number;
        firstSaleAt: Date | null;
      }[]
    >`
      SELECT
        e.id,
        COUNT(o.id) FILTER (WHERE ${BOUGHT_ORDER})::int AS orders,
        COALESCE(SUM(o."totalCents" - o."refundedCents") FILTER (WHERE ${PAID}), 0)::int AS "netCents",
        COUNT(o.id) FILTER (WHERE o.status IN ('EXPIRED', 'CANCELLED', 'FAILED'))::int AS abandoned,
        COUNT(o.id) FILTER (WHERE ${BOUGHT_ORDER} AND o."marketingOptIn")::int AS "optIns",
        MIN(o."paidAt") FILTER (WHERE ${BOUGHT_ORDER}) AS "firstSaleAt"
      FROM "ticket_event" e
      JOIN "ticket_order" o ON o."eventId" = e.id
      WHERE ${scope}
      GROUP BY e.id
    `,
    db.$queryRaw<{ id: string; issued: number; comped: number }[]>`
      SELECT
        e.id,
        COUNT(*) FILTER (WHERE t.status = 'VALID')::int AS issued,
        COUNT(*) FILTER (WHERE t.status = 'VALID' AND t."isComp")::int AS comped
      FROM "ticket_event" e
      JOIN "ticket" t ON t."eventId" = e.id
      WHERE ${scope}
      GROUP BY e.id
    `,
    // Tickets through the door and not since reverted or departed, as
    // `admittedCount` counts for one event.
    db.$queryRaw<{ id: string; admitted: number }[]>`
      SELECT e.id, COUNT(DISTINCT s."ticketId")::int AS admitted
      FROM "ticket_event" e
      JOIN "ticket_scan" s ON s."eventId" = e.id
      WHERE ${scope}
        AND s.result IN ('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY')
        AND NOT EXISTS (
          SELECT 1 FROM "ticket_scan" r
          WHERE r."ticketId" = s."ticketId"
            AND r.result IN ('ADMISSION_REVERTED', 'DEPARTED')
            AND r."createdAt" > s."createdAt"
        )
      GROUP BY e.id
    `,
    db.$queryRaw<{ id: string; views: number }[]>`
      SELECT e.id, COUNT(v.id)::int AS views
      FROM "ticket_event" e
      JOIN "ticket_event_view" v ON v."eventId" = e.id
      WHERE ${scope}
      GROUP BY e.id
    `,
    // Who bought for each event, and how many of them had bought for an
    // earlier one. Any earlier event counts, scoped or not: a returning
    // buyer is returning regardless of what the page is looking at.
    db.$queryRaw<{ id: string; buyers: number; returning: number }[]>`
      SELECT b.id, COUNT(*)::int AS buyers, COUNT(*) FILTER (WHERE b.returning)::int AS returning
      FROM (
        SELECT
          e.id,
          lower(o."buyerEmail") AS email,
          bool_or(EXISTS (
            SELECT 1 FROM "ticket_order" p
            WHERE lower(p."buyerEmail") = lower(o."buyerEmail")
              AND p."eventId" <> o."eventId"
              AND p.status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
              AND p."paymentMethod" NOT IN ('COMP', 'ADMIN', 'LIFETIME')
              AND p."paidAt" < o."paidAt"
          )) AS returning
        FROM "ticket_event" e
        JOIN "ticket_order" o ON o."eventId" = e.id
        WHERE ${scope} AND ${BOUGHT_ORDER} AND o."buyerEmail" IS NOT NULL
        GROUP BY 1, 2
      ) b
      GROUP BY b.id
    `,
  ]);

  const orderStats = byId(orders);
  const ticketStats = byId(tickets);
  const admittedStats = byId(admitted);
  const viewStats = byId(views);
  const buyerStats = byId(buyers);
  const now = Date.now();

  return events.map((event) => {
    const o = orderStats.get(event.id);
    const t = ticketStats.get(event.id);
    const b = buyerStats.get(event.id);
    const allocation = event.tiers.reduce(
      (sum, tier) => sum + tier.allocation,
      0,
    );
    const capacity = event.capacity ?? allocation;
    const issued = t?.issued ?? 0;
    const comped = t?.comped ?? 0;
    const offPlatform = sumDoorTotals(event.doorTotals);
    const sold = issued - comped + offPlatform.tickets;
    const netCents = (o?.netCents ?? 0) + offPlatform.revenueCents;
    const campaignSpendCents = event.campaigns.reduce(
      (sum, campaign) => sum + campaign.spendCents,
      0,
    );
    const costsCents =
      (event.venueHireCents ?? 0) +
      event.costs.reduce((sum, cost) => sum + cost.amountCents, 0) +
      campaignSpendCents;
    const orderCount = o?.orders ?? 0;
    const abandoned = o?.abandoned ?? 0;
    const admittedCount = admittedStats.get(event.id)?.admitted ?? 0;
    const past = event.startsAt.getTime() < now;

    return {
      id: event.id,
      name: event.name,
      slug: event.slug,
      status: event.status,
      startsAt: event.startsAt,
      timezone: event.timezone,
      past,
      capacity,
      issued,
      sold,
      comped,
      /** Of the room, comps included: the same figure as the event page. */
      percentSold: percent(issued + offPlatform.tickets, capacity) ?? 0,
      offPlatform,
      netCents,
      costsCents,
      profitCents: netCents - costsCents,
      campaignSpendCents,
      orders: orderCount,
      abandoned,
      checkoutConversion: percent(orderCount, orderCount + abandoned),
      views: viewStats.get(event.id)?.views ?? 0,
      admitted: admittedCount,
      /** Only once the night has happened; before that it's a row of zeros. */
      attendanceRate: past ? percent(admittedCount, issued) : null,
      avgTicketCents: sold > 0 ? Math.round(netCents / sold) : null,
      optIns: o?.optIns ?? 0,
      buyers: b?.buyers ?? 0,
      returning: b?.returning ?? 0,
      firstSaleAt: o?.firstSaleAt ?? null,
      /** For the price points, worked out on the client. */
      tiers: event.tiers,
    };
  });
}

type EventRow = Awaited<ReturnType<typeof eventRows>>[number];

const CSV_COLUMNS: [string, (row: EventRow) => string][] = [
  ["Event", (row) => row.name],
  ["Date", (row) => eventDayKey(row.startsAt, row.timezone)],
  ["Status", (row) => row.status],
  ["Capacity", (row) => String(row.capacity)],
  ["Sold", (row) => String(row.sold)],
  ["Comped", (row) => String(row.comped)],
  ["% of room", (row) => String(row.percentSold)],
  ["Net revenue", (row) => formatNZD(row.netCents)],
  ["Costs", (row) => formatNZD(row.costsCents)],
  ["Profit", (row) => formatNZD(row.profitCents)],
  ["Campaign spend", (row) => formatNZD(row.campaignSpendCents)],
  [
    "Average ticket",
    (row) => (row.avgTicketCents === null ? "" : formatNZD(row.avgTicketCents)),
  ],
  ["Page views", (row) => String(row.views)],
  ["Orders", (row) => String(row.orders)],
  [
    "Checkout conversion %",
    (row) =>
      row.checkoutConversion === null ? "" : String(row.checkoutConversion),
  ],
  ["Admitted", (row) => String(row.admitted)],
  [
    "Attendance %",
    (row) => (row.attendanceRate === null ? "" : String(row.attendanceRate)),
  ],
  ["Buyers", (row) => String(row.buyers)],
  ["Returning buyers", (row) => String(row.returning)],
  ["Marketing opt-ins", (row) => String(row.optIns)],
  [
    "First sale",
    (row) =>
      row.firstSaleAt ? eventDayKey(row.firstSaleAt, row.timezone) : "",
  ],
];

/**
 * One row per bought order in scope: when it was paid in its event's clock,
 * how many tickets, and what they were worth at face value. The timing charts
 * all read from this.
 */
const boughtOrders = (scope: Prisma.Sql) => Prisma.sql`
  SELECT
    o.id,
    (o."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE e.timezone AS local,
    COUNT(t.id)::int AS tickets,
    COALESCE(SUM(t."pricePaidCents"), 0)::int AS "revenueCents"
  FROM "ticket_order" o
  JOIN "ticket_event" e ON e.id = o."eventId"
  LEFT JOIN "ticket" t ON t."orderId" = o.id AND t."isComp" = false
  WHERE ${scope} AND ${BOUGHT_ORDER}
  GROUP BY o.id, e.timezone
`;

type Measured = { orders: number; tickets: number; revenueCents: number };

export const analyticsRouter = createTRPCRouter({
  /** The events the picker offers for a scope. */
  eventOptions: adminProcedure
    .input(scopeInput.omit({ eventIds: true }))
    .query(({ ctx, input }) =>
      ctx.db.ticketEvent.findMany({
        where: scopeWhere({ ...input, eventIds: [] }),
        orderBy: { startsAt: "desc" },
        select: { id: true, name: true, startsAt: true, timezone: true },
      }),
    ),

  /** The comparison table, and the headline numbers summed from it. */
  events: adminProcedure.input(scopeInput).query(async ({ ctx, input }) => {
    const [rows, [repeat]] = await Promise.all([
      eventRows(ctx.db, input),
      // Buyers who bought for more than one event in scope.
      ctx.db.$queryRaw<{ buyers: number; repeat: number }[]>`
        SELECT COUNT(*)::int AS buyers, COUNT(*) FILTER (WHERE x.events > 1)::int AS repeat
        FROM (
          SELECT lower(o."buyerEmail") AS email, COUNT(DISTINCT o."eventId") AS events
          FROM "ticket_event" e
          JOIN "ticket_order" o ON o."eventId" = e.id
          WHERE ${scopeSql(input)} AND ${BOUGHT_ORDER} AND o."buyerEmail" IS NOT NULL
          GROUP BY 1
        ) x
      `,
    ]);
    return { rows, buyers: repeat ?? { buyers: 0, repeat: 0 } };
  }),

  /**
   * When people buy: by hour of the week, by days before doors, by month, and
   * when they turn up relative to doors.
   */
  timing: adminProcedure.input(scopeInput).query(async ({ ctx, input }) => {
    const scope = scopeSql(input);
    const sales = boughtOrders(scope);

    const [weekHours, months, daysOut, arrivals] = await Promise.all([
      // 1 is Monday. Each order sits in its own event's zone: a 9pm sale
      // belongs to that evening wherever the event is.
      ctx.db.$queryRaw<({ day: number; hour: number } & Measured)[]>`
        SELECT
          extract(isodow FROM s.local)::int AS day,
          extract(hour FROM s.local)::int AS hour,
          COUNT(*)::int AS orders,
          SUM(s.tickets)::int AS tickets,
          SUM(s."revenueCents")::int AS "revenueCents"
        FROM (${sales}) s
        GROUP BY 1, 2
      `,
      // Calendar months in the event's zone, returned as midnight UTC on
      // the first, so the client labels them in UTC.
      ctx.db.$queryRaw<({ month: Date } & Measured)[]>`
        SELECT
          date_trunc('month', s.local) AS month,
          SUM(s.orders)::int AS orders,
          SUM(s.tickets)::int AS tickets,
          SUM(s."revenueCents")::int AS "revenueCents"
        FROM (
          SELECT local, 1 AS orders, tickets, "revenueCents" FROM (${sales}) platform
          UNION ALL
          SELECT
            e."startsAt" AT TIME ZONE e.timezone AS local,
            0 AS orders,
            d."cashTickets" + d."eftposTickets" AS tickets,
            d."cashCents" + d."eftposCents" AS "revenueCents"
          FROM "event_door_totals" d
          JOIN "ticket_event" e ON e.id = d."eventId"
          WHERE ${scope}
        ) s
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      salesByDaysOut(ctx.db, scope),
      // First admission per ticket in 15-minute slots from doors, held to
      // two hours before and six after so one stray scan can't stretch the
      // axis across a day.
      ctx.db.$queryRaw<{ slot: number; count: number }[]>`
        SELECT
          GREATEST(-8, LEAST(24, floor(extract(epoch FROM (f.first_at - f.doors)) / 900)))::int AS slot,
          COUNT(*)::int AS count
        FROM (
          SELECT MIN(s."createdAt") AS first_at, MIN(COALESCE(e."doorsAt", e."startsAt")) AS doors
          FROM "ticket_scan" s
          JOIN "ticket_event" e ON e.id = s."eventId"
          WHERE ${scope}
            AND s."ticketId" IS NOT NULL
            AND s.result IN ('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY')
          GROUP BY s."ticketId"
        ) f
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ]);

    // Days out, summed across events. Sparse; the client buckets them.
    const byDay = new Map<number, Measured & { days: number }>();
    for (const row of daysOut) {
      const day = byDay.get(row.days) ?? {
        days: row.days,
        orders: 0,
        tickets: 0,
        revenueCents: 0,
      };
      day.orders += row.orders;
      day.tickets += row.tickets;
      day.revenueCents += row.revenueCents;
      byDay.set(row.days, day);
    }

    return {
      weekHours,
      months,
      leadTime: [...byDay.values()].sort((a, b) => b.days - a.days),
      arrivals,
    };
  }),

  /**
   * Which campaigns sell: by type, by where they run, and the best of them.
   * Checkouts, paid and views come from every tagged order and visit in
   * scope, campaign row or not, so hand-made links still count under
   * "Other"; spend and clicks can only come from campaign rows.
   */
  campaigns: adminProcedure.input(scopeInput).query(async ({ ctx, input }) => {
    const scope = scopeSql(input);
    const [orders, views, campaigns] = await Promise.all([
      ctx.db.$queryRaw<
        {
          source: string | null;
          medium: string | null;
          checkouts: number;
          paid: number;
          revenueCents: number;
        }[]
      >`
        SELECT
          o."utmSource" AS source,
          o."utmMedium" AS medium,
          COUNT(DISTINCT ${VISIT})::int AS checkouts,
          COUNT(DISTINCT ${VISIT}) FILTER (WHERE ${BOUGHT_ORDER})::int AS paid,
          COALESCE(SUM(o."totalCents" - o."refundedCents") FILTER (WHERE ${BOUGHT_ORDER}), 0)::int AS "revenueCents"
        FROM "ticket_event" e
        JOIN "ticket_order" o ON o."eventId" = e.id
        WHERE ${scope} AND ${ONLINE_ORDER}
        GROUP BY 1, 2
      `,
      ctx.db.$queryRaw<
        { source: string | null; medium: string | null; views: number }[]
      >`
        SELECT v."utmSource" AS source, v."utmMedium" AS medium, COUNT(*)::int AS views
        FROM "ticket_event" e
        JOIN "ticket_event_view" v ON v."eventId" = e.id
        WHERE ${scope}
        GROUP BY 1, 2
      `,
      // A campaign without an event counts orders on any event, so it's in
      // every scope.
      ctx.db.campaign.findMany({
        where: { OR: [{ eventId: null }, { event: scopeWhere(input) }] },
        select: {
          id: true,
          name: true,
          source: true,
          medium: true,
          content: true,
          spendCents: true,
          startsAt: true,
          endsAt: true,
          event: { select: { id: true, name: true } },
          shortLink: { select: { id: true, slug: true } },
        },
      }),
    ]);
    const results = await campaignResults(
      ctx.db,
      campaigns.map((campaign) => campaign.id),
    );

    type Group = {
      key: string;
      label: string;
      views: number;
      checkouts: number;
      paid: number;
      revenueCents: number;
      spendCents: number;
      clicks: number;
      campaigns: number;
    };
    const tagged = <T extends { source: string | null; medium: string | null }>(
      row: T,
    ) => row.source !== null || row.medium !== null;

    function groupBy<K extends string>(
      keyOf: (tags: { source: string | null; medium: string | null }) => K,
      labels: Record<K, string>,
    ) {
      const groups = new Map<K, Group>();
      const group = (key: K) => {
        const found = groups.get(key);
        if (found) return found;
        const made: Group = {
          key,
          label: labels[key],
          views: 0,
          checkouts: 0,
          paid: 0,
          revenueCents: 0,
          spendCents: 0,
          clicks: 0,
          campaigns: 0,
        };
        groups.set(key, made);
        return made;
      };
      for (const row of orders.filter(tagged)) {
        const g = group(keyOf(row));
        g.checkouts += row.checkouts;
        g.paid += row.paid;
        g.revenueCents += row.revenueCents;
      }
      for (const row of views.filter(tagged))
        group(keyOf(row)).views += row.views;
      for (const campaign of campaigns) {
        const g = group(keyOf(campaign));
        g.spendCents += campaign.spendCents;
        g.clicks += results.get(campaign.id)?.clicks ?? 0;
        g.campaigns += 1;
      }
      return [...groups.values()].sort(
        (a, b) =>
          b.revenueCents - a.revenueCents ||
          b.paid - a.paid ||
          b.checkouts - a.checkouts,
      );
    }

    const direct = orders
      .filter((row) => !tagged(row))
      .reduce(
        (sum, row) => ({
          checkouts: sum.checkouts + row.checkouts,
          paid: sum.paid + row.paid,
          revenueCents: sum.revenueCents + row.revenueCents,
        }),
        { checkouts: 0, paid: 0, revenueCents: 0 },
      );

    return {
      byType: groupBy(
        (tags) => campaignTypeOf(tags.medium),
        CAMPAIGN_TYPE_LABELS,
      ),
      bySource: groupBy(
        (tags) => campaignSourceOf(tags.source),
        CAMPAIGN_SOURCE_LABELS,
      ),
      /** Checkouts that arrived with no tags at all. */
      direct,
      top: campaigns
        .map((campaign) => ({
          ...campaign,
          type: campaignTypeOf(campaign.medium),
          results: results.get(campaign.id) ?? NO_RESULTS,
        }))
        .sort(
          (a, b) =>
            b.results.revenueCents - a.results.revenueCents ||
            b.results.paid - a.results.paid ||
            b.results.checkouts - a.results.checkouts,
        )
        .slice(0, 10),
    };
  }),

  /**
   * The checkout journey through every event in scope: who saw a page, added
   * a ticket, pressed hold and pay, paid and named their tickets, and how
   * long each step typically took.
   */
  funnel: adminProcedure
    .input(scopeInput)
    .query(({ ctx, input }) => checkoutJourney(ctx.db, scopeSql(input))),

  /**
   * Declined payments across every event in scope: how many, why, whether
   * the buyer came back and paid, and any payment taken without tickets.
   */
  declines: adminProcedure
    .input(scopeInput)
    .query(({ ctx, input }) => declineReport(ctx.db, scopeSql(input))),

  /** Who buys: how many at once, on what, and how they paid. */
  buyers: adminProcedure.input(scopeInput).query(async ({ ctx, input }) => {
    const scope = scopeSql(input);
    const bought = Prisma.sql`${scope} AND ${BOUGHT_ORDER}`;

    const [sizes, devices, paidWith] = await Promise.all([
      // Four and up share a bar: nobody needs eleven bars for one group booking.
      ctx.db.$queryRaw<{ size: number; orders: number }[]>`
        SELECT LEAST(tickets, 4)::int AS size, COUNT(*)::int AS orders
        FROM (
          SELECT COUNT(t.id) AS tickets
          FROM "ticket_event" e
          JOIN "ticket_order" o ON o."eventId" = e.id
          JOIN "ticket" t ON t."orderId" = o.id
          WHERE ${bought}
          GROUP BY o.id
        ) per_order
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      // Orders from before devices were recorded have none and are left out.
      ctx.db.$queryRaw<
        {
          device: string;
          os: string | null;
          paidWith: string | null;
          paymentMethod: PaymentMethodKind;
          orders: number;
        }[]
      >`
        SELECT o.device, o.os, o."paidWith", o."paymentMethod", COUNT(*)::int AS orders
        FROM "ticket_event" e
        JOIN "ticket_order" o ON o."eventId" = e.id
        WHERE ${bought} AND o.device IS NOT NULL
        GROUP BY 1, 2, 3, 4
      `,
      // The wallet or card Stripe saw, else cash, eftpos, tap to pay or free.
      ctx.db.$queryRaw<
        {
          paidWith: string | null;
          paymentMethod: PaymentMethodKind;
          orders: number;
        }[]
      >`
        SELECT o."paidWith", o."paymentMethod", COUNT(*)::int AS orders
        FROM "ticket_event" e
        JOIN "ticket_order" o ON o."eventId" = e.id
        WHERE ${bought}
        GROUP BY 1, 2
      `,
    ]);

    return { sizes, devices, paidWith };
  }),

  /** The comparison table as a file. */
  exportCsv: adminProcedure.input(scopeInput).query(async ({ ctx, input }) => {
    const rows = await eventRows(ctx.db, input);
    return {
      filename: `events-${eventDayKey(new Date())}.csv`,
      csv: toCsv([
        CSV_COLUMNS.map(([header]) => header),
        ...rows.map((row) => CSV_COLUMNS.map(([, cell]) => cell(row))),
      ]),
    };
  }),
});
