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
import { pastEventsPace } from "~/server/ticketing/lead-time";
import { paceOnAxis } from "~/lib/ticketing/pace";
import { campaignTypeOf } from "~/lib/ticketing/campaigns";
import { soldFaceValueCents } from "~/lib/ticketing/tiers";
import {
  gstComponentCents,
  venueFeePerTicketCents,
} from "~/lib/ticketing/money";
import { toCsv } from "~/lib/csv";
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
  unsoldRevenueCents,
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

      const grossCents = money._sum.totalCents ?? 0;
      const refundedCents = money._sum.refundedCents ?? 0;

      const allocation = event.tiers.reduce((s, t) => s + t.allocation, 0);
      const capacity = event.capacity ?? allocation;

      // Comps sit outside every tier counter, so the tier table alone will not
      // add up to `ticketsIssued`. This is the row that reconciles them.
      const comps = await compAccounting(event.id, ctx.db);

      // Profit and break even. A ticket is worth what sold ones have averaged,
      // net of refunds; before the first sale, what the tier plan would bring.
      const netCents = grossCents - refundedCents;
      const sold = ticketsIssued - comps.issued;
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
        unsoldRevenueCents({
          tiers: activeTiers,
          fee,
          venueFeePerTicket: venueFee,
          maxTickets: sellable - sold,
        });

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
          capacity,
        },
        money: {
          grossCents,
          refundedCents,
          netCents,
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
            capacity > 0 ? Math.round((ticketsIssued / capacity) * 100) : 0,
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
          sold: ticketsIssued - comps.issued,
        },
        comps,
        tiers: event.tiers.map((tier) => ({
          id: tier.id,
          name: tier.name,
          priceCents: tier.priceCents,
          allocation: tier.allocation,
          sold: tier.soldCount,
          held: tier.heldCount,
          remaining: Math.max(
            0,
            tier.allocation - tier.soldCount - tier.heldCount,
          ),
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
