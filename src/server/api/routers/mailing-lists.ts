import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ActivityType, Prisma } from "~Prisma/client";
import { normaliseTag } from "~/lib/ticketing/campaigns";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { logActivity } from "~/server/utils/activity-log";

/**
 * Mailing lists. Archiving hides a list from the preferences page, signup
 * forms and new mailouts, and keeps its members and history. Lists are never
 * deleted: a membership row is the record of consent.
 */

const listFields = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).nullable(),
  public: z.boolean(),
});

export const mailingListsRouter = createTRPCRouter({
  /** Every list with who is on it: subscribed, left, and suppressed. */
  list: adminProcedure.query(async ({ ctx }) => {
    const lists = await ctx.db.mailingList.findMany({
      orderBy: [
        { archivedAt: { sort: "desc", nulls: "first" } },
        { name: "asc" },
      ],
    });
    const counts = await ctx.db.$queryRaw<
      {
        listId: string;
        subscribed: number;
        left: number;
        suppressed: number;
        joined30: number;
      }[]
    >`
      SELECT m."listId",
        COUNT(*) FILTER (WHERE m."unsubscribedAt" IS NULL AND s."suppressedAt" IS NULL)::int AS "subscribed",
        COUNT(*) FILTER (WHERE m."unsubscribedAt" IS NOT NULL)::int AS "left",
        COUNT(*) FILTER (WHERE m."unsubscribedAt" IS NULL AND s."suppressedAt" IS NOT NULL)::int AS "suppressed",
        COUNT(*) FILTER (WHERE m."unsubscribedAt" IS NULL AND m."subscribedAt" > ${new Date(Date.now() - 30 * 86_400_000)})::int AS "joined30"
      FROM "list_membership" m
      JOIN "subscriber" s ON s."id" = m."subscriberId"
      GROUP BY m."listId"`;
    return lists.map((list) => {
      const row = counts.find((count) => count.listId === list.id);
      return {
        ...list,
        subscribed: row?.subscribed ?? 0,
        left: row?.left ?? 0,
        suppressed: row?.suppressed ?? 0,
        joined30: row?.joined30 ?? 0,
      };
    });
  }),

  create: adminProcedure.input(listFields).mutation(async ({ ctx, input }) => {
    const slug = normaliseTag(input.name).replace(/\./g, "-") || "list";
    try {
      const list = await ctx.db.mailingList.create({
        data: { ...input, slug },
      });
      await logActivity({
        type: ActivityType.MAILING_LIST_CREATED,
        action: `Created mailing list "${list.name}"`,
        userId: ctx.session.user.id,
        details: { listId: list.id },
      });
      return list;
    } catch (cause) {
      if (
        cause instanceof Prisma.PrismaClientKnownRequestError &&
        cause.code === "P2002"
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "There is already a list with that name.",
        });
      }
      throw cause;
    }
  }),

  /** Rename, describe, or make public or private. The slug stays, since code
   * signs people up by it. */
  update: adminProcedure
    .input(listFields.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const list = await ctx.db.mailingList.update({ where: { id }, data });
      await logActivity({
        type: ActivityType.MAILING_LIST_UPDATED,
        action: `Updated mailing list "${list.name}"`,
        userId: ctx.session.user.id,
        details: { listId: id, ...data },
      });
      return list;
    }),

  archive: adminProcedure
    .input(z.object({ id: z.string(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const list = await ctx.db.mailingList.update({
        where: { id: input.id },
        data: { archivedAt: input.archived ? new Date() : null },
      });
      await logActivity({
        type: ActivityType.MAILING_LIST_UPDATED,
        action: `${input.archived ? "Archived" : "Restored"} mailing list "${list.name}"`,
        userId: ctx.session.user.id,
        details: { listId: list.id },
      });
      return list;
    }),
});
