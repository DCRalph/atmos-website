import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  ActivityType,
  EventStaffRole,
  TicketEventStatus,
  TicketOrderStatus,
  TicketScanResult,
  TicketStatus,
} from "~Prisma/client";
import { createTRPCRouter, doorProcedure } from "~/server/api/trpc";
import { admittedCount, denyTicket, scanTicket } from "~/server/ticketing/scan";
import { buildTicketToken } from "~/server/ticketing/qr";
import { DENY_REASON_VALUES } from "~/lib/ticketing/deny-reasons";
import { logActivity } from "~/server/utils/activity-log";
import { db } from "~/server/db";

/**
 * The door.
 *
 * Admins and event organisers have unrestricted door access at every event,
 * including manager controls. Other signed-in users must be assigned through
 * `TicketEventStaff` and receive the scanner or manager level from that event.
 */

async function assertAssigned(
  userId: string,
  isAdmin: boolean,
  isEventOrganiser: boolean,
  eventId: string,
): Promise<{ isManager: boolean }> {
  if (isAdmin || isEventOrganiser) return { isManager: true };

  const assignment = await db.ticketEventStaff.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { role: true },
  });

  if (!assignment) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You're not on the door for this event.",
    });
  }

  return { isManager: assignment.role === EventStaffRole.MANAGER };
}

export const doorRouter = createTRPCRouter({
  /** Events this person can scan, nearest first. */
  myEvents: doorProcedure.query(async ({ ctx }) => {
    const horizonStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const events = await ctx.db.ticketEvent.findMany({
      where: {
        status: {
          in: [
            TicketEventStatus.PUBLISHED,
            TicketEventStatus.SALES_PAUSED,
            TicketEventStatus.SOLD_OUT,
          ],
        },
        startsAt: { gte: horizonStart },
        ...(ctx.hasGlobalDoorAccess
          ? {}
          : { staff: { some: { userId: ctx.user.id } } }),
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        startsAt: true,
        doorsAt: true,
        timezone: true,
        venueName: true,
        isR18: true,
        reentryAllowed: true,
      },
    });

    return events;
  }),

  /** Header data for the scanner: capacity, how many are in, R18 flag. */
  summary: doorProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { isManager } = await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      const event = await ctx.db.ticketEvent.findUniqueOrThrow({
        where: { id: input.eventId },
        select: {
          id: true,
          name: true,
          timezone: true,
          startsAt: true,
          doorsAt: true,
          venueName: true,
          isR18: true,
          reentryAllowed: true,
        },
      });

      const [sold, admitted] = await Promise.all([
        ctx.db.ticket.count({
          where: { eventId: input.eventId, status: TicketStatus.VALID },
        }),
        admittedCount(input.eventId),
      ]);

      return {
        event,
        sold,
        admitted,
        notArrived: Math.max(0, sold - admitted),
        isManager,
      };
    }),

  scan: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        token: z.string().min(1).max(400),
        deviceLabel: z.string().trim().max(60).optional(),
        override: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { isManager } = await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      if (input.override && !isManager) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a door manager can override a duplicate.",
        });
      }

      const outcome = await scanTicket({
        rawToken: input.token,
        eventId: input.eventId,
        scannedByUserId: ctx.user.id,
        deviceLabel: input.deviceLabel ?? null,
        override: input.override,
      });

      if (outcome.result === TicketScanResult.OVERRIDE_ADMITTED) {
        await logActivity({
          type: ActivityType.TICKET_SCAN_OVERRIDE,
          action: `Override admitted ${outcome.ticket?.ticketNumber ?? "unknown ticket"}`,
          userId: ctx.user.id,
          details: {
            eventId: input.eventId,
            ticketId: outcome.ticket?.id,
            deviceLabel: input.deviceLabel,
          },
        });
      }

      const admitted = await admittedCount(input.eventId);
      return { ...outcome, admitted };
    }),

  /**
   * Manual entry for a cracked screen or a dead phone. Resolves the ticket
   * number to its real token and runs the identical scan path, so nothing can
   * slip past the duplicate check just because it was typed instead of scanned.
   */
  admitByTicketNumber: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        ticketNumber: z.string().trim().min(3).max(40),
        deviceLabel: z.string().trim().max(60).optional(),
        override: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { isManager } = await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );
      if (input.override && !isManager) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a door manager can override a duplicate.",
        });
      }

      const ticket = await ctx.db.ticket.findUnique({
        where: { ticketNumber: input.ticketNumber.toUpperCase() },
        select: { id: true, qrVersion: true, qrSecret: true },
      });

      if (!ticket) {
        return {
          result: TicketScanResult.NOT_FOUND,
          admit: false,
          message: "No ticket with that number",
          ticket: null,
          previousAdmission: null,
          previousDenial: null,
          isR18: false,
          canOverride: false,
          admitted: await admittedCount(input.eventId),
        };
      }

      const outcome = await scanTicket({
        rawToken: buildTicketToken(ticket),
        eventId: input.eventId,
        scannedByUserId: ctx.user.id,
        deviceLabel: input.deviceLabel ?? null,
        override: input.override,
      });

      return { ...outcome, admitted: await admittedCount(input.eventId) };
    }),

  /**
   * Turn someone away. Available to every door staffer, not just managers —
   * the person holding the scanner is the one looking at the punter, and a
   * refusal that has to wait for a manager is a refusal that doesn't happen.
   */
  deny: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        ticketId: z.string(),
        reason: z.enum(DENY_REASON_VALUES),
        note: z.string().trim().max(200).optional(),
        deviceLabel: z.string().trim().max(60).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      const outcome = await denyTicket({
        ticketId: input.ticketId,
        eventId: input.eventId,
        reason: input.reason,
        note: input.note ?? null,
        scannedByUserId: ctx.user.id,
        deviceLabel: input.deviceLabel ?? null,
      });

      if (outcome.result === TicketScanResult.DENIED) {
        await logActivity({
          type: ActivityType.TICKET_ENTRY_DENIED,
          action: `Refused entry to ${outcome.ticket?.ticketNumber ?? "unknown ticket"} (${input.reason})`,
          userId: ctx.user.id,
          details: {
            eventId: input.eventId,
            ticketId: input.ticketId,
            reason: input.reason,
            note: input.note,
            deviceLabel: input.deviceLabel,
          },
        });
      }

      return { ...outcome, admitted: await admittedCount(input.eventId) };
    }),

  /** Undo a mistaken admission. Appends a record; nothing is deleted. */
  revertAdmission: doorProcedure
    .input(z.object({ eventId: z.string(), ticketId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { isManager } = await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );
      if (!isManager) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a door manager can undo an admission.",
        });
      }

      await ctx.db.ticketScan.create({
        data: {
          ticketId: input.ticketId,
          eventId: input.eventId,
          result: TicketScanResult.ADMISSION_REVERTED,
          scannedByUserId: ctx.user.id,
          wasOverride: true,
        },
      });

      await logActivity({
        type: ActivityType.TICKET_SCAN_OVERRIDE,
        action: "Reverted an admission",
        userId: ctx.user.id,
        details: { eventId: input.eventId, ticketId: input.ticketId },
      });

      return {
        ok: true as const,
        admitted: await admittedCount(input.eventId),
      };
    }),

  /**
   * The searchable door list — the fallback when someone turns up with no
   * phone, no email and a lot of confidence.
   */
  doorList: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        search: z.string().trim().max(80).default(""),
        onlyNotArrived: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(40),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      const search = input.search;
      const tickets = await ctx.db.ticket.findMany({
        where: {
          eventId: input.eventId,
          status: TicketStatus.VALID,
          order: { status: TicketOrderStatus.PAID },
          ...(search
            ? {
                OR: [
                  { attendeeName: { contains: search, mode: "insensitive" } },
                  { ticketNumber: { contains: search, mode: "insensitive" } },
                  {
                    order: {
                      buyerName: { contains: search, mode: "insensitive" },
                    },
                  },
                  {
                    order: {
                      buyerEmail: { contains: search, mode: "insensitive" },
                    },
                  },
                  {
                    order: {
                      orderNumber: { contains: search, mode: "insensitive" },
                    },
                  },
                ],
              }
            : {}),
        },
        take: input.limit,
        orderBy: [{ attendeeName: "asc" }, { ticketNumber: "asc" }],
        select: {
          id: true,
          ticketNumber: true,
          attendeeName: true,
          tier: { select: { name: true } },
          order: {
            select: {
              orderNumber: true,
              buyerName: true,
              buyerEmail: true,
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
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, deviceLabel: true },
          },
        },
      });

      const rows = tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        attendeeName: ticket.attendeeName,
        tierName: ticket.tier.name,
        orderNumber: ticket.order.orderNumber,
        buyerName: ticket.order.buyerName,
        buyerEmail: ticket.order.buyerEmail,
        admittedAt: ticket.scans[0]?.createdAt ?? null,
        admittedDevice: ticket.scans[0]?.deviceLabel ?? null,
      }));

      return input.onlyNotArrived
        ? rows.filter((row) => row.admittedAt === null)
        : rows;
    }),

  /** Live feed for the scanner footer and the admin live view. */
  recentScans: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      const scans = await ctx.db.ticketScan.findMany({
        where: { eventId: input.eventId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
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
      });

      // `TicketScan.scannedByUserId` is a plain column rather than a relation,
      // so the names come from one extra lookup instead of a join.
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

      return scans.map((scan) => ({
        ...scan,
        scannedByName: scan.scannedByUserId
          ? (nameById.get(scan.scannedByUserId) ?? null)
          : null,
      }));
    }),
});
