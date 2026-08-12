import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  ActivityType,
  EventStaffRole,
  PaymentMethodKind,
  type Prisma,
  TicketEventStatus,
  TicketOrderStatus,
  TicketScanResult,
  TicketStatus,
} from "~Prisma/client";
import { createTRPCRouter, doorProcedure } from "~/server/api/trpc";
import {
  ADMITTING_RESULTS,
  admissionStates,
  admittedCount,
  denyTicket,
  inspectTicket,
  reduceAdmissionState,
  scanTicket,
  ticketState,
} from "~/server/ticketing/scan";
import { sellAtDoor } from "~/server/ticketing/box-office";
import {
  cancelPendingOrder,
  createPendingOrder,
  issueTicketsForOrder,
} from "~/server/ticketing/orders";
import { getStripe, isStripeConfigured } from "~/server/stripe";
import { compAccounting, issueComp } from "~/server/ticketing/comps";
import { sendCompTicketEmail } from "~/server/ticketing/email/send";
import { buildTicketToken } from "~/server/ticketing/qr";
import { DENY_REASON_VALUES } from "~/lib/ticketing/deny-reasons";
import { ACCESS_LEVEL_VALUES } from "~/lib/ticketing/access-levels";
import { ticketTypeName } from "~/lib/ticketing/access-levels";
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

/**
 * Admit tickets that were minted a millisecond ago.
 *
 * Written straight in rather than through `scanTicket`: there is no duplicate
 * to check for and nothing to serialise against. The name lock still has to
 * happen, though — a ticket somebody has walked in on can never be renamed
 * afterwards, no matter which door it came out of.
 */
async function admitFreshTickets({
  ticketIds,
  eventId,
  scannedByUserId,
  deviceLabel,
}: {
  ticketIds: string[];
  eventId: string;
  scannedByUserId: string;
  deviceLabel?: string | null;
}): Promise<void> {
  if (ticketIds.length === 0) return;

  await db.ticketScan.createMany({
    data: ticketIds.map((ticketId) => ({
      ticketId,
      eventId,
      result: TicketScanResult.ADMITTED,
      scannedByUserId,
      deviceLabel: deviceLabel ?? null,
    })),
  });

  await db.ticket.updateMany({
    where: { id: { in: ticketIds }, nameLockedAt: null },
    data: { nameLockedAt: new Date() },
  });
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
   * Look a ticket up without admitting anybody.
   *
   * The question staff ask when there's an argument rather than a queue: is
   * this real, has it been used, did somebody already knock this person back.
   * Scanning to find out is not an option — it would admit them, or burn the
   * ticket as a duplicate, on the way to answering.
   *
   * Read-only on purpose. Nothing is written, so a check can be run as many
   * times as it takes without appearing in the history it is showing.
   */
  checkTicket: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        lookup: z.discriminatedUnion("kind", [
          z.object({
            kind: z.literal("token"),
            token: z.string().min(1).max(400),
          }),
          z.object({
            kind: z.literal("ticketNumber"),
            ticketNumber: z.string().trim().min(3).max(40),
          }),
        ]),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      return inspectTicket({ eventId: input.eventId, lookup: input.lookup });
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
      /**
       * Managers can undo anyone's admission; a staffer can undo their own.
       *
       * The old rule was manager-only across the board, which meant the person
       * who scanned the wrong ticket could not fix it and had to find someone
       * who could. Correcting your own mistake is not the same power as
       * overturning somebody else's decision, so only the second still needs a
       * manager.
       */
      if (!isManager) {
        const lastAdmission = await ctx.db.ticketScan.findFirst({
          where: {
            ticketId: input.ticketId,
            result: { in: [...ADMITTING_RESULTS] },
          },
          orderBy: { createdAt: "desc" },
          select: { scannedByUserId: true },
        });
        if (lastAdmission?.scannedByUserId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only a door manager can undo somebody else's admission.",
          });
        }
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
   * Mark somebody out of the building.
   *
   * Not an undo. `revertAdmission` says the admission should never have
   * counted; this says it was real and is over — they went home, or stepped out
   * for a smoke. The admission stays in their history, the headcount drops
   * because they are not inside, and their ticket scans clean on the way back
   * in even where re-entry is switched off.
   *
   * Open to every door staffer. Watching people leave is the job, and a queue
   * of departures waiting on a manager is a headcount nobody keeps up to date.
   *
   * Marked somebody out by mistake? Scan them back in — that is the fix, and it
   * is the same tap as any other admission.
   */
  markDeparted: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        ticketId: z.string(),
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

      const ticket = await ctx.db.ticket.findUnique({
        where: { id: input.ticketId },
        select: { eventId: true },
      });

      if (ticket?.eventId !== input.eventId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      }

      await ctx.db.ticketScan.create({
        data: {
          ticketId: input.ticketId,
          eventId: input.eventId,
          result: TicketScanResult.DEPARTED,
          scannedByUserId: ctx.user.id,
          deviceLabel: input.deviceLabel,
        },
      });

      return {
        ok: true as const,
        admitted: await admittedCount(input.eventId),
      };
    }),

  /**
   * Take back a refusal.
   *
   * Open to any door staffer, unlike undoing an admission. A refusal is the
   * one action here every staffer can take, so a mis-tap has to be fixable by
   * the person who made it — waiting for a manager with a queue building is
   * how a wrong refusal becomes permanent.
   */
  revertDenial: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        ticketId: z.string(),
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

      await ctx.db.ticketScan.create({
        data: {
          ticketId: input.ticketId,
          eventId: input.eventId,
          result: TicketScanResult.DENIAL_REVERTED,
          scannedByUserId: ctx.user.id,
          deviceLabel: input.deviceLabel,
        },
      });

      await logActivity({
        type: ActivityType.TICKET_SCAN_OVERRIDE,
        action: "Took back a refusal",
        userId: ctx.user.id,
        details: { eventId: input.eventId, ticketId: input.ticketId },
      });

      return { ok: true as const };
    }),

  /**
   * Attach a note to a ticket without changing anything.
   *
   * "Argued at the door", "ID looked off", "came back with a manager". Until
   * now the only way to leave a record was to refuse somebody, which meant
   * staff either refused people they did not mean to or wrote nothing down.
   * Stored as a scan row so it lands in the same timeline, in order.
   */
  addNote: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        ticketId: z.string(),
        note: z.string().trim().min(1, "Say something").max(500),
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

      await ctx.db.ticketScan.create({
        data: {
          ticketId: input.ticketId,
          eventId: input.eventId,
          result: TicketScanResult.NOTE,
          denyNote: input.note,
          scannedByUserId: ctx.user.id,
          deviceLabel: input.deviceLabel,
        },
      });

      return { ok: true as const };
    }),

  /**
   * Everything that has happened on this door, newest first.
   *
   * `recentScans` answers "what did I just do"; this is the manager's version —
   * every door, every staffer, filterable — for the moment somebody asks what
   * happened ten minutes ago and nobody was watching that scanner.
   */
  activity: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        filter: z.enum(["all", "refused", "overrides", "notes"]).default("all"),
        limit: z.number().int().min(1).max(200).default(60),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      const results =
        input.filter === "refused"
          ? [TicketScanResult.DENIED, TicketScanResult.PREVIOUSLY_DENIED]
          : input.filter === "overrides"
            ? [
                TicketScanResult.OVERRIDE_ADMITTED,
                TicketScanResult.ADMISSION_REVERTED,
                TicketScanResult.DENIAL_REVERTED,
              ]
            : input.filter === "notes"
              ? [TicketScanResult.NOTE]
              : null;

      const scans = await ctx.db.ticketScan.findMany({
        where: {
          eventId: input.eventId,
          ...(results ? { result: { in: results } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          result: true,
          createdAt: true,
          deviceLabel: true,
          denyReason: true,
          denyNote: true,
          wasOverride: true,
          scannedByUserId: true,
          ticket: {
            select: {
              id: true,
              ticketNumber: true,
              attendeeName: true,
              accessLevel: true,
            },
          },
        },
      });

      // Same one-extra-lookup shape as `recentScans`: `scannedByUserId` is a
      // plain column, not a relation.
      const staffIds = [
        ...new Set(
          scans
            .map((scan) => scan.scannedByUserId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const nameById = new Map(
        (
          await ctx.db.user.findMany({
            where: { id: { in: staffIds } },
            select: { id: true, name: true },
          })
        ).map((user) => [user.id, user.name]),
      );

      return scans.map((scan) => ({
        id: scan.id,
        at: scan.createdAt,
        result: scan.result,
        reason: scan.denyReason,
        note: scan.denyNote,
        device: scan.deviceLabel,
        wasOverride: scan.wasOverride,
        by: scan.scannedByUserId
          ? (nameById.get(scan.scannedByUserId) ?? null)
          : null,
        ticket: scan.ticket,
      }));
    }),

  /**
   * The searchable door list — the fallback when someone turns up with no
   * phone, no email and a lot of confidence.
   *
   * Paged rather than capped: with no search this is the entire ticket holder
   * list, and a silent `take: 40` on an event that sold four hundred is a list
   * that quietly lies about who is coming.
   */
  doorList: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        search: z.string().trim().max(80).default(""),
        /**
         * What the list is showing.
         *
         * `all` is genuinely all — including void and refunded tickets, which
         * used to be filtered out entirely. A ticket refunded this morning is
         * the reason somebody is arguing at the door, and a list that silently
         * dropped it just moved the argument somewhere staff had no answer.
         */
        filter: z
          .enum(["all", "notArrived", "arrived", "denied"])
          .default("all"),
        limit: z.number().int().min(1).max(100).default(50),
        /** Ticket id of the last row on the previous page. */
        cursor: z.string().optional(),
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
      const ADMITTING = [
        TicketScanResult.ADMITTED,
        TicketScanResult.OVERRIDE_ADMITTED,
        TicketScanResult.REENTRY,
      ];
      const where = {
        eventId: input.eventId,
        order: { status: TicketOrderStatus.PAID },
        // Filtered in the query rather than over the page, or a filter would
        // drop whoever fell past the take.
        ...(input.filter === "notArrived"
          ? {
              status: TicketStatus.VALID,
              scans: { none: { result: { in: ADMITTING } } },
            }
          : {}),
        ...(input.filter === "arrived"
          ? {
              status: TicketStatus.VALID,
              scans: { some: { result: { in: ADMITTING } } },
            }
          : {}),
        ...(input.filter === "denied"
          ? { scans: { some: { result: TicketScanResult.DENIED } } }
          : {}),
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
      } satisfies Prisma.TicketWhereInput;

      const [tickets, total] = await Promise.all([
        ctx.db.ticket.findMany({
          where,
          // One extra row is how we know whether there is another page.
          take: input.limit + 1,
          ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
          // `ticketNumber` is unique, so this ordering is total and the cursor
          // can't land ambiguously between two people with the same name.
          orderBy: [{ attendeeName: "asc" }, { ticketNumber: "asc" }],
          select: {
            id: true,
            ticketNumber: true,
            attendeeName: true,
            accessLevel: true,
            isComp: true,
            invitedByName: true,
            tier: { select: { name: true } },
            order: {
              select: {
                orderNumber: true,
                buyerName: true,
                buyerEmail: true,
              },
            },
            status: true,
            scans: {
              // Everything that moves a ticket's standing, in one pass. The
              // undos and the departure have to travel with the admissions and
              // refusals or the row below decides on half the story — a person
              // who left would still read "in", and a reverted admission would
              // never stop reading "in" at all.
              where: {
                result: {
                  in: [
                    ...ADMITTING,
                    TicketScanResult.ADMISSION_REVERTED,
                    TicketScanResult.DEPARTED,
                    TicketScanResult.DENIED,
                    TicketScanResult.DENIAL_REVERTED,
                  ],
                },
              },
              orderBy: { createdAt: "desc" },
              // Far more than any real ticket collects; the reduce below needs
              // the whole relevant history to be right.
              take: 40,
              select: {
                createdAt: true,
                deviceLabel: true,
                result: true,
                denyReason: true,
                denyNote: true,
              },
            },
          },
        }),
        ctx.db.ticket.count({ where }),
      ]);

      const hasMore = tickets.length > input.limit;
      const page = hasMore ? tickets.slice(0, input.limit) : tickets;

      return {
        total,
        nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
        rows: page.map((ticket) => {
          // The same reduce the scanner and the check tab run, so a row can
          // never tell staff something the scan would contradict. It also
          // decides the refusal: somebody denied at 10 and let in at 11 is in,
          // and a row still shouting "REFUSED" at them is worse than silence.
          const state = reduceAdmissionState(ticket.scans);

          return {
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            attendeeName: ticket.attendeeName,
            accessLevel: ticket.accessLevel,
            tierName: ticketTypeName(ticket),
            isComp: ticket.isComp,
            invitedByName: ticket.invitedByName,
            orderNumber: ticket.order.orderNumber,
            buyerName: ticket.order.buyerName,
            buyerEmail: ticket.order.buyerEmail,
            status: ticket.status,
            admittedAt: state.admittedAt,
            admittedDevice: state.admission?.deviceLabel ?? null,
            departedAt: state.departedAt,
            departedDevice: state.departure?.deviceLabel ?? null,
            denial: state.denial
              ? {
                  at: state.denial.createdAt,
                  reason: state.denial.denyReason,
                  note: state.denial.denyNote,
                  device: state.denial.deviceLabel,
                }
              : null,
          };
        }),
      };
    }),

  /**
   * One person, in full — the card behind a row in the door list.
   *
   * Reads its "is this person in" and "is there a refusal standing against
   * them" from the same helper the scanner uses, so the list and the scan can
   * never tell staff two different stories about the same ticket.
   */
  ticketDetail: doorProcedure
    .input(z.object({ eventId: z.string(), ticketId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { isManager } = await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      const ticket = await ctx.db.ticket.findUnique({
        where: { id: input.ticketId },
        select: {
          id: true,
          ticketNumber: true,
          attendeeName: true,
          accessLevel: true,
          status: true,
          eventId: true,
          orderId: true,
          isComp: true,
          invitedByName: true,
          nameLockedAt: true,
          hostTicketId: true,
          tier: { select: { name: true } },
          event: {
            select: { isR18: true, reentryAllowed: true, timezone: true },
          },
          order: {
            select: {
              orderNumber: true,
              buyerName: true,
              buyerEmail: true,
              paymentMethod: true,
              _count: { select: { tickets: true } },
            },
          },
        },
      });

      if (!ticket || ticket.eventId !== input.eventId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      }

      const [state, position, timeline] = await Promise.all([
        ticketState(ticket.id),
        ctx.db.ticket.count({
          where: {
            orderId: ticket.orderId,
            ticketNumber: { lte: ticket.ticketNumber },
          },
        }),
        /**
         * Every scan this ticket has ever taken, newest first.
         *
         * `ticketState` answers "are they in right now", which is what the
         * scanner needs mid-queue. This is the other question — what actually
         * happened — and it is the one asked after an argument, when somebody
         * says they were turned away and nobody remembers why. Capped because
         * a genuinely pathological ticket should not be able to stall a sheet.
         */
        ctx.db.ticketScan.findMany({
          where: { ticketId: input.ticketId },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            createdAt: true,
            result: true,
            wasOverride: true,
            denyReason: true,
            denyNote: true,
            deviceLabel: true,
            scannedByUserId: true,
          },
        }),
      ]);

      // `TicketScan.scannedByUserId` is a plain column rather than a relation,
      // so the names come from one extra lookup instead of a join — the same
      // shape `recentScans` uses.
      const staffIds = [
        ...new Set(
          timeline
            .map((scan) => scan.scannedByUserId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const staffNames = new Map(
        (
          await ctx.db.user.findMany({
            where: { id: { in: staffIds } },
            select: { id: true, name: true },
          })
        ).map((user) => [user.id, user.name]),
      );

      return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        attendeeName: ticket.attendeeName,
        accessLevel: ticket.accessLevel,
        tierName: ticketTypeName(ticket),
        isComp: ticket.isComp,
        invitedByName: ticket.invitedByName,
        nameLocked: ticket.nameLockedAt !== null,
        status: ticket.status,
        orderNumber: ticket.order.orderNumber,
        buyerName: ticket.order.buyerName,
        buyerEmail: ticket.order.buyerEmail,
        paymentMethod: ticket.order.paymentMethod,
        positionInOrder: ticket.hostTicketId
          ? `handout ${position - 1} of ${ticket.order._count.tickets - 1}`
          : `${position} of ${ticket.order._count.tickets}`,
        // The "of N" above, as a number, so the sheet knows whether there is
        // anybody else on this order worth offering to show.
        orderTicketCount: ticket.hostTicketId
          ? ticket.order._count.tickets - 1
          : ticket.order._count.tickets,
        isR18: ticket.event.isR18,
        reentryAllowed: ticket.event.reentryAllowed,
        // The timeline prints clock times, and a door in Auckland reads
        // Auckland times whatever the server thinks the hour is.
        timezone: ticket.event.timezone,
        isManager,
        timeline: timeline.map((scan) => ({
          id: scan.id,
          at: scan.createdAt,
          result: scan.result,
          reason: scan.denyReason,
          note: scan.denyNote,
          device: scan.deviceLabel,
          wasOverride: scan.wasOverride,
          by: scan.scannedByUserId
            ? (staffNames.get(scan.scannedByUserId) ?? null)
            : null,
        })),
        ...state,
      };
    }),

  /**
   * The rest of the order behind one ticket — the other three of a "1 of 4".
   *
   * A group buys together and arrives together, so the question staff ask after
   * "is this one real" is "who else is on it, and are they already in". Without
   * this they'd search the buyer's name and eyeball the list.
   *
   * Membership mirrors the `positionInOrder` line exactly, so the count on the
   * button can never disagree with the list behind it: from a comp handout that
   * means the other handouts, and from anything else the whole order. Void and
   * refunded tickets stay in, flagged — a ticket that was refunded this morning
   * is the reason somebody is arguing at the door, and hiding it just moves the
   * argument to the list that quietly dropped it.
   */
  orderTickets: doorProcedure
    .input(z.object({ eventId: z.string(), ticketId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      const ticket = await ctx.db.ticket.findUnique({
        where: { id: input.ticketId },
        select: { id: true, orderId: true, eventId: true, hostTicketId: true },
      });

      if (ticket?.eventId !== input.eventId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      }

      const siblings = await ctx.db.ticket.findMany({
        where: {
          orderId: ticket.orderId,
          eventId: input.eventId,
          // A handout's companions are the other handouts, never the host
          // ticket the comp was minted against.
          ...(ticket.hostTicketId ? { hostTicketId: { not: null } } : {}),
        },
        orderBy: { ticketNumber: "asc" },
        select: {
          id: true,
          ticketNumber: true,
          attendeeName: true,
          accessLevel: true,
          status: true,
          isComp: true,
          invitedByName: true,
          tier: { select: { name: true } },
        },
      });

      const states = await admissionStates(siblings.map((row) => row.id));

      return siblings.map((row, index) => {
        const state = states.get(row.id);
        return {
          id: row.id,
          ticketNumber: row.ticketNumber,
          attendeeName: row.attendeeName,
          accessLevel: row.accessLevel,
          tierName: ticketTypeName(row),
          isComp: row.isComp,
          invitedByName: row.invitedByName,
          isValid: row.status === TicketStatus.VALID,
          status: row.status,
          position: index + 1,
          isCurrent: row.id === ticket.id,
          admittedAt: state?.admittedAt ?? null,
          deniedAt: state?.deniedAt ?? null,
        };
      });
    }),

  /** The tiers a door sale can be rung up against, with what's left. */
  sellableTiers: doorProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      const tiers = await ctx.db.ticketTier.findMany({
        where: { eventId: input.eventId, isActive: true },
        orderBy: { priceCents: "asc" },
        select: {
          id: true,
          name: true,
          priceCents: true,
          allocation: true,
          soldCount: true,
          heldCount: true,
        },
      });

      return tiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        priceCents: tier.priceCents,
        remaining: Math.max(
          0,
          tier.allocation - tier.soldCount - tier.heldCount,
        ),
      }));
    }),

  /**
   * A sale at the door, to somebody who turned up without a ticket.
   *
   * Open to every assigned staffer rather than managers only: the person
   * holding the scanner is the person taking the cash, and a sale that has to
   * wait for a manager is a queue. Their name goes on the order either way.
   */
  sellAtDoor: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        lines: z
          .array(
            z.object({
              tierId: z.string(),
              quantity: z.number().int().min(1).max(20),
            }),
          )
          .min(1),
        paymentMethod: z.enum([
          PaymentMethodKind.CASH,
          PaymentMethodKind.TERMINAL,
        ]),
        buyerName: z.string().trim().max(120).optional(),
        buyerEmail: z.email().optional(),
        notes: z.string().trim().max(500).optional(),
        deviceLabel: z.string().trim().max(60).optional(),
        /** They paid at the door and are walking in; usually both at once. */
        admitNow: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      const sale = await sellAtDoor({
        eventId: input.eventId,
        lines: input.lines,
        paymentMethod: input.paymentMethod,
        buyerName: input.buyerName,
        buyerEmail: input.buyerEmail,
        notes: input.notes,
        soldByUserId: ctx.user.id,
      });

      if (input.admitNow) {
        await admitFreshTickets({
          ticketIds: sale.ticketIds,
          eventId: input.eventId,
          scannedByUserId: ctx.user.id,
          deviceLabel: input.deviceLabel,
        });
      }

      return {
        ...sale,
        admittedNow: input.admitNow,
        admitted: await admittedCount(input.eventId),
      };
    }),

  /**
   * Step one of a Tap to Pay sale: hold the stock, open the payment.
   *
   * This is the branch where the door's usual assumption breaks. Cash and
   * eftpos are a *record* of money that already moved, so `sellAtDoor` can
   * mint tickets in the same breath and nothing can fail in between. A tap
   * happens inside the flow and can decline, so the order is created pending —
   * holding the stock so two staff cannot sell the same last ticket — and no
   * ticket exists until `completeSale` sees the intent succeed.
   */
  createSaleIntent: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        lines: z
          .array(
            z.object({
              tierId: z.string(),
              quantity: z.number().int().min(1).max(20),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Card payments aren't set up yet.",
        });
      }

      const order = await createPendingOrder({
        eventId: input.eventId,
        lines: input.lines,
        ipAddress: null,
        // Accepted verbally by the staff member taking the money, as at any
        // other door sale.
        termsAccepted: true,
        boxOffice: true,
      });

      if (order.isFree) {
        // Nothing to tap for. Fall back to the ordinary path rather than
        // opening a zero-dollar payment.
        await cancelPendingOrder(order.orderId).catch(() => undefined);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That's a free ticket — issue it without a payment.",
        });
      }

      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create(
        {
          amount: order.totalCents,
          currency: "nzd",
          // Tap to Pay is a card-present method; the automatic-methods flag
          // used online would offer wallets that make no sense at a door.
          payment_method_types: ["card_present"],
          capture_method: "automatic",
          metadata: {
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            eventId: input.eventId,
            channel: "door-tap-to-pay",
            soldByUserId: ctx.user.id,
          },
          description: `Door sale — order ${order.orderNumber}`,
        },
        // A retried tap must not open a second payment on the same order.
        { idempotencyKey: `door-pi-${order.orderId}` },
      );

      await ctx.db.ticketOrder.update({
        where: { id: order.orderId },
        data: { stripePaymentIntentId: intent.id },
      });

      return {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        totalCents: order.totalCents,
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
      };
    }),

  /**
   * Step two: the tap went through, so issue.
   *
   * The intent is re-read from Stripe rather than trusted from the client —
   * the app saying "it worked" is not evidence, and this is the exact point
   * where a lie would mint a free ticket.
   */
  completeSale: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        orderId: z.string(),
        deviceLabel: z.string().trim().max(60).optional(),
        admitNow: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      const order = await ctx.db.ticketOrder.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          eventId: true,
          status: true,
          orderNumber: true,
          stripePaymentIntentId: true,
          tickets: { select: { id: true } },
        },
      });

      if (order?.eventId !== input.eventId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      // Already issued — a double tap on "done", or a retried request.
      if (order.status === TicketOrderStatus.PAID) {
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          ticketCount: order.tickets.length,
          admittedNow: false,
          alreadyIssued: true as const,
          admitted: await admittedCount(input.eventId),
        };
      }

      if (!order.stripePaymentIntentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That sale has no payment against it.",
        });
      }

      const stripe = getStripe();
      const intent = await stripe.paymentIntents.retrieve(
        order.stripePaymentIntentId,
        { expand: ["latest_charge"] },
      );

      if (intent.status !== "succeeded") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "That payment hasn't gone through. Try the tap again.",
        });
      }

      const charge =
        typeof intent.latest_charge === "object" ? intent.latest_charge : null;

      const issued = await issueTicketsForOrder({
        orderId: order.id,
        buyerEmail: charge?.billing_details?.email ?? null,
        buyerName: charge?.billing_details?.name ?? null,
        paymentIntentId: intent.id,
        chargeId: charge?.id ?? null,
        paymentMethod: PaymentMethodKind.TAP_TO_PAY,
        soldByUserId: ctx.user.id,
      });

      if (input.admitNow) {
        await admitFreshTickets({
          ticketIds: issued.ticketIds,
          eventId: input.eventId,
          scannedByUserId: ctx.user.id,
          deviceLabel: input.deviceLabel,
        });
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        ticketCount: issued.ticketIds.length,
        admittedNow: input.admitNow,
        alreadyIssued: false as const,
        admitted: await admittedCount(input.eventId),
      };
    }),

  /**
   * Give the stock back when a tap is abandoned or declined for good.
   *
   * Without this the tickets sit held until the hold expires, which at a door
   * means the last two of a sold-out event are invisible for ten minutes while
   * somebody stands there with cash.
   */
  abandonSale: doorProcedure
    .input(z.object({ eventId: z.string(), orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );
      await cancelPendingOrder(input.orderId).catch(() => undefined);
      return { ok: true as const };
    }),

  /**
   * Giving somebody a ticket at the door.
   *
   * Split off from `sellAtDoor` because a comp is not a sale for nothing: it is
   * minted rather than drawn from a tier, so it takes an access level directly
   * and can put an artist on AAA at an event with no AAA tier to sell.
   *
   * The cap is a warning, not a wall — `acknowledge` is what the manager sends
   * back after reading it.
   */
  compAtDoor: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        recipientName: z.string().trim().min(1).max(120),
        recipientEmail: z.email().optional(),
        accessLevel: z.enum(ACCESS_LEVEL_VALUES),
        notes: z.string().trim().max(500).optional(),
        deviceLabel: z.string().trim().max(60).optional(),
        acknowledge: z.boolean().default(false),
        admitNow: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { isManager } = await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      // Giving a ticket away is a manager's call, as it always was.
      if (!isManager) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a door manager can give away a free ticket.",
        });
      }

      const comp = await issueComp({
        eventId: input.eventId,
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
        accessLevel: input.accessLevel,
        notes: input.notes,
        acknowledge: input.acknowledge,
        issuedByUserId: ctx.user.id,
      });

      if (input.admitNow) {
        await admitFreshTickets({
          ticketIds: [comp.hostTicketId],
          eventId: input.eventId,
          scannedByUserId: ctx.user.id,
          deviceLabel: input.deviceLabel,
        });
      }

      if (input.recipientEmail) {
        await sendCompTicketEmail({ ticketId: comp.hostTicketId });
      }

      await logActivity({
        type: ActivityType.TICKET_COMPED,
        action: `Door comp — ${input.accessLevel} for ${input.recipientName}`,
        userId: ctx.user.id,
        details: { eventId: input.eventId, orderId: comp.orderId },
      });

      return {
        ...comp,
        admittedNow: input.admitNow,
        admitted: await admittedCount(input.eventId),
      };
    }),

  /** The comp counts behind the door's own over-cap warning. */
  compAccounting: doorProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );
      return compAccounting(input.eventId, ctx.db);
    }),

  /** Live feed for the scanner footer and the admin live view. */
  recentScans: doorProcedure
    .input(
      z.object({
        eventId: z.string(),
        limit: z.number().int().min(1).max(50).default(20),
        /** Only what this staffer did, which is what an undo list is for. */
        mine: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { isManager } = await assertAssigned(
        ctx.user.id,
        ctx.isAdmin,
        ctx.isEventOrganiser,
        input.eventId,
      );

      const scans = await ctx.db.ticketScan.findMany({
        where: {
          eventId: input.eventId,
          ...(input.mine ? { scannedByUserId: ctx.user.id } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          result: true,
          createdAt: true,
          deviceLabel: true,
          wasOverride: true,
          scannedByUserId: true,
          ticketId: true,
          // A refusal without its reason is the thing staff end up arguing
          // about, so it travels with the row rather than needing the sheet.
          denyReason: true,
          denyNote: true,
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

      /**
       * What can still be taken back from this list.
       *
       * Decided against the ticket's *current* state, not the row's, so a
       * scan that has already been undone or overtaken stops offering an
       * undo. One query for the whole page via `admissionStates`.
       */
      const ticketIds = [
        ...new Set(
          scans
            .map((scan) => scan.ticketId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const states = await admissionStates(ticketIds);

      return scans.map((scan) => {
        const state = scan.ticketId ? states.get(scan.ticketId) : undefined;
        const mine = scan.scannedByUserId === ctx.user.id;
        const admitting = (ADMITTING_RESULTS as readonly string[]).includes(
          scan.result,
        );

        return {
          ...scan,
          scannedByName: scan.scannedByUserId
            ? (nameById.get(scan.scannedByUserId) ?? null)
            : null,
          isMine: mine,
          // Admissions: only while they still stand, and only yours unless you
          // manage the door. Refusals: any staffer, same as `revertDenial`.
          undo:
            admitting && state?.admittedAt && (isManager || mine)
              ? ("admission" as const)
              : scan.result === TicketScanResult.DENIED && state?.deniedAt
                ? ("denial" as const)
                : null,
        };
      });
    }),
});
