import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  ActivityType,
  SuppressionReason,
  UnsubscribeVia,
  type Prisma,
} from "~Prisma/client";
import { normaliseEmail } from "~/lib/mailouts/emails";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  importToList,
  subscribe,
  unsubscribe,
} from "~/server/mailouts/subscribers";
import { logActivity } from "~/server/utils/activity-log";

/**
 * Everyone marketing can reach, the lists they are on, and how they got
 * there. Replaces the old Newsletter page.
 */

const statusFilter = z.enum(["subscribed", "left", "suppressed"]);

export const subscribersRouter = createTRPCRouter({
  /** Filtered by address, list and status. A status needs a list, except
   * suppressed, which is about the address. */
  list: adminProcedure
    .input(
      z.object({
        search: z.string().trim().max(200).optional(),
        listId: z.string().optional(),
        status: statusFilter.optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const membership: Prisma.ListMembershipWhereInput = {
        ...(input.listId ? { listId: input.listId } : {}),
        ...(input.status === "subscribed" ? { unsubscribedAt: null } : {}),
        ...(input.status === "left" ? { unsubscribedAt: { not: null } } : {}),
      };
      return ctx.db.subscriber.findMany({
        where: {
          ...(input.search
            ? { email: { contains: input.search, mode: "insensitive" } }
            : {}),
          ...(input.listId ||
          input.status === "subscribed" ||
          input.status === "left"
            ? { memberships: { some: membership } }
            : {}),
          ...(input.status === "suppressed"
            ? { suppressedAt: { not: null } }
            : input.status === "subscribed"
              ? { suppressedAt: null }
              : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
        select: {
          id: true,
          email: true,
          createdAt: true,
          suppressedAt: true,
          suppressedReason: true,
          memberships: {
            select: {
              listId: true,
              unsubscribedAt: true,
            },
          },
        },
      });
    }),

  /** One person: their lists with how they joined and left, and every
   * mailout sent to them. */
  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const subscriber = await ctx.db.subscriber.findUnique({
        where: { id: input.id },
        include: {
          memberships: {
            include: { list: { select: { name: true, archivedAt: true } } },
            orderBy: { subscribedAt: "asc" },
          },
          received: {
            orderBy: { sentAt: { sort: "desc", nulls: "last" } },
            take: 100,
            include: { mailout: { select: { subject: true } } },
          },
        },
      });
      if (!subscriber) throw new TRPCError({ code: "NOT_FOUND" });
      return subscriber;
    }),

  /** Add one address to a list. Never puts back someone who left it. */
  add: adminProcedure
    .input(z.object({ email: z.email(), listId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const list = await ctx.db.mailingList.findUnique({
        where: { id: input.listId },
      });
      if (!list || list.archivedAt) throw new TRPCError({ code: "NOT_FOUND" });
      const result = await subscribe(ctx.db, {
        email: input.email,
        list: list.slug,
        source: `admin:${ctx.session.user.id}`,
        rejoin: false,
      });
      if (result === "left") {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${normaliseEmail(input.email)} unsubscribed from ${list.name}. Only they can rejoin.`,
        });
      }
      return { result };
    }),

  /** Paste or upload addresses into a list, with the admin saying these
   * people agreed to it. */
  import: adminProcedure
    .input(
      z.object({
        listId: z.string(),
        // Read out of a paste by `extractEmails`, which is looser than this
        // schema; the ones that fail are counted rather than failing the lot.
        emails: z.array(z.string().max(254)).min(1).max(20_000),
        consent: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const list = await ctx.db.mailingList.findUnique({
        where: { id: input.listId },
      });
      if (!list || list.archivedAt) throw new TRPCError({ code: "NOT_FOUND" });
      const valid = input.emails.filter(
        (email) => z.email().safeParse(email.trim()).success,
      );
      const counts = {
        ...(await importToList(list.id, valid, "import")),
        invalid: input.emails.length - valid.length,
      };
      await logActivity({
        type: ActivityType.SUBSCRIBERS_IMPORTED,
        action: `Imported ${counts.added} into ${list.name}`,
        userId: ctx.session.user.id,
        details: { listId: list.id, ...counts },
      });
      return counts;
    }),

  /** Take someone off a list. Admins can remove but not re-add: rejoining is
   * theirs to do, from a signup form or their preferences page. */
  removeFromList: adminProcedure
    .input(z.object({ id: z.string(), listId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await unsubscribe(ctx.db, {
        subscriberId: input.id,
        listIds: [input.listId],
        via: UnsubscribeVia.ADMIN,
      });
      return { ok: true };
    }),

  /** Mail them again after a bounce, say once they fixed their mailbox. A
   * spam complaint cannot be undone here. */
  unsuppress: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.subscriber.updateMany({
        where: {
          id: input.id,
          suppressedReason: {
            in: [SuppressionReason.BOUNCED, SuppressionReason.RESEND],
          },
        },
        data: { suppressedAt: null, suppressedReason: null },
      });
      if (!count) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only a bounce can be cleared.",
        });
      }
      return { ok: true };
    }),

  /** Forget an address entirely, history and all. */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const subscriber = await ctx.db.subscriber.delete({
        where: { id: input.id },
      });
      // The old table is copied across once more after the deploy; without
      // this, that copy would bring them back.
      await ctx.db.newsletterSubscription.deleteMany({
        where: { email: { equals: subscriber.email, mode: "insensitive" } },
      });
      await logActivity({
        type: ActivityType.SUBSCRIBER_DELETED,
        action: `Deleted subscriber ${subscriber.email}`,
        userId: ctx.session.user.id,
      });
      return { ok: true };
    }),
});
