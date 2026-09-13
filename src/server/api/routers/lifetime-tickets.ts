import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ActivityType, LifetimeTicketStatus } from "~Prisma/client";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import {
  createLifetimeTicket,
  findLifetimeByAccessToken,
  lifetimeAccessToken,
} from "~/server/ticketing/lifetime";
import { sendLifetimeEmail } from "~/server/ticketing/email/send";
import {
  buildLifetimeQrPayload,
  generateQrSecret,
} from "~/server/ticketing/qr";
import { renderQrSvg } from "~/server/ticketing/qr-image";
import { lifetimePassUrl, lifetimeUrl } from "~/server/ticketing/urls";
import { isAppleWalletConfigured } from "~/server/wallet/apple-config";
import { lifetimeSerial } from "~/server/wallet/apple-lifetime";
import { schedulePassUpdate } from "~/server/wallet/apple-push";
import { logActivity } from "~/server/utils/activity-log";
import type { db as Database } from "~/server/db";

/**
 * Lifetime passes, from the office.
 *
 * Issued here, sent from here, and read back from here: the usage log is the
 * scans of the per-event tickets a pass minted, which is the same history the
 * door sees on the night. See `~/server/ticketing/lifetime` for the model.
 */

const LEVEL_CODE = z.string().trim().toUpperCase().min(2).max(24);

/** Levels come from the table, not the retired enum, so a custom one works. */
async function assertLevel(
  db: Pick<typeof Database, "accessLevel">,
  code: string,
): Promise<void> {
  const level = await db.accessLevel.findUnique({
    where: { code },
    select: { archived: true },
  });
  if (!level || level.archived) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That access level isn't available.",
    });
  }
}

/** What both the list and the detail carry about a pass. */
const SUMMARY_SELECT = {
  id: true,
  number: true,
  holderName: true,
  holderEmail: true,
  accessLevel: true,
  notes: true,
  status: true,
  revokedAt: true,
  revokeReason: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { tickets: true } },
  // The most recent event it was used at. A ticket is minted on the first
  // scan at an event, so "newest ticket" is "last event attended".
  tickets: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      createdAt: true,
      event: { select: { id: true, name: true } },
    },
  },
} as const;

function summarise<
  T extends {
    _count: { tickets: number };
    tickets: { createdAt: Date; event: { id: string; name: string } }[];
  },
>(row: T) {
  const { _count, tickets, ...rest } = row;
  const last = tickets[0] ?? null;
  return {
    ...rest,
    eventsUsedAt: _count.tickets,
    lastUsed: last ? { at: last.createdAt, event: last.event } : null,
  };
}

export const lifetimeTicketsRouter = createTRPCRouter({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.lifetimeTicket.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: SUMMARY_SELECT,
    });
    return rows.map(summarise);
  }),

  /**
   * One pass in full, with everywhere it has been.
   *
   * The log is every scan of every ticket the pass minted, newest first —
   * admissions, re-entries, refusals and the rest, exactly as the door
   * recorded them, with the event each happened at.
   */
  byId: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.lifetimeTicket.findUnique({
        where: { id: input.id },
        select: { ...SUMMARY_SELECT, accessTokenVersion: true },
      });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pass not found" });
      }

      const [scans, events] = await Promise.all([
        ctx.db.ticketScan.findMany({
          where: { ticket: { lifetimeTicketId: input.id } },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            result: true,
            createdAt: true,
            deviceLabel: true,
            wasOverride: true,
            denyReason: true,
            denyNote: true,
            scannedByUserId: true,
            event: {
              select: { id: true, name: true, timezone: true },
            },
          },
        }),
        ctx.db.ticket.findMany({
          where: { lifetimeTicketId: input.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            ticketNumber: true,
            accessLevel: true,
            createdAt: true,
            event: {
              select: {
                id: true,
                name: true,
                startsAt: true,
                timezone: true,
              },
            },
          },
        }),
      ]);

      // `scannedByUserId` is a plain column, so names come from one lookup.
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

      const { accessTokenVersion, ...summary } = row;
      const token = lifetimeAccessToken({ id: row.id, accessTokenVersion });

      return {
        ...summarise(summary),
        holderUrl: lifetimeUrl(token),
        appleWalletUrl: isAppleWalletConfigured()
          ? lifetimePassUrl(row.id, token)
          : null,
        events,
        log: scans.map((scan) => ({
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
          event: scan.event,
        })),
      };
    }),

  /**
   * The holder's own view, authenticated by the link in their email.
   *
   * A revoked pass still resolves so the page can say so, rather than turning
   * into a dead link with no explanation.
   */
  byToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const lifetime = await findLifetimeByAccessToken(input.token);
      if (!lifetime) return null;

      const active = lifetime.status === LifetimeTicketStatus.ACTIVE;
      return {
        number: lifetime.number,
        holderName: lifetime.holderName,
        accessLevel: lifetime.accessLevel,
        active,
        qrSvg: active
          ? await renderQrSvg(buildLifetimeQrPayload(lifetime))
          : null,
        appleWalletUrl:
          active && isAppleWalletConfigured()
            ? lifetimePassUrl(lifetime.id, input.token)
            : null,
      };
    }),

  create: adminProcedure
    .input(
      z.object({
        holderName: z.string().trim().min(1, "Whose pass is it?").max(120),
        holderEmail: z.email().optional(),
        accessLevel: LEVEL_CODE,
        notes: z.string().trim().max(500).optional(),
        /** Email it straight away, when there is an address to send to. */
        sendEmail: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertLevel(ctx.db, input.accessLevel);

      const lifetime = await createLifetimeTicket({
        holderName: input.holderName,
        holderEmail: input.holderEmail,
        accessLevel: input.accessLevel,
        notes: input.notes,
        createdByUserId: ctx.session.user.id,
      });

      await logActivity({
        type: ActivityType.LIFETIME_TICKET_CREATED,
        action: `Issued lifetime pass ${lifetime.number} (${input.accessLevel}) to ${input.holderName}`,
        userId: ctx.session.user.id,
        details: { lifetimeTicketId: lifetime.id },
      });

      const email =
        input.sendEmail && input.holderEmail
          ? await sendLifetimeEmail({ lifetimeId: lifetime.id })
          : null;

      return {
        id: lifetime.id,
        number: lifetime.number,
        holderUrl: lifetimeUrl(lifetimeAccessToken(lifetime)),
        emailedTo: email?.ok ? (email.sentTo ?? null) : null,
        emailError: email && !email.ok ? (email.error ?? null) : null,
      };
    }),

  /**
   * Change who or what a pass is for.
   *
   * A new level takes effect at the next event: tickets already minted for
   * past nights keep the level they were scanned in on. The wallet pass is
   * told to refresh so the chip on it moves too.
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        holderName: z.string().trim().min(1).max(120).optional(),
        holderEmail: z.email().nullable().optional(),
        accessLevel: LEVEL_CODE.optional(),
        notes: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.accessLevel) await assertLevel(ctx.db, input.accessLevel);

      const { id, ...patch } = input;
      const lifetime = await ctx.db.lifetimeTicket.update({
        where: { id },
        data: {
          ...(patch.holderName !== undefined
            ? { holderName: patch.holderName }
            : {}),
          ...(patch.holderEmail !== undefined
            ? { holderEmail: patch.holderEmail?.toLowerCase() ?? null }
            : {}),
          ...(patch.accessLevel !== undefined
            ? { accessLevel: patch.accessLevel }
            : {}),
          ...(patch.notes !== undefined
            ? { notes: patch.notes === "" ? null : patch.notes }
            : {}),
        },
        select: { id: true, number: true },
      });

      await logActivity({
        type: ActivityType.LIFETIME_TICKET_UPDATED,
        action: `Updated lifetime pass ${lifetime.number}`,
        userId: ctx.session.user.id,
        details: { lifetimeTicketId: lifetime.id, patch },
      });

      schedulePassUpdate(lifetimeSerial(lifetime.id));
      return { ok: true as const };
    }),

  /** Take a pass away. The QR stops scanning and the wallet pass greys out. */
  revoke: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().trim().min(1, "Say why").max(300),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lifetime = await ctx.db.lifetimeTicket.update({
        where: { id: input.id },
        data: {
          status: LifetimeTicketStatus.REVOKED,
          revokedAt: new Date(),
          revokeReason: input.reason,
        },
        select: { id: true, number: true, holderName: true },
      });

      await logActivity({
        type: ActivityType.LIFETIME_TICKET_REVOKED,
        action: `Revoked lifetime pass ${lifetime.number} (${lifetime.holderName})`,
        userId: ctx.session.user.id,
        details: { lifetimeTicketId: lifetime.id, reason: input.reason },
      });

      schedulePassUpdate(lifetimeSerial(lifetime.id));
      return { ok: true as const };
    }),

  reinstate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const lifetime = await ctx.db.lifetimeTicket.update({
        where: { id: input.id },
        data: {
          status: LifetimeTicketStatus.ACTIVE,
          revokedAt: null,
          revokeReason: null,
        },
        select: { id: true, number: true },
      });

      await logActivity({
        type: ActivityType.LIFETIME_TICKET_UPDATED,
        action: `Reinstated lifetime pass ${lifetime.number}`,
        userId: ctx.session.user.id,
        details: { lifetimeTicketId: lifetime.id },
      });

      schedulePassUpdate(lifetimeSerial(lifetime.id));
      return { ok: true as const };
    }),

  /**
   * A fresh QR and a fresh link, for a pass that got screenshotted around.
   *
   * The old code stops scanning at once; a wallet already holding the pass is
   * pushed the new one, so the holder's own phone keeps working.
   */
  reissue: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const lifetime = await ctx.db.lifetimeTicket.update({
        where: { id: input.id },
        data: {
          qrSecret: generateQrSecret(),
          qrVersion: { increment: 1 },
          accessTokenVersion: { increment: 1 },
        },
        select: { id: true, number: true, accessTokenVersion: true },
      });

      await logActivity({
        type: ActivityType.LIFETIME_TICKET_UPDATED,
        action: `Reissued the code on lifetime pass ${lifetime.number}`,
        userId: ctx.session.user.id,
        details: { lifetimeTicketId: lifetime.id },
      });

      schedulePassUpdate(lifetimeSerial(lifetime.id));
      return { holderUrl: lifetimeUrl(lifetimeAccessToken(lifetime)) };
    }),

  /** Email the pass to its holder, or to somewhere else. */
  send: adminProcedure
    .input(z.object({ id: z.string(), email: z.email().optional() }))
    .mutation(async ({ input }) => {
      const result = await sendLifetimeEmail({
        lifetimeId: input.id,
        overrideEmail: input.email,
      });
      if (!result.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error ?? "That didn't send.",
        });
      }
      return { sentTo: result.sentTo ?? null };
    }),

  /**
   * Delete a pass that was never used.
   *
   * Once it has been scanned in anywhere there is a night on record against
   * it, and that stays: revoke instead.
   */
  remove: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const lifetime = await ctx.db.lifetimeTicket.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          number: true,
          holderName: true,
          _count: { select: { tickets: true } },
        },
      });
      if (!lifetime) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pass not found" });
      }
      if (lifetime._count.tickets > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "This pass has been used to get in, so it can't be deleted. Revoke it instead.",
        });
      }

      await ctx.db.lifetimeTicket.delete({ where: { id: input.id } });

      await logActivity({
        type: ActivityType.LIFETIME_TICKET_DELETED,
        action: `Deleted unused lifetime pass ${lifetime.number} (${lifetime.holderName})`,
        userId: ctx.session.user.id,
        details: { lifetimeTicketId: lifetime.id },
      });

      return { ok: true as const };
    }),
});
