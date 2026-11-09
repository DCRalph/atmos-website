import { TRPCError } from "@trpc/server";
import { after } from "next/server";
import { z } from "zod";

import {
  ActivityType,
  MailoutRecipientStatus,
  MailoutStatus,
  Prisma,
} from "~Prisma/client";
import { normaliseTag } from "~/lib/ticketing/campaigns";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  audienceWhere,
  cancelMailout,
  drainMailouts,
  retryFailed,
  sendProblem,
  sendTest,
  startMailout,
} from "~/server/mailouts/send";
import { BOUGHT_ORDER } from "~/server/ticketing/order-sql";
import { logActivity } from "~/server/utils/activity-log";

/**
 * Mailouts: marketing email to mailing lists. Drafts are edited freely;
 * sending, scheduling and cancelling are separate verbs, which Will GPT's
 * policy treats as asking the admin first.
 */

const id = z.object({ id: z.string() });

const draftFields = z.object({
  subject: z.string().max(200),
  previewText: z.string().max(200).nullable(),
  heading: z.string().max(200).nullable(),
  body: z.unknown().nullable(),
  imageFileId: z.string().nullable(),
  buttonLabel: z.string().max(60).nullable(),
  buttonUrl: z.string().max(2000).nullable(),
  listIds: z.array(z.string()).max(50),
});

/** `utm_campaign` for a mailout: its subject, plus a bit of its id so two
 * mailouts with the same subject stay apart. */
function slugFor(subject: string, mailoutId: string) {
  const base = normaliseTag(subject)
    .replace(/\./g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return `${base || "mailout"}-${mailoutId.slice(-6)}`;
}

async function findOrThrow(db: Prisma.TransactionClient, mailoutId: string) {
  const mailout = await db.mailout.findUnique({ where: { id: mailoutId } });
  if (!mailout) throw new TRPCError({ code: "NOT_FOUND" });
  return mailout;
}

/** Start sending in the background, after this response has gone. The cron
 * finishes anything this does not get through. */
function kick() {
  after(() => drainMailouts());
}

export const mailoutsRouter = createTRPCRouter({
  /** Every mailout, newest first, with how far each got. */
  list: adminProcedure.query(async ({ ctx }) => {
    const [mailouts, counts] = await Promise.all([
      ctx.db.mailout.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          subject: true,
          status: true,
          listIds: true,
          scheduledFor: true,
          startedAt: true,
          createdAt: true,
        },
      }),
      ctx.db.mailoutRecipient.groupBy({
        by: ["mailoutId", "status"],
        _count: { _all: true },
      }),
    ]);
    return mailouts.map((mailout) => {
      const mine = counts.filter((row) => row.mailoutId === mailout.id);
      const of = (status: MailoutRecipientStatus) =>
        mine.find((row) => row.status === status)?._count._all ?? 0;
      return {
        ...mailout,
        recipients: mine.reduce((sum, row) => sum + row._count._all, 0),
        sent: of(MailoutRecipientStatus.SENT),
      };
    });
  }),

  /** One mailout, and once it has started, what happened. */
  get: adminProcedure.input(id).query(async ({ ctx, input }) => {
    const mailout = await findOrThrow(ctx.db, input.id);
    const [byStatus, events, unsubscribed, orders] = await Promise.all([
      ctx.db.mailoutRecipient.groupBy({
        by: ["status"],
        where: { mailoutId: mailout.id },
        _count: { _all: true },
      }),
      ctx.db.mailoutRecipient.aggregate({
        where: { mailoutId: mailout.id },
        _count: {
          deliveredAt: true,
          bouncedAt: true,
          complainedAt: true,
          openedAt: true,
          clickedAt: true,
        },
      }),
      // People, not list rows: leaving two lists from one link is one person.
      ctx.db.$queryRaw<{ people: number }[]>`
        SELECT COUNT(DISTINCT "subscriberId")::int AS "people"
        FROM "list_membership"
        WHERE "unsubscribedFromMailoutId" = ${mailout.id}`,
      ctx.db.$queryRaw<{ orders: number; revenueCents: number }[]>`
        SELECT COUNT(*)::int AS "orders",
          COALESCE(SUM(o."totalCents" - o."refundedCents"), 0)::int AS "revenueCents"
        FROM "ticket_order" o
        WHERE ${BOUGHT_ORDER}
          AND o."utmSource" = 'email'
          AND o."utmCampaign" = ${mailout.slug}`,
    ]);
    const of = (status: MailoutRecipientStatus) =>
      byStatus.find((row) => row.status === status)?._count._all ?? 0;
    return {
      ...mailout,
      results: {
        queued: of(MailoutRecipientStatus.QUEUED),
        sent: of(MailoutRecipientStatus.SENT),
        failed: of(MailoutRecipientStatus.FAILED),
        skipped: of(MailoutRecipientStatus.SKIPPED),
        delivered: events._count.deliveredAt,
        bounced: events._count.bouncedAt,
        complained: events._count.complainedAt,
        opened: events._count.openedAt,
        clicked: events._count.clickedAt,
        unsubscribed: unsubscribed[0]?.people ?? 0,
        orders: orders[0]?.orders ?? 0,
        revenueCents: orders[0]?.revenueCents ?? 0,
      },
    };
  }),

  /** The recipients that did not get it, and why, for the results view. */
  problems: adminProcedure.input(id).query(({ ctx, input }) =>
    ctx.db.mailoutRecipient.findMany({
      where: {
        mailoutId: input.id,
        OR: [
          { status: MailoutRecipientStatus.FAILED },
          { bouncedAt: { not: null } },
          { complainedAt: { not: null } },
        ],
      },
      orderBy: { email: "asc" },
      take: 200,
      select: {
        id: true,
        email: true,
        status: true,
        error: true,
        bouncedAt: true,
        complainedAt: true,
      },
    }),
  ),

  /** How many people a set of lists reaches right now, counted once each. */
  audience: adminProcedure
    .input(z.object({ listIds: z.array(z.string()).max(50) }))
    .query(({ ctx, input }) =>
      input.listIds.length
        ? ctx.db.subscriber.count({ where: audienceWhere(input.listIds) })
        : 0,
    ),

  create: adminProcedure.mutation(async ({ ctx }) => {
    const newsletter = await ctx.db.mailingList.findUnique({
      where: { slug: "newsletter" },
      select: { id: true },
    });
    const mailout = await ctx.db.mailout.create({
      data: {
        slug: `mailout-${crypto.randomUUID()}`,
        listIds: newsletter ? [newsletter.id] : [],
        createdById: ctx.session.user.id,
      },
      select: { id: true },
    });
    return ctx.db.mailout.update({
      where: { id: mailout.id },
      data: { slug: slugFor("", mailout.id) },
      select: { id: true },
    });
  }),

  /** Save a draft. Only drafts: a scheduled mailout is unscheduled first. */
  update: adminProcedure
    .input(draftFields.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id: mailoutId, body, ...fields } = input;
      const { count } = await ctx.db.mailout.updateMany({
        where: { id: mailoutId, status: MailoutStatus.DRAFT },
        data: {
          ...fields,
          body: body === null ? Prisma.DbNull : (body as Prisma.InputJsonValue),
          slug: slugFor(fields.subject, mailoutId),
        },
      });
      if (!count) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only drafts can be edited. Unschedule it first.",
        });
      }
      return { ok: true };
    }),

  /** A new draft with the same content and lists. */
  duplicate: adminProcedure.input(id).mutation(async ({ ctx, input }) => {
    const source = await findOrThrow(ctx.db, input.id);
    const copy = await ctx.db.mailout.create({
      data: {
        slug: `mailout-${crypto.randomUUID()}`,
        subject: source.subject,
        previewText: source.previewText,
        heading: source.heading,
        body: source.body ?? Prisma.DbNull,
        imageFileId: source.imageFileId,
        buttonLabel: source.buttonLabel,
        buttonUrl: source.buttonUrl,
        listIds: source.listIds,
        createdById: ctx.session.user.id,
      },
      select: { id: true },
    });
    return ctx.db.mailout.update({
      where: { id: copy.id },
      data: { slug: slugFor(source.subject, copy.id) },
      select: { id: true },
    });
  }),

  /** Delete a draft. Anything that has gone out stays, for its results. */
  remove: adminProcedure.input(id).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.db.mailout.deleteMany({
      where: { id: input.id, status: MailoutStatus.DRAFT },
    });
    if (!count) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Only drafts can be deleted.",
      });
    }
    return { ok: true };
  }),

  /** Send one copy to a staff member, marked as a test. */
  sendTest: adminProcedure
    .input(z.object({ id: z.string(), to: z.email() }))
    .mutation(async ({ ctx, input }) => {
      const staff = await ctx.db.user.findFirst({
        where: {
          email: { equals: input.to.trim(), mode: "insensitive" },
          permissions: {
            some: { permission: { in: ["ADMIN", "EVENT_ORGANISER"] } },
          },
        },
        select: { id: true },
      });
      if (!staff) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tests only go to staff accounts.",
        });
      }
      const mailout = await findOrThrow(ctx.db, input.id);
      const result = await sendTest(mailout, input.to.trim());
      if (!result.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "The test did not send.",
        });
      }
      return { ok: true };
    }),

  /** Send now, to everyone on its lists at this moment. */
  send: adminProcedure.input(id).mutation(async ({ ctx, input }) => {
    const mailout = await findOrThrow(ctx.db, input.id);
    const problem = await sendProblem(mailout);
    if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });

    const queued = await startMailout(mailout.id);
    if (queued === null) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "It changed or already started. Reload and check.",
      });
    }
    await logActivity({
      type: ActivityType.MAILOUT_SENT,
      action: `Sent "${mailout.subject}" to ${queued} people`,
      userId: ctx.session.user.id,
      details: { mailoutId: mailout.id, listIds: mailout.listIds, queued },
    });
    kick();
    return { queued };
  }),

  /** Send at a set time. Recipients are worked out when it fires. */
  schedule: adminProcedure
    .input(z.object({ id: z.string(), at: z.date() }))
    .mutation(async ({ ctx, input }) => {
      if (input.at.getTime() < Date.now() + 60_000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick a time at least a minute away, or send now.",
        });
      }
      const mailout = await findOrThrow(ctx.db, input.id);
      const problem = await sendProblem(mailout);
      if (problem) {
        throw new TRPCError({ code: "BAD_REQUEST", message: problem });
      }
      const { count } = await ctx.db.mailout.updateMany({
        where: { id: mailout.id, status: MailoutStatus.DRAFT },
        data: { status: MailoutStatus.SCHEDULED, scheduledFor: input.at },
      });
      if (!count) {
        throw new TRPCError({ code: "CONFLICT", message: "Not a draft." });
      }
      await logActivity({
        type: ActivityType.MAILOUT_SENT,
        action: `Scheduled "${mailout.subject}"`,
        userId: ctx.session.user.id,
        details: { mailoutId: mailout.id, at: input.at.toISOString() },
      });
      return { ok: true };
    }),

  /** Back to a draft, to edit or send now instead. */
  unschedule: adminProcedure.input(id).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.db.mailout.updateMany({
      where: { id: input.id, status: MailoutStatus.SCHEDULED },
      data: { status: MailoutStatus.DRAFT, scheduledFor: null },
    });
    if (!count) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "It is not scheduled any more.",
      });
    }
    return { ok: true };
  }),

  /** Stop a scheduled or sending mailout. Anyone not yet sent to is skipped. */
  cancel: adminProcedure.input(id).mutation(async ({ ctx, input }) => {
    const mailout = await findOrThrow(ctx.db, input.id);
    if (!(await cancelMailout(mailout.id))) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "It has already finished.",
      });
    }
    await logActivity({
      type: ActivityType.MAILOUT_CANCELLED,
      action: `Cancelled "${mailout.subject}"`,
      userId: ctx.session.user.id,
      details: { mailoutId: mailout.id },
    });
    return { ok: true };
  }),

  /** Queue whoever failed again, and send to them. */
  retryFailed: adminProcedure.input(id).mutation(async ({ ctx, input }) => {
    await findOrThrow(ctx.db, input.id);
    const requeued = await retryFailed(input.id);
    if (requeued) kick();
    return { requeued };
  }),
});
