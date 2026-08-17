import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ActivityType } from "~Prisma/client";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import {
  banPatron,
  liftBan,
  patronDossier,
  previewIdentity,
  purgePatron,
  RETENTION_DAYS,
} from "~/server/ticketing/id-check";
import { DENY_REASON_VALUES } from "~/lib/ticketing/deny-reasons";
import { DEFAULT_EVENT_TIMEZONE } from "~/lib/ticketing/dates";
import { ID_DOCUMENT_TYPES } from "~/lib/ticketing/id-documents";
import { logActivity } from "~/server/utils/activity-log";

/**
 * The people the door has checked, from the office rather than the doorway.
 *
 * This exists for three jobs that cannot be done on a phone at midnight:
 * looking up why somebody was barred, lifting a ban that has served its
 * purpose, and answering a person who asks what is held about them and to have
 * it deleted. The last one is not a nice-to-have — the Privacy Act gives them
 * the right to ask, and a system with no way to answer is a system that cannot
 * be operated lawfully.
 *
 * Admin-only. Door managers can ban and lift through the door router while they
 * are working an event; browsing the whole list of everybody we have ever
 * checked is a different thing, and stays here.
 */
export const patronsRouter = createTRPCRouter({
  /** How long records are kept, so the UI can state it rather than restate it. */
  retention: adminProcedure.query(() => ({ days: RETENTION_DAYS })),

  /**
   * Read a document and report what a door *would* decide, writing nothing.
   *
   * The test bench. Somebody checking whether the parser copes with a new
   * licence design should not be creating patron records for a colleague's
   * licence, arming a 90-day retention clock on them, or putting rows into the
   * count a door reads back — so this is read-only, like `checkTicket` is on
   * the door router.
   */
  previewRead: adminProcedure
    .input(
      z.object({
        /** Judge it against an R18 event's rules, which is the usual case. */
        isR18: z.boolean().default(true),
        timeZone: z.string().max(60).default(DEFAULT_EVENT_TIMEZONE),
        reading: z.discriminatedUnion("kind", [
          z.object({
            kind: z.literal("ocr"),
            lines: z.array(z.string().max(300)).max(200),
          }),
          z.object({
            kind: z.literal("fields"),
            documentType: z.enum(ID_DOCUMENT_TYPES),
            documentNumber: z.string().trim().max(40).optional(),
            fullName: z.string().trim().min(1).max(120),
            dateOfBirth: z.iso.date(),
            expiry: z.iso.date().optional(),
          }),
        ]),
      }),
    )
    .mutation(({ input }) =>
      previewIdentity({
        reading: input.reading,
        isR18: input.isR18,
        timeZone: input.timeZone,
      }),
    ),

  /**
   * Find somebody.
   *
   * Deliberately not a browsable list of every member of the public we have
   * ever seen: with no query and no filter this returns the banned, because
   * that is the only reason to open this page without a name in mind.
   */
  search: adminProcedure
    .input(
      z.object({
        query: z.string().trim().max(120).default(""),
        onlyBanned: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const activeBan = {
        liftedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      };

      const bannedOnly = input.onlyBanned || input.query.length === 0;

      const patrons = await ctx.db.patron.findMany({
        where: {
          ...(input.query
            ? { fullName: { contains: input.query, mode: "insensitive" } }
            : {}),
          ...(bannedOnly ? { bans: { some: activeBan } } : {}),
        },
        orderBy: { lastSeenAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          fullName: true,
          dateOfBirth: true,
          documentType: true,
          lastSeenAt: true,
          checkCount: true,
          purgeAfter: true,
          photoKey: true,
          bans: {
            where: activeBan,
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, reason: true, note: true, expiresAt: true },
          },
        },
      });

      return {
        /** True when the result is the ban list rather than a name search. */
        showingBannedOnly: bannedOnly,
        patrons: patrons.map((patron) => ({
          id: patron.id,
          fullName: patron.fullName,
          dateOfBirth: patron.dateOfBirth,
          documentType: patron.documentType,
          lastSeenAt: patron.lastSeenAt,
          checkCount: patron.checkCount,
          purgeAfter: patron.purgeAfter,
          hasPhoto: patron.photoKey !== null,
          ban: patron.bans[0] ?? null,
        })),
      };
    }),

  /** Everything held about one person — which is also the subject-access answer. */
  detail: adminProcedure
    .input(z.object({ patronId: z.string() }))
    .query(async ({ input }) => {
      const dossier = await patronDossier(input.patronId);
      if (!dossier) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such record." });
      }
      return dossier;
    }),

  ban: adminProcedure
    .input(
      z.object({
        patronId: z.string(),
        reason: z.enum(DENY_REASON_VALUES),
        note: z.string().trim().max(300).optional(),
        expiresInDays: z.number().int().min(1).max(3650).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { banId, patronName } = await banPatron({
        patronId: input.patronId,
        reason: input.reason,
        note: input.note ?? null,
        expiresAt: input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : null,
        createdByUserId: ctx.user.id,
      });

      await logActivity({
        type: ActivityType.PATRON_BANNED,
        action: `Banned ${patronName} (${input.reason})`,
        userId: ctx.user.id,
        details: { patronId: input.patronId, banId, reason: input.reason },
      });

      return { banId };
    }),

  liftBan: adminProcedure
    .input(
      z.object({
        banId: z.string(),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { patronId, patronName } = await liftBan({
        banId: input.banId,
        note: input.note ?? null,
        liftedByUserId: ctx.user.id,
      });

      await logActivity({
        type: ActivityType.PATRON_BAN_LIFTED,
        action: `Lifted the ban on ${patronName}`,
        userId: ctx.user.id,
        details: { patronId, banId: input.banId },
      });

      return { patronId };
    }),

  /**
   * Delete somebody's record now, ahead of its expiry.
   *
   * Deletes it whether or not a ban stands, which is deliberate: an erasure
   * request is not conditional on us finding the person convenient. The ban row
   * goes with the record, so the effect of honouring one is that the ban stops
   * working — the person doing this should know that, and the UI says so.
   */
  purge: adminProcedure
    .input(z.object({ patronId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const dossier = await patronDossier(input.patronId);
      if (!dossier) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such record." });
      }

      await purgePatron(input.patronId);

      await logActivity({
        type: ActivityType.PATRON_PURGED,
        action: `Deleted the ID record for ${dossier.fullName}`,
        userId: ctx.user.id,
        details: {
          patronId: input.patronId,
          hadActiveBan: dossier.bans.some((ban) => ban.active),
        },
      });

      return { deleted: true };
    }),
});
