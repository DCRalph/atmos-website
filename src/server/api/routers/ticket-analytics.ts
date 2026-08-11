import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  TicketOrderStatus,
  TicketScanResult,
  TicketStatus,
} from "~Prisma/client";
import { createTRPCRouter, eventOrganiserProcedure } from "~/server/api/trpc";
import { admittedCount } from "~/server/ticketing/scan";

/**
 * Event analytics: the sales dashboard, and the live view you watch on your
 * phone while people come through the door.
 *
 * Aggregation happens in SQL rather than by pulling rows into JS — an event
 * with 2,000 tickets and 6,000 scans should not be paginated through in
 * memory every five seconds.
 */

const ADMIT_RESULTS = "('ADMITTED', 'OVERRIDE_ADMITTED', 'REENTRY')";

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
          tiers: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              priceCents: true,
              allocation: true,
              soldCount: true,
              heldCount: true,
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
            totalCents: true,
            gstCents: true,
            refundedCents: true,
          },
        }),
        ctx.db.ticketOrder.count({
          where: { eventId: event.id, status: { in: paidStatuses } },
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

      const grossCents = money._sum.totalCents ?? 0;
      const refundedCents = money._sum.refundedCents ?? 0;

      const allocation = event.tiers.reduce((s, t) => s + t.allocation, 0);
      const capacity = event.capacity ?? allocation;

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
          netCents: grossCents - refundedCents,
          faceValueCents: money._sum.subtotalCents ?? 0,
          discountCents: money._sum.discountCents ?? 0,
          bookingFeeCents: money._sum.bookingFeeCents ?? 0,
          gstCents: money._sum.gstCents ?? 0,
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
          /** Paid ÷ (paid + abandoned). The checkout funnel's bottom step. */
          checkoutConversion:
            orderCount + abandoned > 0
              ? Math.round((orderCount / (orderCount + abandoned)) * 100)
              : null,
        },
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
          revenueCents: tier.soldCount * tier.priceCents,
        })),
        byPaymentMethod: byMethod.map((row) => ({
          method: row.paymentMethod,
          orders: row._count,
          totalCents: row._sum.totalCents ?? 0,
        })),
      };
    }),

  /** Cumulative sales curve — when tickets actually moved. */
  salesOverTime: eventOrganiserProcedure
    .input(
      z.object({
        eventId: z.string(),
        bucket: z.enum(["hour", "day"]).default("day"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.ticketEvent.findUnique({
        where: { id: input.eventId },
        select: { timezone: true },
      });
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      const rows = await ctx.db.$queryRaw<
        { bucket: Date; tickets: bigint; revenue_cents: bigint }[]
      >`
        SELECT
          date_trunc(${input.bucket}, o."paidAt" AT TIME ZONE ${event.timezone}) AS bucket,
          COUNT(t.id)::bigint AS tickets,
          COALESCE(SUM(t."pricePaidCents"), 0)::bigint AS revenue_cents
        FROM "ticket_order" o
        JOIN "ticket" t ON t."orderId" = o.id
        WHERE o."eventId" = ${input.eventId}
          AND o."paidAt" IS NOT NULL
        GROUP BY 1
        ORDER BY 1 ASC
      `;

      let runningTickets = 0;
      let runningRevenue = 0;
      return rows.map((row) => {
        runningTickets += Number(row.tickets);
        runningRevenue += Number(row.revenue_cents);
        return {
          bucket: row.bucket,
          tickets: Number(row.tickets),
          revenueCents: Number(row.revenue_cents),
          cumulativeTickets: runningTickets,
          cumulativeRevenueCents: runningRevenue,
        };
      });
    }),

  /**
   * The live door view. Polled every few seconds during an event, so it stays
   * to a handful of cheap aggregate queries.
   */
  live: eventOrganiserProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [sold, admitted, arrivals, byStaff, recent, failures] =
        await Promise.all([
          ctx.db.ticket.count({
            where: { eventId: input.eventId, status: TicketStatus.VALID },
          }),
          admittedCount(input.eventId),

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
        notArrived: Math.max(0, sold - admitted),
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
      const redemptions = await ctx.db.discountRedemption.findMany({
        where: { order: { eventId: input.eventId } },
        include: {
          code: { select: { id: true, code: true, type: true, value: true } },
          order: { select: { totalCents: true, id: true } },
        },
      });

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
  sources: eventOrganiserProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.ticketOrder.groupBy({
        by: ["utmSource", "utmMedium", "utmCampaign"],
        where: { eventId: input.eventId, status: TicketOrderStatus.PAID },
        _count: true,
        _sum: { totalCents: true },
      });

      return rows
        .map((row) => ({
          source: row.utmSource ?? "direct",
          medium: row.utmMedium,
          campaign: row.utmCampaign,
          orders: row._count,
          revenueCents: row._sum.totalCents ?? 0,
        }))
        .sort((a, b) => b.orders - a.orders);
    }),

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
            "Tier",
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
            ticket.tier.name,
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

/** RFC 4180 quoting: a venue called `O'Brien's, Level 2` must survive Excel. */
function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell ?? "";
          return /[",\n\r]/.test(value)
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        })
        .join(","),
    )
    .join("\r\n");
}
