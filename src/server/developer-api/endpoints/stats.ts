import "server-only";

import { z } from "zod";

import { TicketScanResult } from "~Prisma/client";
import { ANALYTICS_RANGES } from "~/lib/analytics-range";
import { db } from "~/server/db";
import { defineEndpoint } from "../endpoint";
import { dateTime, idParams } from "../schemas";

/**
 * How an event is going: sales and money, the sales curve, and the door. Each
 * is the event dashboard's own query, called through the admin procedures, so
 * the numbers here and on the dashboard can never disagree.
 */

const statsResource = z.object({
  eventId: z.string(),
  name: z.string(),
  currency: z.literal("NZD"),
  capacity: z.number().int().nullable(),
  tickets: z.object({
    sold: z
      .number()
      .int()
      .describe("Paid for, online, at the door and off platform."),
    comps: z.number().int().describe("Given away. Not part of revenue."),
    issued: z.number().int().describe("Valid tickets, comps included."),
    refunded: z.number().int(),
    admitted: z.number().int(),
    offPlatform: z.number().int().describe("Door totals entered by hand."),
    percentSold: z.number().int(),
    orders: z.number().int(),
    abandonedCheckouts: z.number().int(),
    pageViews: z.number().int(),
  }),
  money: z.object({
    grossCents: z.number().int(),
    refundedCents: z.number().int(),
    netCents: z.number().int(),
    offPlatformCents: z.number().int(),
    discountCents: z.number().int(),
    bookingFeeCents: z.number().int(),
    gstCents: z.number().int().describe("Inside net."),
  }),
  costs: z.object({
    totalCents: z.number().int(),
    profitCents: z.number().int(),
    breakEvenTickets: z.number().int().nullable(),
    revenueIfSoldOutCents: z.number().int(),
    profitIfSoldOutCents: z.number().int(),
  }),
  tiers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      priceCents: z.number().int(),
      allocation: z.number().int(),
      sold: z.number().int(),
      held: z.number().int().describe("In someone's basket right now."),
      remaining: z.number().int(),
      revenueCents: z.number().int(),
    }),
  ),
  asOf: dateTime,
});

const eventStats = defineEndpoint({
  method: "GET",
  path: "/events/{id}/stats",
  tag: "Sales",
  summary: "Event sales",
  description:
    "Where sales stand now. Cheap enough to poll every minute; the update feed says when something changed.",
  scope: "sales:read",
  params: idParams,
  response: statsResource,
  run: async ({ params }, ctx) => {
    const admin = await ctx.admin();
    const overview = await admin.ticketAnalytics.overview({
      eventId: params.id,
    });
    const { counts, money, costs } = overview;
    return {
      eventId: overview.event.id,
      name: overview.event.name,
      currency: "NZD" as const,
      capacity: overview.event.capacity,
      tickets: {
        sold: counts.sold,
        comps: counts.comped,
        issued: counts.ticketsIssued,
        refunded: counts.ticketsRefunded,
        admitted: counts.admitted,
        offPlatform: counts.offPlatform,
        percentSold: counts.percentSold,
        orders: counts.orders,
        abandonedCheckouts: counts.abandonedCheckouts,
        pageViews: counts.views,
      },
      money: {
        grossCents: money.grossCents,
        refundedCents: money.refundedCents,
        netCents: money.netCents,
        offPlatformCents: money.offPlatformCents,
        discountCents: money.discountCents,
        bookingFeeCents: money.bookingFeeCents,
        gstCents: overview.gst.netCents,
      },
      costs: {
        totalCents: costs.totalCents,
        profitCents: costs.profitCents,
        breakEvenTickets: costs.breakEvenTickets,
        revenueIfSoldOutCents: costs.revenueIfSoldOutCents,
        profitIfSoldOutCents: costs.profitIfSoldOutCents,
      },
      tiers: overview.tiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        priceCents: tier.priceCents,
        allocation: tier.allocation,
        sold: tier.sold,
        held: tier.held,
        remaining: tier.remaining,
        revenueCents: tier.revenueCents,
      })),
      asOf: new Date(),
    };
  },
});

const salesTimeline = defineEndpoint({
  method: "GET",
  path: "/events/{id}/stats/timeline",
  tag: "Sales",
  summary: "Sales over time",
  description:
    "Tickets and revenue per hour that had sales. `baseline` is what sold before the range began, so a running total starts in the right place.",
  scope: "sales:read",
  params: idParams,
  query: z.object({ range: z.enum(ANALYTICS_RANGES).default("all") }),
  response: z.object({
    timezone: z.string(),
    from: dateTime,
    to: dateTime,
    baseline: z.object({
      tickets: z.number().int(),
      revenueCents: z.number().int(),
    }),
    hours: z.array(
      z.object({
        at: dateTime,
        tickets: z.number().int(),
        revenueCents: z.number().int(),
      }),
    ),
  }),
  run: async ({ params, query }, ctx) => {
    const admin = await ctx.admin();
    const timeline = await admin.ticketAnalytics.salesOverTime({
      eventId: params.id,
      range: query.range,
    });
    return {
      timezone: timeline.timezone,
      from: timeline.from,
      to: timeline.to,
      baseline: timeline.baseline,
      hours: timeline.rows,
    };
  },
});

const doorResource = z.object({
  eventId: z.string(),
  inside: z.number().int().describe("In the building now."),
  issued: z.number().int(),
  byTier: z.array(
    z.object({
      label: z.string(),
      issued: z.number().int(),
      inside: z.number().int(),
    }),
  ),
  lastFiveMinutes: z.object({
    scanned: z.number().int(),
    letIn: z.number().int(),
    turnedAway: z.number().int(),
    departed: z.number().int(),
  }),
  night: z.object({
    firstAt: dateTime.nullable(),
    halfAt: dateTime
      .nullable()
      .describe("When half of tonight's arrivals were in."),
    reentries: z.number().int(),
    overrides: z.number().int(),
    idChecks: z.number().int(),
    idRefused: z.number().int(),
  }),
  doorSales: z.object({
    orders: z.number().int(),
    tickets: z.number().int(),
    revenueCents: z.number().int(),
  }),
  recentScans: z
    .array(
      z.object({
        at: dateTime,
        result: z.enum(TicketScanResult),
        ticketNumber: z.string().nullable(),
        attendeeName: z.string().nullable(),
        tier: z.string().nullable(),
      }),
    )
    .optional()
    .describe("The latest 25 scans, newest first. Needs door:sensitive."),
  asOf: dateTime,
});

const eventDoor = defineEndpoint({
  method: "GET",
  path: "/events/{id}/door",
  tag: "Door",
  summary: "The door, live",
  description: "Headcount and the last few minutes at the door.",
  scope: "door:read",
  widenedBy: ["door:sensitive"],
  params: idParams,
  response: doorResource,
  run: async ({ params }, ctx) => {
    const admin = await ctx.admin();
    const live = await admin.ticketAnalytics.doorsLive({ eventId: params.id });
    const recentScans = ctx.has("door:sensitive")
      ? await db.ticketScan.findMany({
          where: { eventId: params.id },
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            createdAt: true,
            result: true,
            ticket: {
              select: {
                ticketNumber: true,
                attendeeName: true,
                tier: { select: { name: true } },
              },
            },
          },
        })
      : null;

    return {
      eventId: params.id,
      inside: live.byTier.reduce((sum, row) => sum + row.inside, 0),
      issued: live.byTier.reduce((sum, row) => sum + row.issued, 0),
      byTier: live.byTier,
      lastFiveMinutes: {
        scanned: live.now.scanned,
        letIn: live.now.letIn,
        turnedAway: live.now.turnedAway,
        departed: live.now.departed,
      },
      night: {
        firstAt: live.night.firstAt,
        halfAt: live.night.halfAt,
        reentries: live.night.reentries,
        overrides: live.night.overrides,
        idChecks: live.night.idChecks,
        idRefused: live.night.idRefused,
      },
      doorSales: {
        orders: live.doorSales.orders,
        tickets: live.doorSales.tickets,
        revenueCents: live.doorSales.revenueCents,
      },
      ...(recentScans
        ? {
            recentScans: recentScans.map((scan) => ({
              at: scan.createdAt,
              result: scan.result,
              ticketNumber: scan.ticket?.ticketNumber ?? null,
              attendeeName: scan.ticket?.attendeeName ?? null,
              tier: scan.ticket?.tier?.name ?? null,
            })),
          }
        : {}),
      asOf: new Date(),
    };
  },
});

export const statsEndpoints = [eventStats, salesTimeline, eventDoor];
