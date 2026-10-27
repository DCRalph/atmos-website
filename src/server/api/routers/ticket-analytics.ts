import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  PaymentMethodKind,
  Prisma,
  TicketOrderStatus,
  TicketScanResult,
  TicketStatus,
} from "~Prisma/client";
import { createTRPCRouter, eventOrganiserProcedure } from "~/server/api/trpc";
import { admittedCount, departedCount } from "~/server/ticketing/scan";
import { compAccounting } from "~/server/ticketing/comps";
import {
  BOUGHT_ORDER,
  ONLINE_ORDER,
  VISIT,
} from "~/server/ticketing/order-sql";
import { ticketTypeName } from "~/lib/ticketing/access-levels";
import { sumDoorTotals } from "~/lib/ticketing/door-totals";
import { pastEventsPace } from "~/server/ticketing/lead-time";
import { checkoutJourney } from "~/server/ticketing/journey";
import { declineReport } from "~/server/ticketing/declines";
import { paceOnAxis } from "~/lib/ticketing/pace";
import { campaignTypeOf } from "~/lib/ticketing/campaigns";
import {
  moveUnsoldToDoor,
  remainingInTier,
  soldFaceValueCents,
} from "~/lib/ticketing/tiers";
import {
  gstComponentCents,
  venueFeePerTicketCents,
} from "~/lib/ticketing/money";
import { toCsv } from "~/lib/csv";
import {
  CHANNELS,
  LEAD_TIMES,
  TICKET_CHANNELS,
  type TicketChannel,
  headcountTimeline,
  leadTime,
  ticketChannel,
} from "~/lib/ticketing/event-summary";
import {
  ANALYTICS_RANGES,
  HOUR_MS,
  floorHour,
  rangeStart,
  type AnalyticsRange,
} from "~/lib/analytics-range";
import {
  breakEvenTickets,
  planRevenuePerTicketCents,
  sellOutBreakdown,
} from "~/lib/ticketing/break-even";
import {
  getTicketingSettings,
  resolveBookingFee,
  resolveGstRateBp,
} from "~/server/ticketing/settings";

/**
 * Event analytics: the sales dashboard, and the live view you watch on your
 * phone while people come through the door.
 *
 * Aggregation happens in SQL rather than by pulling rows into JS — an event
 * with 2,000 tickets and 6,000 scans should not be paginated through in
 * memory every five seconds.
 */

const ADMIT_RESULTS = "('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY')";

/** Scans that came back wrong: a code that wasn't, or wasn't any more. */
const SCAN_PROBLEMS = new Set<TicketScanResult>([
  TicketScanResult.DUPLICATE,
  TicketScanResult.PREVIOUSLY_DENIED,
  TicketScanResult.INVALID_SIGNATURE,
  TicketScanResult.NOT_FOUND,
  TicketScanResult.WRONG_EVENT,
  TicketScanResult.VOIDED,
  TicketScanResult.REFUNDED_TICKET,
  TicketScanResult.ORDER_UNPAID,
]);

/**
 * The stretch a chart range covers, or null for all time. Ranges end now, or
 * a day after the doors for an event that's been and gone, so "last 7 days"
 * on last month's event shows its final week rather than an empty chart.
 */
function salesWindow(startsAt: Date, range: AnalyticsRange) {
  const until = new Date(
    Math.min(Date.now(), startsAt.getTime() + 24 * HOUR_MS),
  );
  const since = rangeStart(range, until);
  return since ? { since: floorHour(since), until } : null;
}

const paidWithin = (window: ReturnType<typeof salesWindow>) =>
  window
    ? Prisma.sql`AND o."paidAt" >= ${window.since} AND o."paidAt" <= ${window.until}`
    : Prisma.empty;

const rangeInput = z.object({
  eventId: z.string(),
  range: z.enum(ANALYTICS_RANGES).default("all"),
});

async function eventClock(
  db: Prisma.TransactionClient,
  eventId: string,
): Promise<{ timezone: string; startsAt: Date }> {
  const event = await db.ticketEvent.findUnique({
    where: { id: eventId },
    select: { timezone: true, startsAt: true },
  });
  if (!event) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
  }
  return event;
}

export const ticketAnalyticsRouter = createTRPCRouter({
  /** Headline numbers for the event dashboard. */
  overview: eventOrganiserProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.ticketEvent.findUnique({
        where: { id: input.eventId },
        select: {
          id: true,
          name: true,
          capacity: true,
          timezone: true,
          startsAt: true,
          endsAt: true,
          doorTotals: true,
          salesCloseAt: true,
          gstRateBp: true,
          bookingFeeFixedCents: true,
          bookingFeePercentBp: true,
          venueHireCents: true,
          passVenueHire: true,
          costs: { select: { amountCents: true } },
          campaigns: { select: { spendCents: true } },
          tiers: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              priceCents: true,
              groupSize: true,
              allocation: true,
              soldCount: true,
              heldCount: true,
              isActive: true,
              sortOrder: true,
              salesChannel: true,
            },
          },
        },
      });
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      const paidStatuses = [
        TicketOrderStatus.PAID,
        TicketOrderStatus.PARTIALLY_REFUNDED,
        TicketOrderStatus.REFUNDED,
      ];

      const [
        money,
        orderCount,
        ticketsIssued,
        ticketsRefunded,
        admitted,
        byMethod,
      ] = await Promise.all([
        ctx.db.ticketOrder.aggregate({
          where: { eventId: event.id, status: { in: paidStatuses } },
          _sum: {
            subtotalCents: true,
            discountCents: true,
            bookingFeeCents: true,
            venueFeeCents: true,
            totalCents: true,
            refundedCents: true,
          },
        }),
        // Orders somebody actually went through a checkout for. Comps and
        // admin-issued ticket links are minted as paid orders — a batch of
        // twenty links is twenty of them — and counting those as conversions
        // would tell the funnel a story nobody lived. They are still in the
        // money totals (they are worth nothing) and in "how they paid".
        ctx.db.ticketOrder.count({
          where: {
            eventId: event.id,
            status: { in: paidStatuses },
            paymentMethod: {
              notIn: [
                PaymentMethodKind.COMP,
                PaymentMethodKind.ADMIN,
                PaymentMethodKind.LIFETIME,
              ],
            },
          },
        }),
        ctx.db.ticket.count({
          where: { eventId: event.id, status: TicketStatus.VALID },
        }),
        ctx.db.ticket.count({
          where: {
            eventId: event.id,
            status: { in: [TicketStatus.REFUNDED, TicketStatus.VOID] },
          },
        }),
        admittedCount(event.id),
        ctx.db.ticketOrder.groupBy({
          by: ["paymentMethod"],
          where: { eventId: event.id, status: { in: paidStatuses } },
          _sum: { totalCents: true },
          _count: true,
        }),
      ]);

      // Checkouts that reserved stock but never paid — the drop-off rate.
      const abandoned = await ctx.db.ticketOrder.count({
        where: {
          eventId: event.id,
          status: {
            in: [
              TicketOrderStatus.EXPIRED,
              TicketOrderStatus.CANCELLED,
              TicketOrderStatus.FAILED,
            ],
          },
        },
      });

      const [byPaidWith, [gotIn], arrivals, views] = await Promise.all([
        ctx.db.ticketOrder.groupBy({
          by: ["paidWith"],
          where: {
            eventId: event.id,
            status: { in: paidStatuses },
            paidWith: { not: null },
          },
          _count: true,
        }),
        // Bought orders with at least one ticket through the door.
        ctx.db.$queryRaw<{ orders: number }[]>`
          SELECT COUNT(DISTINCT o.id)::int AS orders
          FROM "ticket_scan" s
          JOIN "ticket" t ON t.id = s."ticketId"
          JOIN "ticket_order" o ON o.id = t."orderId"
          WHERE s."eventId" = ${event.id}
            AND s."result" IN ('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY')
            AND ${BOUGHT_ORDER}
        `,
        // First admission per ticket in 15-minute buckets: the shape of the
        // night, without re-entries counting twice.
        ctx.db.$queryRaw<{ bucket: Date; count: number }[]>`
          SELECT
            to_timestamp(floor(extract(epoch FROM first_at) / 900) * 900) AS bucket,
            COUNT(*)::int AS count
          FROM (
            SELECT MIN(s."createdAt") AS first_at
            FROM "ticket_scan" s
            WHERE s."eventId" = ${event.id}
              AND s."result" IN ('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY')
            GROUP BY s."ticketId"
          ) firsts
          GROUP BY 1
          ORDER BY 1 ASC
        `,
        // Visits to the page: where the funnel starts.
        ctx.db.ticketEventView.count({ where: { eventId: event.id } }),
      ]);

      const offPlatform = sumDoorTotals(event.doorTotals);
      const grossCents =
        (money._sum.totalCents ?? 0) + offPlatform.revenueCents;
      const refundedCents = money._sum.refundedCents ?? 0;

      const allocation = event.tiers.reduce((s, t) => s + t.allocation, 0);
      const capacity = event.capacity ?? allocation;

      // Comps sit outside every tier counter, so the tier table alone will not
      // add up to `ticketsIssued`. This is the row that reconciles them.
      const comps = await compAccounting(event.id, ctx.db);

      // Profit and break even. A ticket is worth what sold ones have averaged,
      // net of refunds; before the first sale, what the tier plan would bring.
      const netCents = grossCents - refundedCents;
      const sold = ticketsIssued - comps.issued + offPlatform.tickets;
      const venueHireCents = event.venueHireCents ?? 0;
      const otherCostsCents = event.costs.reduce(
        (sum, cost) => sum + cost.amountCents,
        0,
      );
      const campaignsCents = event.campaigns.reduce(
        (sum, campaign) => sum + campaign.spendCents,
        0,
      );
      const costsCents = venueHireCents + otherCostsCents + campaignsCents;
      const venueFee = venueFeePerTicketCents(event);
      const fee = resolveBookingFee(event, await getTicketingSettings());
      const activeTiers = event.tiers.filter((tier) => tier.isActive);
      const revenuePerTicketCents =
        sold > 0
          ? Math.round(netCents / sold)
          : planRevenuePerTicketCents({
              tiers: activeTiers,
              fee,
              venueFeePerTicket: venueFee,
            });
      // The room less the seats kept for comps, or given as comps if more.
      const sellable = Math.max(
        0,
        capacity - Math.max(comps.allowance ?? 0, comps.issued),
      );
      // What's in, plus every tier's unsold tickets at that tier's price, as
      // far as the sellable room goes.
      const revenueIfSoldOutCents =
        netCents +
        sellOutBreakdown({
          tiers: activeTiers,
          fee,
          venueFeePerTicket: venueFee,
          maxTickets: sellable - sold,
        }).totalCents;

      // GST inside net revenue and the sell out, at the event's rate. Worked
      // out from the net rather than summed off orders, so refunds take
      // their GST with them.
      const gstRateBp = resolveGstRateBp(event);

      return {
        event: {
          id: event.id,
          name: event.name,
          timezone: event.timezone,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          capacity,
        },
        money: {
          grossCents,
          refundedCents,
          netCents,
          offPlatformCents: offPlatform.revenueCents,
          faceValueCents: money._sum.subtotalCents ?? 0,
          discountCents: money._sum.discountCents ?? 0,
          bookingFeeCents: money._sum.bookingFeeCents ?? 0,
          venueFeeCents: money._sum.venueFeeCents ?? 0,
        },
        costs: {
          venueHireCents,
          otherCents: otherCostsCents,
          campaignsCents,
          totalCents: costsCents,
          revenuePerTicketCents,
          breakEvenTickets: breakEvenTickets(costsCents, revenuePerTicketCents),
          sellable,
          profitCents: netCents - costsCents,
          revenueIfSoldOutCents,
          profitIfSoldOutCents: revenueIfSoldOutCents - costsCents,
        },
        gst: {
          netCents: gstComponentCents(netCents, gstRateBp),
          ifSoldOutCents: gstComponentCents(revenueIfSoldOutCents, gstRateBp),
        },
        counts: {
          orders: orderCount,
          abandonedCheckouts: abandoned,
          ticketsIssued,
          ticketsRefunded,
          admitted,
          notArrived: Math.max(0, ticketsIssued - admitted),
          capacity,
          percentSold:
            capacity > 0
              ? Math.round(
                  ((ticketsIssued + offPlatform.tickets) / capacity) * 100,
                )
              : 0,
          attendanceRate:
            ticketsIssued > 0
              ? Math.round((admitted / ticketsIssued) * 100)
              : 0,
          /** Visits to the event page, one per tab. */
          views,
          /** Bought orders with anybody through the door. */
          ordersArrived: gotIn?.orders ?? 0,
          /** Paid ÷ (paid + abandoned). The checkout funnel's bottom step. */
          checkoutConversion:
            orderCount + abandoned > 0
              ? Math.round((orderCount / (orderCount + abandoned)) * 100)
              : null,
          /** Given away. Part of `ticketsIssued`, never part of revenue. */
          comped: comps.issued,
          compAllowance: comps.allowance,
          compsAdmitted: comps.admitted,
          handoutsUnsent: comps.handouts.unsent,
          sold,
          offPlatform: offPlatform.tickets,
        },
        doorTotals: event.doorTotals,
        comps,
        tiers: moveUnsoldToDoor(
          event.tiers,
          event.salesCloseAt,
          new Date(),
        ).map((tier) => ({
          id: tier.id,
          name: tier.name,
          priceCents: tier.priceCents,
          allocation: tier.allocation,
          /** Moved to (+) or from (−) the door when online sales closed. */
          moved: tier.moved,
          sold: tier.soldCount,
          held: tier.heldCount,
          remaining: remainingInTier(tier),
          revenueCents: soldFaceValueCents(tier),
        })),
        byPaymentMethod: byMethod.map((row) => ({
          method: row.paymentMethod,
          orders: row._count,
          totalCents: row._sum.totalCents ?? 0,
        })),
        /** Apple Pay, card, and so on: Stripe orders only, most first. */
        byPaidWith: byPaidWith
          .flatMap((row) =>
            row.paidWith
              ? [{ paidWith: row.paidWith, orders: row._count }]
              : [],
          )
          .sort((a, b) => b.orders - a.orders),
        arrivals,
      };
    }),

  /**
   * The sales curve for a range, as sparse hourly rows; the chart lays them
   * onto its own axis. `baseline` is what sold before the range opened, so the
   * running total starts where it really was rather than at zero.
   *
   * `paidAt` is a UTC timestamp, and truncating to the hour in UTC lands on
   * the same hours as in the event's zone, so no conversion is needed here.
   */
  salesOverTime: eventOrganiserProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      const event = await eventClock(ctx.db, input.eventId);
      const window = salesWindow(event.startsAt, input.range);

      const hours = await ctx.db.$queryRaw<
        { at: Date; tickets: number; revenue_cents: number }[]
      >`
        SELECT
          date_trunc('hour', o."paidAt") AS at,
          COUNT(t.id)::int AS tickets,
          COALESCE(SUM(t."pricePaidCents"), 0)::int AS revenue_cents
        FROM "ticket_order" o
        JOIN "ticket" t ON t."orderId" = o.id
        WHERE o."eventId" = ${input.eventId}
          AND o."paidAt" IS NOT NULL
          ${window ? Prisma.sql`AND o."paidAt" <= ${window.until}` : Prisma.empty}
          -- Giveaways are a count, never a point on a revenue line.
          AND t."isComp" = false
        GROUP BY 1
        ORDER BY 1 ASC
      `;

      // A final tally has no per-sale timestamps. Attribute it to the event,
      // not the day an administrator happened to record or correct it.
      const doorTotals = await ctx.db.eventDoorTotals.findUnique({
        where: { eventId: input.eventId },
      });
      const offPlatform = sumDoorTotals(doorTotals);
      if (offPlatform.tickets > 0 || offPlatform.revenueCents > 0) {
        const at = floorHour(event.startsAt);
        if (!window || at <= window.until) {
          const existing = hours.find(
            (hour) => hour.at.getTime() === at.getTime(),
          );
          if (existing) {
            existing.tickets += offPlatform.tickets;
            existing.revenue_cents += offPlatform.revenueCents;
          } else {
            hours.push({
              at,
              tickets: offPlatform.tickets,
              revenue_cents: offPlatform.revenueCents,
            });
            hours.sort((a, b) => a.at.getTime() - b.at.getTime());
          }
        }
      }

      const baseline = { tickets: 0, revenueCents: 0 };
      const rows: { at: Date; tickets: number; revenueCents: number }[] = [];
      for (const hour of hours) {
        if (window && hour.at < window.since) {
          baseline.tickets += hour.tickets;
          baseline.revenueCents += hour.revenue_cents;
        } else {
          rows.push({
            at: hour.at,
            tickets: hour.tickets,
            revenueCents: hour.revenue_cents,
          });
        }
      }

      // All time runs from the first sale to the last, or to now.
      const end = new Date(
        Math.min(Date.now(), event.startsAt.getTime() + 24 * HOUR_MS),
      );
      const last = rows.at(-1)?.at;
      const from = window?.since ?? rows[0]?.at ?? end;
      const to = window?.until ?? (last && last > end ? last : end);

      // What the average past event had sold by each point on this axis,
      // and the campaigns that went live inside the range.
      const [pace, campaigns] = await Promise.all([
        pastEventsPace(ctx.db, input.eventId),
        ctx.db.campaign.findMany({
          where: {
            eventId: input.eventId,
            startsAt: { not: null, gte: from, lte: to },
          },
          orderBy: { startsAt: "asc" },
          select: { id: true, name: true, medium: true, startsAt: true },
        }),
      ]);

      return {
        timezone: event.timezone,
        from,
        to,
        baseline,
        rows,
        pace:
          pace.events > 0
            ? {
                events: pace.events,
                points: paceOnAxis(pace.points, event.startsAt, from, to),
              }
            : null,
        launches: campaigns.flatMap((campaign) =>
          campaign.startsAt
            ? [
                {
                  id: campaign.id,
                  name: campaign.name,
                  type: campaignTypeOf(campaign.medium),
                  at: campaign.startsAt,
                },
              ]
            : [],
        ),
      };
    }),

  /**
   * Who bought in a range, and how: when in the week, how many at once, and
   * which link brought them.
   */
  buyers: eventOrganiserProcedure
    .input(rangeInput)
    .query(async ({ ctx, input }) => {
      const event = await eventClock(ctx.db, input.eventId);
      const window = salesWindow(event.startsAt, input.range);
      const bought = Prisma.sql`o."eventId" = ${input.eventId} AND ${BOUGHT_ORDER} ${paidWithin(window)}`;

      const [weekHours, sizes, sources, devices] = await Promise.all([
        // 1 is Monday. The stored time is UTC, marked as such, then moved
        // into the event's zone: a 9pm sale belongs to that evening.
        ctx.db.$queryRaw<{ day: number; hour: number; orders: number }[]>`
          SELECT
            extract(isodow FROM local)::int AS day,
            extract(hour FROM local)::int AS hour,
            COUNT(*)::int AS orders
          FROM (
            SELECT (o."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${event.timezone} AS local
            FROM "ticket_order" o
            WHERE ${bought}
          ) sales
          GROUP BY 1, 2
        `,
        // Four and up share a bar: nobody needs eleven bars for one group booking.
        ctx.db.$queryRaw<{ size: number; orders: number }[]>`
          SELECT LEAST(tickets, 4)::int AS size, COUNT(*)::int AS orders
          FROM (
            SELECT COUNT(t.id) AS tickets
            FROM "ticket_order" o
            JOIN "ticket" t ON t."orderId" = o.id
            WHERE ${bought}
            GROUP BY o.id
          ) per_order
          GROUP BY 1
          ORDER BY 1 ASC
        `,
        // Checkouts against sales for each set of tags, online only: a door
        // sale has no link to have come from. Counted in visits, and scoped
        // by when the checkout started so the two share a window.
        ctx.db.$queryRaw<
          {
            source: string | null;
            medium: string | null;
            campaign: string | null;
            content: string | null;
            checkouts: number;
            paid: number;
            revenueCents: number;
          }[]
        >`
          SELECT
            o."utmSource" AS source,
            o."utmMedium" AS medium,
            o."utmCampaign" AS campaign,
            o."utmContent" AS content,
            COUNT(DISTINCT ${VISIT})::int AS checkouts,
            COUNT(DISTINCT ${VISIT}) FILTER (WHERE ${BOUGHT_ORDER})::int AS paid,
            COALESCE(SUM(o."totalCents" - o."refundedCents") FILTER (WHERE ${BOUGHT_ORDER}), 0)::int AS "revenueCents"
          FROM "ticket_order" o
          WHERE o."eventId" = ${input.eventId} AND ${ONLINE_ORDER}
            ${window ? Prisma.sql`AND o."createdAt" >= ${window.since} AND o."createdAt" <= ${window.until}` : Prisma.empty}
          GROUP BY 1, 2, 3, 4
        `,
        // What each order was bought on, against how it was paid. Orders
        // from before devices were recorded have none and are left out.
        ctx.db.$queryRaw<
          {
            device: string | null;
            os: string | null;
            paidWith: string | null;
            paymentMethod: PaymentMethodKind;
            orders: number;
          }[]
        >`
          SELECT o.device, o.os, o."paidWith", o."paymentMethod", COUNT(*)::int AS orders
          FROM "ticket_order" o
          WHERE ${bought} AND o.device IS NOT NULL
          GROUP BY 1, 2, 3, 4
        `,
      ]);

      return {
        weekHours,
        sizes,
        devices,
        sources: sources
          .map((row) => ({ ...row, source: row.source ?? "direct" }))
          .sort((a, b) => b.checkouts - a.checkouts),
      };
    }),

  /**
   * The live door view. Polled every few seconds during an event, so it stays
   * to a handful of cheap aggregate queries.
   */
  live: eventOrganiserProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [sold, admitted, departed, arrivals, byStaff, recent, failures] =
        await Promise.all([
          ctx.db.ticket.count({
            where: { eventId: input.eventId, status: TicketStatus.VALID },
          }),
          admittedCount(input.eventId),
          departedCount(input.eventId),

          // Five-minute arrival buckets for the last six hours.
          ctx.db.$queryRawUnsafe<{ bucket: Date; count: bigint }[]>(
            `
            SELECT
              to_timestamp(floor(extract(epoch FROM s."createdAt") / 300) * 300) AS bucket,
              COUNT(DISTINCT s."ticketId")::bigint AS count
            FROM "ticket_scan" s
            WHERE s."eventId" = $1
              AND s."result" IN ${ADMIT_RESULTS}
              AND s."createdAt" > NOW() - INTERVAL '6 hours'
            GROUP BY 1
            ORDER BY 1 ASC
            `,
            input.eventId,
          ),

          ctx.db.$queryRawUnsafe<
            {
              scannedByUserId: string | null;
              deviceLabel: string | null;
              count: bigint;
            }[]
          >(
            `
            SELECT s."scannedByUserId", s."deviceLabel", COUNT(*)::bigint AS count
            FROM "ticket_scan" s
            WHERE s."eventId" = $1
              AND s."result" IN ${ADMIT_RESULTS}
            GROUP BY 1, 2
            ORDER BY count DESC
            `,
            input.eventId,
          ),

          ctx.db.ticketScan.findMany({
            where: { eventId: input.eventId },
            orderBy: { createdAt: "desc" },
            take: 25,
            select: {
              id: true,
              result: true,
              createdAt: true,
              deviceLabel: true,
              wasOverride: true,
              scannedByUserId: true,
              ticket: {
                select: {
                  ticketNumber: true,
                  attendeeName: true,
                  tier: { select: { name: true } },
                },
              },
            },
          }),

          ctx.db.ticketScan.groupBy({
            by: ["result"],
            where: {
              eventId: input.eventId,
              result: {
                in: [
                  TicketScanResult.DUPLICATE,
                  TicketScanResult.DENIED,
                  TicketScanResult.PREVIOUSLY_DENIED,
                  TicketScanResult.INVALID_SIGNATURE,
                  TicketScanResult.NOT_FOUND,
                  TicketScanResult.WRONG_EVENT,
                  TicketScanResult.VOIDED,
                  TicketScanResult.REFUNDED_TICKET,
                ],
              },
            },
            _count: true,
          }),
        ]);

      const staffIds = [
        ...new Set(
          [
            ...byStaff.map((row) => row.scannedByUserId),
            ...recent.map((row) => row.scannedByUserId),
          ].filter((id): id is string => Boolean(id)),
        ),
      ];
      const staff = await ctx.db.user.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, name: true },
      });
      const nameById = new Map(staff.map((user) => [user.id, user.name]));

      const arrivalBuckets = arrivals.map((row) => ({
        bucket: row.bucket,
        count: Number(row.count),
      }));

      // Arrivals in the last 15 minutes, as a per-minute rate.
      const cutoff = Date.now() - 15 * 60 * 1000;
      const recentArrivals = arrivalBuckets
        .filter((bucket) => bucket.bucket.getTime() >= cutoff)
        .reduce((sum, bucket) => sum + bucket.count, 0);

      return {
        sold,
        admitted,
        departed,
        /**
         * Tickets that have never come through, as opposed to ones that have
         * been and gone. `admitted` excludes departures, so subtracting it
         * alone would count everyone who left as though they never arrived.
         */
        notArrived: Math.max(0, sold - admitted - departed),
        percentIn: sold > 0 ? Math.round((admitted / sold) * 100) : 0,
        arrivalsPerMinute: Number((recentArrivals / 15).toFixed(1)),
        arrivals: arrivalBuckets,
        byStaff: byStaff.map((row) => ({
          name: row.scannedByUserId
            ? (nameById.get(row.scannedByUserId) ?? "Unknown")
            : "Unknown",
          deviceLabel: row.deviceLabel,
          count: Number(row.count),
        })),
        recent: recent.map((scan) => ({
          ...scan,
          scannedByName: scan.scannedByUserId
            ? (nameById.get(scan.scannedByUserId) ?? null)
            : null,
        })),
        problems: failures.map((row) => ({
          result: row.result,
          count: row._count,
        })),
      };
    }),

  /**
   * Sales mode of the live screen: what's happening in checkout right now,
   * today's figures, the latest orders, and a few campaign-wide shares the
   * overview doesn't carry. Polled every ten seconds, so it stays to a
   * handful of aggregate queries.
   */
  salesLive: eventOrganiserProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await eventClock(ctx.db, input.eventId);
      const eventId = input.eventId;
      // Paid today, in the event's own day rather than UTC's.
      const today = Prisma.sql`(o."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${event.timezone} >= date_trunc('day', now() AT TIME ZONE ${event.timezone})`;

      const [
        [flow],
        [holding],
        [orders],
        [todayRow],
        latest,
        sources,
        [typical],
        [shares],
        [returning],
      ] = await Promise.all([
        // Visits that opened the page or put a ticket in a basket lately.
        ctx.db.$queryRaw<{ viewing: number; basket: number }[]>`
          SELECT
            COUNT(*) FILTER (WHERE v."createdAt" >= now() - interval '10 minutes')::int AS viewing,
            COUNT(*) FILTER (WHERE v."firstAddedAt" >= now() - interval '10 minutes')::int AS basket
          FROM "ticket_event_view" v
          WHERE v."eventId" = ${eventId}
        `,
        // Holds with the clock still running, and the tickets they hold.
        ctx.db.$queryRaw<
          { holds: number; tickets: number; nextExpiry: Date | null }[]
        >`
          SELECT
            COUNT(*)::int AS holds,
            COALESCE(SUM(h.tickets), 0)::int AS tickets,
            MIN(h."expiresAt") AS "nextExpiry"
          FROM (
            SELECT
              o."expiresAt",
              (SELECT COALESCE(SUM(i.quantity * i."groupSize"), 0) FROM "ticket_order_item" i WHERE i."orderId" = o.id) AS tickets
            FROM "ticket_order" o
            WHERE o."eventId" = ${eventId} AND o.status = 'PENDING' AND o."expiresAt" > now()
          ) h
        `,
        ctx.db.$queryRaw<
          { paidRecently: number; approvals: number; abandoned: number }[]
        >`
          SELECT
            COUNT(*) FILTER (WHERE ${BOUGHT_ORDER} AND o."paidAt" >= now() - interval '10 minutes')::int AS "paidRecently",
            COUNT(*) FILTER (WHERE o.status = 'AWAITING_APPROVAL')::int AS approvals,
            COUNT(*) FILTER (WHERE o.status IN ('EXPIRED', 'CANCELLED', 'FAILED') AND o."updatedAt" >= now() - interval '1 hour')::int AS abandoned
          FROM "ticket_order" o
          WHERE o."eventId" = ${eventId}
        `,
        ctx.db.$queryRaw<
          {
            tickets: number;
            revenueCents: number;
            lastHour: number;
            lastSaleAt: Date | null;
          }[]
        >`
          SELECT
            COALESCE(SUM(s.tickets) FILTER (WHERE s.today), 0)::int AS tickets,
            COALESCE(SUM(s.net) FILTER (WHERE s.today), 0)::int AS "revenueCents",
            COALESCE(SUM(s.tickets) FILTER (WHERE s."paidAt" >= now() - interval '1 hour'), 0)::int AS "lastHour",
            MAX(s."paidAt") AS "lastSaleAt"
          FROM (
            SELECT
              o."paidAt",
              o."totalCents" - o."refundedCents" AS net,
              (SELECT COUNT(*)::int FROM "ticket" t WHERE t."orderId" = o.id AND t."isComp" = false) AS tickets,
              ${today} AS today
            FROM "ticket_order" o
            WHERE o."eventId" = ${eventId} AND ${BOUGHT_ORDER}
          ) s
        `,
        ctx.db.ticketOrder.findMany({
          where: {
            eventId,
            status: {
              in: [
                TicketOrderStatus.PAID,
                TicketOrderStatus.PARTIALLY_REFUNDED,
                TicketOrderStatus.REFUNDED,
              ],
            },
            paymentMethod: {
              notIn: [
                PaymentMethodKind.COMP,
                PaymentMethodKind.ADMIN,
                PaymentMethodKind.LIFETIME,
              ],
            },
            paidAt: { not: null },
          },
          orderBy: { paidAt: "desc" },
          take: 8,
          select: {
            id: true,
            paidAt: true,
            totalCents: true,
            paidWith: true,
            paymentMethod: true,
            utmSource: true,
            utmMedium: true,
            items: {
              select: {
                quantity: true,
                groupSize: true,
                tier: { select: { name: true } },
              },
            },
          },
        }),
        ctx.db.$queryRaw<
          { source: string | null; medium: string | null; orders: number }[]
        >`
          SELECT o."utmSource" AS source, o."utmMedium" AS medium, COUNT(*)::int AS orders
          FROM "ticket_order" o
          WHERE o."eventId" = ${eventId} AND ${BOUGHT_ORDER} AND ${today}
          GROUP BY 1, 2
          ORDER BY 3 DESC
          LIMIT 4
        `,
        ctx.db.$queryRaw<{ seconds: number | null }[]>`
          SELECT (percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (o."paidAt" - o."createdAt"))))::float AS seconds
          FROM "ticket_order" o
          WHERE o."eventId" = ${eventId} AND ${BOUGHT_ORDER} AND ${ONLINE_ORDER} AND ${today}
        `,
        ctx.db.$queryRaw<
          {
            orders: number;
            optIns: number;
            withDevice: number;
            phones: number;
          }[]
        >`
          SELECT
            COUNT(*)::int AS orders,
            COUNT(*) FILTER (WHERE o."marketingOptIn")::int AS "optIns",
            COUNT(*) FILTER (WHERE o.device IS NOT NULL)::int AS "withDevice",
            COUNT(*) FILTER (WHERE o.device = 'mobile')::int AS phones
          FROM "ticket_order" o
          WHERE o."eventId" = ${eventId} AND ${BOUGHT_ORDER}
        `,
        ctx.db.$queryRaw<{ buyers: number; returning: number }[]>`
          SELECT COUNT(*)::int AS buyers, COUNT(*) FILTER (WHERE b.returning)::int AS returning
          FROM (
            SELECT
              lower(o."buyerEmail") AS email,
              bool_or(EXISTS (
                SELECT 1 FROM "ticket_order" p
                WHERE lower(p."buyerEmail") = lower(o."buyerEmail")
                  AND p."eventId" <> o."eventId"
                  AND p.status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
                  AND p."paymentMethod" NOT IN ('COMP', 'ADMIN', 'LIFETIME')
                  AND p."paidAt" < o."paidAt"
              )) AS returning
            FROM "ticket_order" o
            WHERE o."eventId" = ${eventId} AND ${BOUGHT_ORDER} AND o."buyerEmail" IS NOT NULL
            GROUP BY 1
          ) b
        `,
      ]);

      const share = (part: number, whole: number) =>
        whole > 0 ? Math.round((part / whole) * 100) : null;

      return {
        rightNow: {
          viewing: flow?.viewing ?? 0,
          basket: flow?.basket ?? 0,
          holding: holding?.holds ?? 0,
          ticketsHeld: holding?.tickets ?? 0,
          nextExpiry: holding?.nextExpiry ?? null,
          paid: orders?.paidRecently ?? 0,
          approvals: orders?.approvals ?? 0,
          abandonedLastHour: orders?.abandoned ?? 0,
          /** Median seconds from hold to paid, for today's online orders. */
          typicalCheckoutSeconds: typical?.seconds ?? null,
        },
        today: {
          tickets: todayRow?.tickets ?? 0,
          revenueCents: todayRow?.revenueCents ?? 0,
          lastHour: todayRow?.lastHour ?? 0,
          lastSaleAt: todayRow?.lastSaleAt ?? null,
        },
        latest: latest.flatMap((order) =>
          order.paidAt
            ? [
                {
                  id: order.id,
                  paidAt: order.paidAt,
                  totalCents: order.totalCents,
                  paidWith: order.paidWith,
                  paymentMethod: order.paymentMethod,
                  source: order.utmSource,
                  medium: order.utmMedium,
                  items: order.items.map((item) => ({
                    name: item.tier.name,
                    tickets: item.quantity * item.groupSize,
                  })),
                },
              ]
            : [],
        ),
        sourcesToday: sources,
        shares: {
          optIn: share(shares?.optIns ?? 0, shares?.orders ?? 0),
          phone: share(shares?.phones ?? 0, shares?.withDevice ?? 0),
          returning: share(returning?.returning ?? 0, returning?.buyers ?? 0),
        },
      };
    }),

  /**
   * Doors mode of the live screen, beyond what `live` already carries: who's
   * inside by ticket, door sales, the shape of the night so far, the last
   * five minutes at the door, and the final headcount to expect from past
   * events' no-show rate. Polled every ten seconds beside `live`.
   */
  doorsLive: eventOrganiserProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const eventId = input.eventId;
      const event = await ctx.db.ticketEvent.findUnique({
        where: { id: eventId },
        select: { doorsAt: true, startsAt: true },
      });
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }
      const doors = event.doorsAt ?? event.startsAt;

      const [
        byTier,
        [doorSales],
        [night],
        [idChecks],
        [now],
        nowByDevice,
        [expected],
      ] = await Promise.all([
        ctx.db.$queryRaw<{ label: string; issued: number; inside: number }[]>`
            SELECT x.label, COUNT(*)::int AS issued, COUNT(*) FILTER (WHERE x.inside)::int AS inside
            FROM (
              SELECT
                COALESCE(tr.name, CASE WHEN t."isComp" THEN 'Comps and guest list' ELSE 'Other' END) AS label,
                EXISTS (
                  SELECT 1 FROM "ticket_scan" s
                  WHERE s."ticketId" = t.id
                    AND s.result IN ('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY')
                    AND NOT EXISTS (
                      SELECT 1 FROM "ticket_scan" r
                      WHERE r."ticketId" = t.id
                        AND r.result IN ('ADMISSION_REVERTED', 'DEPARTED')
                        AND r."createdAt" > s."createdAt"
                    )
                ) AS inside
              FROM "ticket" t
              LEFT JOIN "ticket_tier" tr ON tr.id = t."tierId"
              WHERE t."eventId" = ${eventId} AND t.status = 'VALID'
            ) x
            GROUP BY 1
            ORDER BY 3 DESC, 2 DESC
          `,
        // Sold by staff in the last twelve hours: the door, not the website.
        ctx.db.$queryRaw<
          {
            orders: number;
            tickets: number;
            revenueCents: number;
            cash: number;
            tap: number;
            terminal: number;
            recent: number;
          }[]
        >`
            SELECT
              COUNT(*)::int AS orders,
              COALESCE(SUM(d.tickets), 0)::int AS tickets,
              COALESCE(SUM(d.net), 0)::int AS "revenueCents",
              COUNT(*) FILTER (WHERE d."paymentMethod" = 'CASH')::int AS cash,
              COUNT(*) FILTER (WHERE d."paymentMethod" = 'TAP_TO_PAY')::int AS tap,
              COUNT(*) FILTER (WHERE d."paymentMethod" = 'TERMINAL')::int AS terminal,
              COUNT(*) FILTER (WHERE d."paidAt" >= now() - interval '5 minutes')::int AS recent
            FROM (
              SELECT
                o."paymentMethod",
                o."paidAt",
                o."totalCents" - o."refundedCents" AS net,
                (SELECT COUNT(*)::int FROM "ticket" t WHERE t."orderId" = o.id AND t."isComp" = false) AS tickets
              FROM "ticket_order" o
              WHERE o."eventId" = ${eventId} AND ${BOUGHT_ORDER}
                AND o."soldByUserId" IS NOT NULL
                AND o."paidAt" >= now() - interval '12 hours'
            ) d
          `,
        // First admissions: when the first came, when half the room was in,
        // and how long after doors people typically arrive.
        ctx.db.$queryRaw<
          {
            firstAt: Date | null;
            halfAt: Date | null;
            avgSeconds: number | null;
            reentries: number;
            overrides: number;
          }[]
        >`
            WITH firsts AS (
              SELECT MIN(s."createdAt") AS at
              FROM "ticket_scan" s
              WHERE s."eventId" = ${eventId}
                AND s."ticketId" IS NOT NULL
                AND s.result IN ('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY')
              GROUP BY s."ticketId"
            )
            SELECT
              (SELECT MIN(at) FROM firsts) AS "firstAt",
              (
                SELECT at FROM firsts ORDER BY at
                OFFSET GREATEST(0, CEIL((SELECT COUNT(*) FROM "ticket" t WHERE t."eventId" = ${eventId} AND t.status = 'VALID') / 2.0)::int - 1)
                LIMIT 1
              ) AS "halfAt",
              (SELECT AVG(extract(epoch FROM (at - ${doors}::timestamp)))::float FROM firsts) AS "avgSeconds",
              (SELECT COUNT(*)::int FROM "ticket_scan" s WHERE s."eventId" = ${eventId} AND s.result = 'REENTRY') AS reentries,
              (SELECT COUNT(*)::int FROM "ticket_scan" s WHERE s."eventId" = ${eventId} AND s."wasOverride") AS overrides
          `,
        ctx.db.$queryRaw<{ checks: number; refused: number }[]>`
            SELECT COUNT(*)::int AS checks, COUNT(*) FILTER (WHERE c.result <> 'PASS')::int AS refused
            FROM "id_check" c
            WHERE c."eventId" = ${eventId}
          `,
        ctx.db.$queryRaw<
          {
            scanned: number;
            letIn: number;
            turnedAway: number;
            departed: number;
          }[]
        >`
            SELECT
              COUNT(*)::int AS scanned,
              COUNT(*) FILTER (WHERE s.result IN ('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY'))::int AS "letIn",
              COUNT(*) FILTER (WHERE s.result IN ('DUPLICATE', 'DENIED', 'PREVIOUSLY_DENIED', 'INVALID_SIGNATURE', 'NOT_FOUND', 'WRONG_EVENT', 'VOIDED', 'REFUNDED_TICKET', 'ORDER_UNPAID'))::int AS "turnedAway",
              COUNT(*) FILTER (WHERE s.result = 'DEPARTED')::int AS departed
            FROM "ticket_scan" s
            WHERE s."eventId" = ${eventId} AND s."createdAt" >= now() - interval '5 minutes'
          `,
        ctx.db.$queryRaw<
          {
            scannedByUserId: string | null;
            deviceLabel: string | null;
            count: number;
          }[]
        >`
            SELECT s."scannedByUserId", s."deviceLabel", COUNT(*)::int AS count
            FROM "ticket_scan" s
            WHERE s."eventId" = ${eventId}
              AND s."createdAt" >= now() - interval '5 minutes'
              AND s.result IN ('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY')
            GROUP BY 1, 2
            ORDER BY 3 DESC
          `,
        // How much of a past event's room turned up, pooled across them.
        ctx.db.$queryRaw<{ rate: number | null; events: number }[]>`
            SELECT (SUM(a.admitted)::float / NULLIF(SUM(a.issued), 0)) AS rate, COUNT(*)::int AS events
            FROM (
              SELECT
                (SELECT COUNT(*) FROM "ticket" t WHERE t."eventId" = e.id AND t.status = 'VALID') AS issued,
                (SELECT COUNT(DISTINCT s."ticketId") FROM "ticket_scan" s WHERE s."eventId" = e.id AND s.result IN ('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY')) AS admitted
              FROM "ticket_event" e
              WHERE e.id <> ${eventId}
                AND e."startsAt" < now() - interval '1 day'
                AND e.status NOT IN ('DRAFT', 'CANCELLED')
            ) a
            WHERE a.issued > 0 AND a.admitted > 0
          `,
      ]);

      const staff = await ctx.db.user.findMany({
        where: {
          id: {
            in: nowByDevice.flatMap((row) =>
              row.scannedByUserId ? [row.scannedByUserId] : [],
            ),
          },
        },
        select: { id: true, name: true },
      });
      const nameById = new Map(staff.map((user) => [user.id, user.name]));

      return {
        byTier,
        doorSales: doorSales ?? {
          orders: 0,
          tickets: 0,
          revenueCents: 0,
          cash: 0,
          tap: 0,
          terminal: 0,
          recent: 0,
        },
        night: {
          firstAt: night?.firstAt ?? null,
          halfAt: night?.halfAt ?? null,
          avgArrivalSeconds: night?.avgSeconds ?? null,
          reentries: night?.reentries ?? 0,
          overrides: night?.overrides ?? 0,
          idChecks: idChecks?.checks ?? 0,
          idRefused: idChecks?.refused ?? 0,
        },
        now: {
          scanned: now?.scanned ?? 0,
          letIn: now?.letIn ?? 0,
          turnedAway: now?.turnedAway ?? 0,
          departed: now?.departed ?? 0,
          byDevice: nowByDevice.map((row) => ({
            name: row.scannedByUserId
              ? (nameById.get(row.scannedByUserId) ?? "Unknown")
              : "Unknown",
            deviceLabel: row.deviceLabel,
            count: row.count,
          })),
        },
        /** Share of a past event's tickets that came through, pooled. */
        expected: {
          rate: expected?.rate ?? null,
          events: expected?.events ?? 0,
        },
      };
    }),

  /**
   * The post-event summary: where every ticket went out (online, the door,
   * given away), each tier's sell-through and turn-up, the night's headcount,
   * trouble at the door, who worked it, and how far ahead people bought. The
   * money and costs come from `overview`, so the two pages always agree.
   *
   * "Came" here is anyone ever let in whose admission wasn't undone, which
   * unlike `admittedCount` still counts the people who have since gone home.
   */
  summary: eventOrganiserProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const eventId = input.eventId;
      const event = await ctx.db.ticketEvent.findUnique({
        where: { id: eventId },
        select: {
          timezone: true,
          doorsAt: true,
          startsAt: true,
          endsAt: true,
          doorTotals: true,
          tiers: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              priceCents: true,
              groupSize: true,
              allocation: true,
              salesChannel: true,
            },
          },
        },
      });
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }
      const doors = event.doorsAt ?? event.startsAt;

      const [
        ticketRows,
        orderRows,
        scans,
        scanRows,
        overrides,
        idChecks,
        scansByStaff,
        salesByStaff,
        leadRows,
        [buyers],
      ] = await Promise.all([
        ctx.db.$queryRaw<
          {
            tierId: string | null;
            paymentMethod: PaymentMethodKind;
            atDoor: boolean;
            isComp: boolean;
            tickets: number;
            came: number;
            faceValueCents: number;
          }[]
        >`
          WITH came AS (
            SELECT DISTINCT s."ticketId" AS id
            FROM "ticket_scan" s
            WHERE s."eventId" = ${eventId}
              AND s."ticketId" IS NOT NULL
              AND s.result IN ${Prisma.raw(ADMIT_RESULTS)}
              AND NOT EXISTS (
                SELECT 1 FROM "ticket_scan" r
                WHERE r."ticketId" = s."ticketId"
                  AND r.result = 'ADMISSION_REVERTED'
                  AND r."createdAt" > s."createdAt"
              )
          )
          SELECT
            t."tierId",
            o."paymentMethod",
            (o."soldByUserId" IS NOT NULL) AS "atDoor",
            t."isComp",
            COUNT(*)::int AS tickets,
            COUNT(c.id)::int AS came,
            COALESCE(SUM(t."pricePaidCents"), 0)::int AS "faceValueCents"
          FROM "ticket" t
          JOIN "ticket_order" o ON o.id = t."orderId"
          LEFT JOIN came c ON c.id = t.id
          WHERE t."eventId" = ${eventId} AND t.status = 'VALID'
          GROUP BY 1, 2, 3, 4
        `,
        ctx.db.$queryRaw<
          {
            paymentMethod: PaymentMethodKind;
            atDoor: boolean;
            orders: number;
            netCents: number;
          }[]
        >`
          SELECT
            o."paymentMethod",
            (o."soldByUserId" IS NOT NULL) AS "atDoor",
            COUNT(*)::int AS orders,
            COALESCE(SUM(o."totalCents" - o."refundedCents"), 0)::int AS "netCents"
          FROM "ticket_order" o
          WHERE o."eventId" = ${eventId}
            AND o.status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
          GROUP BY 1, 2
        `,
        ctx.db.ticketScan.findMany({
          where: {
            eventId,
            ticketId: { not: null },
            result: {
              in: [
                TicketScanResult.ADMITTED,
                TicketScanResult.OVERRIDE_ADMITTED,
                TicketScanResult.REENTRY,
                TicketScanResult.DEPARTED,
                TicketScanResult.ADMISSION_REVERTED,
              ],
            },
          },
          orderBy: { createdAt: "asc" },
          select: { ticketId: true, result: true, createdAt: true },
        }),
        ctx.db.$queryRaw<
          {
            result: TicketScanResult;
            denyReason: string | null;
            count: number;
          }[]
        >`
          SELECT s.result, s."denyReason", COUNT(*)::int AS count
          FROM "ticket_scan" s
          WHERE s."eventId" = ${eventId}
          GROUP BY 1, 2
        `,
        ctx.db.ticketScan.count({ where: { eventId, wasOverride: true } }),
        ctx.db.idCheck.groupBy({
          by: ["result"],
          where: { eventId },
          _count: true,
        }),
        ctx.db.$queryRaw<{ userId: string; scans: number }[]>`
          SELECT s."scannedByUserId" AS "userId", COUNT(*)::int AS scans
          FROM "ticket_scan" s
          WHERE s."eventId" = ${eventId}
            AND s."scannedByUserId" IS NOT NULL
            AND s.result IN ${Prisma.raw(ADMIT_RESULTS)}
          GROUP BY 1
        `,
        ctx.db.$queryRaw<
          {
            userId: string;
            orders: number;
            tickets: number;
            netCents: number;
          }[]
        >`
          SELECT
            o."soldByUserId" AS "userId",
            COUNT(*)::int AS orders,
            COALESCE(SUM((
              SELECT COUNT(*) FROM "ticket" t
              WHERE t."orderId" = o.id AND t.status = 'VALID'
            )), 0)::int AS tickets,
            COALESCE(SUM(o."totalCents" - o."refundedCents"), 0)::int AS "netCents"
          FROM "ticket_order" o
          WHERE o."eventId" = ${eventId}
            AND o."soldByUserId" IS NOT NULL
            AND ${BOUGHT_ORDER}
          GROUP BY 1
        `,
        // Hours before doors each bought ticket was paid for; bucketed below.
        ctx.db.$queryRaw<{ hours: number; tickets: number }[]>`
          SELECT
            floor(extract(epoch FROM (${doors}::timestamp - o."paidAt")) / 3600)::int AS hours,
            COUNT(*)::int AS tickets
          FROM "ticket" t
          JOIN "ticket_order" o ON o.id = t."orderId"
          WHERE t."eventId" = ${eventId}
            AND t.status = 'VALID'
            AND t."isComp" = false
            AND ${BOUGHT_ORDER}
          GROUP BY 1
        `,
        // Returning means they bought for an event that started before this.
        ctx.db.$queryRaw<
          { buyers: number; returning: number; optedIn: number }[]
        >`
          SELECT
            COUNT(DISTINCT lower(o."buyerEmail"))::int AS buyers,
            COUNT(DISTINCT lower(o."buyerEmail")) FILTER (
              WHERE EXISTS (
                SELECT 1
                FROM "ticket_order" p
                JOIN "ticket_event" e ON e.id = p."eventId"
                WHERE lower(p."buyerEmail") = lower(o."buyerEmail")
                  AND p."eventId" <> o."eventId"
                  AND e."startsAt" < ${event.startsAt}::timestamp
                  AND p.status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
              )
            )::int AS returning,
            COUNT(DISTINCT lower(o."buyerEmail")) FILTER (
              WHERE o."marketingOptIn"
            )::int AS "optedIn"
          FROM "ticket_order" o
          WHERE o."eventId" = ${eventId}
            AND o."buyerEmail" IS NOT NULL
            AND ${BOUGHT_ORDER}
        `,
      ]);

      // Every ticket, order and dollar by channel. Off-platform door takings
      // have no orders or scans behind them, only the totals typed in.
      const channels = new Map<
        TicketChannel,
        {
          orders: number | null;
          tickets: number;
          netCents: number;
          came: number | null;
        }
      >();
      const add = (
        channel: TicketChannel,
        row: {
          orders?: number;
          tickets?: number;
          netCents?: number;
          came?: number;
        },
      ) => {
        const totals = channels.get(channel) ?? {
          orders: 0,
          tickets: 0,
          netCents: 0,
          came: 0,
        };
        channels.set(channel, {
          orders: (totals.orders ?? 0) + (row.orders ?? 0),
          tickets: totals.tickets + (row.tickets ?? 0),
          netCents: totals.netCents + (row.netCents ?? 0),
          came: (totals.came ?? 0) + (row.came ?? 0),
        });
      };
      for (const row of ticketRows) add(ticketChannel(row), row);
      for (const row of orderRows) {
        add(ticketChannel({ ...row, isComp: false }), row);
      }
      const door = event.doorTotals;
      if (door) {
        channels.set("OFF_PLATFORM_CASH", {
          orders: null,
          tickets: door.cashTickets,
          netCents: door.cashCents,
          came: null,
        });
        channels.set("OFF_PLATFORM_EFTPOS", {
          orders: null,
          tickets: door.eftposTickets,
          netCents: door.eftposCents,
          came: null,
        });
      }

      // Each tier split by where it sold. Comps and lifetime passes come from
      // no tier, so they sit on a row of their own.
      const blankSplit = () => ({
        online: 0,
        door: 0,
        given: 0,
        tickets: 0,
        came: 0,
        faceValueCents: 0,
      });
      const byTier = new Map(
        event.tiers.map((tier) => [tier.id, blankSplit()]),
      );
      const untiered = blankSplit();
      for (const row of ticketRows) {
        const split =
          (row.tierId ? byTier.get(row.tierId) : undefined) ?? untiered;
        split[CHANNELS[ticketChannel(row)].group] += row.tickets;
        split.tickets += row.tickets;
        split.came += row.came;
        split.faceValueCents += row.faceValueCents;
      }

      // The night, from first admissions and the running headcount.
      const headcount = headcountTimeline(
        scans.flatMap((scan) =>
          scan.ticketId
            ? [
                {
                  ticketId: scan.ticketId,
                  result: scan.result,
                  at: scan.createdAt,
                },
              ]
            : [],
        ),
      );
      const firstIn = new Map<string, Date>();
      for (const scan of scans) {
        if (
          scan.ticketId &&
          scan.result !== TicketScanResult.DEPARTED &&
          scan.result !== TicketScanResult.ADMISSION_REVERTED &&
          !firstIn.has(scan.ticketId)
        ) {
          firstIn.set(scan.ticketId, scan.createdAt);
        }
      }
      const arrivals = [...firstIn.values()];
      const avgArrivalSeconds =
        arrivals.length > 0
          ? arrivals.reduce(
              (sum, at) => sum + (at.getTime() - doors.getTime()) / 1000,
              0,
            ) / arrivals.length
          : null;

      const scanCount = (result: TicketScanResult) =>
        scanRows
          .filter((row) => row.result === result)
          .reduce((sum, row) => sum + row.count, 0);
      const refusals = scanRows
        .filter((row) => row.result === TicketScanResult.DENIED)
        .map((row) => ({ reason: row.denyReason, count: row.count }))
        .sort((a, b) => b.count - a.count);
      const problems = scanRows
        .filter((row) => SCAN_PROBLEMS.has(row.result))
        .map((row) => ({ result: row.result, count: row.count }))
        .sort((a, b) => b.count - a.count);

      const staffIds = [
        ...new Set([
          ...scansByStaff.map((row) => row.userId),
          ...salesByStaff.map((row) => row.userId),
        ]),
      ];
      const users = await ctx.db.user.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, name: true },
      });
      const nameById = new Map(users.map((user) => [user.id, user.name]));
      const staff = staffIds
        .map((id) => {
          const sales = salesByStaff.find((row) => row.userId === id);
          return {
            id,
            name: nameById.get(id) ?? "Unknown",
            admitted: scansByStaff.find((row) => row.userId === id)?.scans ?? 0,
            doorOrders: sales?.orders ?? 0,
            doorTickets: sales?.tickets ?? 0,
            doorNetCents: sales?.netCents ?? 0,
          };
        })
        .sort(
          (a, b) => b.admitted + b.doorTickets - (a.admitted + a.doorTickets),
        );

      const leadTimes = new Map(LEAD_TIMES.map((bucket) => [bucket.key, 0]));
      for (const row of leadRows) {
        const key = leadTime(row.hours);
        leadTimes.set(key, (leadTimes.get(key) ?? 0) + row.tickets);
      }

      return {
        event: {
          timezone: event.timezone,
          /** Past its end, or its start when it has none. */
          over: (event.endsAt ?? event.startsAt).getTime() < Date.now(),
        },
        channels: TICKET_CHANNELS.flatMap((channel) => {
          const totals = channels.get(channel);
          return totals && (totals.tickets > 0 || totals.netCents > 0)
            ? [{ channel, ...CHANNELS[channel], ...totals }]
            : [];
        }),
        tiers: event.tiers.map((tier) => ({
          ...tier,
          ...byTier.get(tier.id)!,
        })),
        untiered,
        night: {
          headcount: headcount.points,
          peak: headcount.peak,
          firstAt: arrivals[0] ?? null,
          lastAt: arrivals.at(-1) ?? null,
          halfAt: arrivals[Math.ceil(arrivals.length / 2) - 1] ?? null,
          avgArrivalSeconds,
          reentries: scanCount(TicketScanResult.REENTRY),
          departures: scanCount(TicketScanResult.DEPARTED),
          reverted: scanCount(TicketScanResult.ADMISSION_REVERTED),
          overrides,
        },
        door: {
          refusals,
          refusalsUndone: scanCount(TicketScanResult.DENIAL_REVERTED),
          problems,
          idChecks: idChecks
            .map((row) => ({ result: row.result, count: row._count }))
            .sort((a, b) => b.count - a.count),
        },
        staff,
        leadTimes: LEAD_TIMES.map((bucket) => ({
          ...bucket,
          tickets: leadTimes.get(bucket.key) ?? 0,
        })),
        buyers: buyers ?? { buyers: 0, returning: 0, optedIn: 0 },
      };
    }),

  /** The checkout journey for one event, with how long each step took. */
  journey: eventOrganiserProcedure
    .input(z.object({ eventId: z.string() }))
    .query(({ ctx, input }) =>
      checkoutJourney(ctx.db, Prisma.sql`e.id = ${input.eventId}`),
    ),

  /** Declined payments for one event. See `analytics.declines`. */
  declines: eventOrganiserProcedure
    .input(z.object({ eventId: z.string() }))
    .query(({ ctx, input }) =>
      declineReport(ctx.db, Prisma.sql`e.id = ${input.eventId}`),
    ),

  discountPerformance: eventOrganiserProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Both kinds of code, global and the event's own, in one table.
      const query = {
        where: { order: { eventId: input.eventId } },
        include: {
          code: { select: { id: true, code: true } },
          order: { select: { totalCents: true } },
        },
      } as const;
      const redemptions = [
        ...(await ctx.db.discountRedemption.findMany(query)),
        ...(await ctx.db.eventCodeRedemption.findMany(query)),
      ];

      const byCode = new Map<
        string,
        {
          code: string;
          uses: number;
          givenCents: number;
          revenueCents: number;
        }
      >();

      for (const redemption of redemptions) {
        const entry = byCode.get(redemption.code.id) ?? {
          code: redemption.code.code,
          uses: 0,
          givenCents: 0,
          revenueCents: 0,
        };
        entry.uses += 1;
        entry.givenCents += redemption.amountCents;
        entry.revenueCents += redemption.order.totalCents;
        byCode.set(redemption.code.id, entry);
      }

      return [...byCode.values()].sort((a, b) => b.uses - a.uses);
    }),

  /** Where the buyers came from, captured at checkout. */
  /**
   * CSV exports. Returned as a string for the client to download, so the
   * browser never has to hold a second copy of the dataset in memory as JSON.
   */
  exportCsv: eventOrganiserProcedure
    .input(
      z.object({
        eventId: z.string(),
        kind: z.enum(["attendees", "orders", "scans"]),
      }),
    )
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.ticketEvent.findUnique({
        where: { id: input.eventId },
        select: { name: true, slug: true },
      });
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      let rows: string[][] = [];

      if (input.kind === "attendees") {
        const tickets = await ctx.db.ticket.findMany({
          where: { eventId: input.eventId, status: TicketStatus.VALID },
          orderBy: { ticketNumber: "asc" },
          include: {
            tier: { select: { name: true } },
            level: { select: { label: true } },
            order: {
              select: {
                orderNumber: true,
                buyerName: true,
                buyerEmail: true,
                paymentMethod: true,
              },
            },
            scans: {
              where: {
                result: {
                  in: [
                    TicketScanResult.ADMITTED,
                    TicketScanResult.OVERRIDE_ADMITTED,
                    TicketScanResult.REENTRY,
                  ],
                },
              },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { createdAt: true },
            },
          },
        });

        rows = [
          [
            "Ticket number",
            "Attendee",
            "Type",
            "Level",
            "Comp",
            "Invited by",
            "Order",
            "Buyer",
            "Email",
            "Payment",
            "Price paid",
            "Admitted at",
          ],
          ...tickets.map((ticket) => [
            ticket.ticketNumber,
            ticket.attendeeName ?? "",
            ticketTypeName(ticket),
            ticket.accessLevel,
            ticket.isComp ? "yes" : "",
            ticket.invitedByName ?? "",
            ticket.order.orderNumber,
            ticket.order.buyerName ?? "",
            ticket.order.buyerEmail ?? "",
            ticket.order.paymentMethod,
            (ticket.pricePaidCents / 100).toFixed(2),
            ticket.scans[0]?.createdAt.toISOString() ?? "",
          ]),
        ];
      }

      if (input.kind === "orders") {
        const orders = await ctx.db.ticketOrder.findMany({
          where: { eventId: input.eventId },
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { tickets: true } } },
        });

        rows = [
          [
            "Order",
            "Status",
            "Created",
            "Paid",
            "Buyer",
            "Email",
            "Tickets",
            "Face value",
            "Discount",
            "Booking fee",
            "Total",
            "GST",
            "Refunded",
            "Payment",
            "Source",
          ],
          ...orders.map((order) => [
            order.orderNumber,
            order.status,
            order.createdAt.toISOString(),
            order.paidAt?.toISOString() ?? "",
            order.buyerName ?? "",
            order.buyerEmail ?? "",
            String(order._count.tickets),
            (order.subtotalCents / 100).toFixed(2),
            (order.discountCents / 100).toFixed(2),
            (order.bookingFeeCents / 100).toFixed(2),
            (order.totalCents / 100).toFixed(2),
            (order.gstCents / 100).toFixed(2),
            (order.refundedCents / 100).toFixed(2),
            order.paymentMethod,
            order.utmSource ?? "direct",
          ]),
        ];
      }

      if (input.kind === "scans") {
        const scans = await ctx.db.ticketScan.findMany({
          where: { eventId: input.eventId },
          orderBy: { createdAt: "asc" },
          include: {
            ticket: { select: { ticketNumber: true, attendeeName: true } },
          },
        });

        const staffIds = [
          ...new Set(
            scans
              .map((scan) => scan.scannedByUserId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const staff = await ctx.db.user.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, name: true },
        });
        const nameById = new Map(staff.map((user) => [user.id, user.name]));

        rows = [
          [
            "Time",
            "Result",
            "Ticket",
            "Attendee",
            "Scanned by",
            "Device",
            "Override",
          ],
          ...scans.map((scan) => [
            scan.createdAt.toISOString(),
            scan.result,
            scan.ticket?.ticketNumber ?? "",
            scan.ticket?.attendeeName ?? "",
            scan.scannedByUserId
              ? (nameById.get(scan.scannedByUserId) ?? "")
              : "",
            scan.deviceLabel ?? "",
            scan.wasOverride ? "yes" : "",
          ]),
        ];
      }

      return {
        filename: `${event.slug}-${input.kind}.csv`,
        csv: toCsv(rows),
      };
    }),
});
