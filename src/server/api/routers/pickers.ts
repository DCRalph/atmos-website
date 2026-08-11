import { z } from "zod";

import {
  TicketEventStatus,
  type PrismaClient,
  type UserPermission,
} from "~Prisma/client";
import {
  adminProcedure,
  createTRPCRouter,
  eventOrganiserProcedure,
} from "~/server/api/trpc";
import {
  buildPicker,
  noFilter,
  pickerInput,
  searchAcross,
} from "~/server/api/pickers/core";

/**
 * Every combobox data source in the app.
 *
 * All of these share one input/output contract (see `~/server/api/pickers/core`),
 * which is what lets a single `<PickerSelect endpoint={api.pickers.gigs} />`
 * drive any of them.
 *
 * **Adding a picker** — copy the nearest entry below and change four things:
 * the procedure (which decides who may search it), the fields to match on, the
 * ordering, and `toOption`. That is the whole job; the client needs no changes.
 *
 * Keep `select` narrow. A picker feeds a dropdown, so it should never pull
 * relations or blobs — that was exactly the bug in the first pass, where the
 * discount-code event dropdown loaded every event's tiers and sales counts.
 */

const nzDate = (date: Date) =>
  date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** A complete address, not a fragment — "chris@" must not match anything. */
const COMPLETE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The set of users a non-admin organiser is allowed to find.
 *
 * Anyone who has worked a door before, anyone holding a staff-ish permission,
 * and themselves — plus, when they type a full email address, that exact
 * account. Partial matches never reach outside the pool, so the picker cannot
 * be used to enumerate the user table.
 */
async function organiserScope(
  ctx: { db: PrismaClient; user: { id: string } },
  query: string,
) {
  const previousStaff = await ctx.db.ticketEventStaff.findMany({
    select: { userId: true },
    distinct: ["userId"],
    take: 500,
  });

  const exactEmail = COMPLETE_EMAIL.test(query) ? query : null;

  return {
    OR: [
      {
        permissions: {
          some: {
            permission: {
              in: [
                "EVENT_ORGANISER",
                "ADMIN",
                "CREATOR",
              ] satisfies UserPermission[],
            },
          },
        },
      },
      ...(previousStaff.length > 0
        ? [{ id: { in: previousStaff.map((row) => row.userId) } }]
        : []),
      ...(exactEmail
        ? [{ email: { equals: exactEmail, mode: "insensitive" as const } }]
        : []),
      { id: ctx.user.id },
    ],
  };
}

export const pickersRouter = createTRPCRouter({
  /** Gigs, newest first. */
  gigs: eventOrganiserProcedure
    .input(pickerInput(noFilter))
    .query(({ ctx, input }) => {
      const where = searchAcross(input.query, ["title", "subtitle"]);
      const select = { id: true, title: true, gigStartTime: true };

      return buildPicker({
        input,
        find: (take) =>
          ctx.db.gig.findMany({
            where,
            select,
            orderBy: { gigStartTime: "desc" },
            take,
          }),
        count: () => ctx.db.gig.count({ where }),
        findByValues: (values) =>
          ctx.db.gig.findMany({ where: { id: { in: values } }, select }),
        toOption: (gig) => ({
          value: gig.id,
          label: gig.title,
          description: nzDate(gig.gigStartTime),
        }),
      });
    }),

  /** Ticketed events. Archived ones are hidden. */
  ticketEvents: eventOrganiserProcedure
    .input(
      pickerInput(
        z
          .object({ includeArchived: z.boolean().default(false) })
          .default({ includeArchived: false }),
      ),
    )
    .query(({ ctx, input }) => {
      const where = {
        ...(input.filter.includeArchived
          ? {}
          : { status: { not: TicketEventStatus.ARCHIVED } }),
        ...searchAcross(input.query, ["name", "venueName"]),
      };
      const select = {
        id: true,
        name: true,
        startsAt: true,
        venueName: true,
      };

      return buildPicker({
        input,
        find: (take) =>
          ctx.db.ticketEvent.findMany({
            where,
            select,
            orderBy: { startsAt: "desc" },
            take,
          }),
        count: () => ctx.db.ticketEvent.count({ where }),
        findByValues: (values) =>
          ctx.db.ticketEvent.findMany({
            where: { id: { in: values } },
            select,
          }),
        toOption: (event) => ({
          value: event.id,
          label: event.name,
          description: [nzDate(event.startsAt), event.venueName]
            .filter(Boolean)
            .join(" · "),
        }),
      });
    }),

  /**
   * People who can be put on a door.
   *
   * Door access is granted by the `TicketEventStaff` assignment itself, so
   * this cannot be restricted to users who already hold some permission —
   * that would mean nobody could ever be assigned a first time.
   *
   * It is scoped by who is asking instead:
   *
   * - **Admins** search every account.
   * - **Organisers** see a working pool — anyone who has worked a door before,
   *   plus staff-ish accounts (organisers, admins, creators), plus themselves.
   *   To add somebody outside that pool they must type a *complete* email
   *   address, which is matched exactly.
   *
   * That exact-email escape hatch is the point: an organiser can still add
   * whoever they actually need, but typing "a" will not enumerate the user
   * table for them. Browsing and lookup are different privileges.
   *
   * `excludeEventId` drops anyone already on that event's door, so the picker
   * can't offer a duplicate.
   */
  doorStaff: eventOrganiserProcedure
    .input(
      pickerInput(
        z.object({ excludeEventId: z.string().optional() }).default({}),
      ),
    )
    .query(async ({ ctx, input }) => {
      const assigned = input.filter.excludeEventId
        ? await ctx.db.ticketEventStaff.findMany({
            where: { eventId: input.filter.excludeEventId },
            select: { userId: true },
          })
        : [];

      const scope = ctx.isAdmin ? null : await organiserScope(ctx, input.query);
      const search = searchAcross(input.query, ["name", "email"]);

      // Composed under AND because `scope` and `search` both produce an OR,
      // and two OR keys cannot coexist in one Prisma where object.
      const where = {
        AND: [
          ...(scope ? [scope] : []),
          ...(search ? [search] : []),
          ...(assigned.length > 0
            ? [{ id: { notIn: assigned.map((row) => row.userId) } }]
            : []),
        ],
      };
      const select = { id: true, name: true, email: true };

      return buildPicker({
        input,
        find: (take) =>
          ctx.db.user.findMany({
            where,
            select,
            orderBy: { name: "asc" },
            take,
          }),
        count: () => ctx.db.user.count({ where }),
        // Pinned values bypass the scope on purpose: an already-selected or
        // already-assigned person must keep their name, or the UI would show a
        // raw cuid for somebody the organiser legitimately put on the door.
        findByValues: (values) =>
          ctx.db.user.findMany({ where: { id: { in: values } }, select }),
        toOption: (user) => ({
          value: user.id,
          label: user.name,
          description: user.email,
        }),
      });
    }),

  /** Any user. Admin-only — this one can see every account on the site. */
  users: adminProcedure.input(pickerInput(noFilter)).query(({ ctx, input }) => {
    const where = searchAcross(input.query, ["name", "email"]);
    const select = { id: true, name: true, email: true };

    return buildPicker({
      input,
      find: (take) =>
        ctx.db.user.findMany({
          where,
          select,
          orderBy: { name: "asc" },
          take,
        }),
      count: () => ctx.db.user.count({ where }),
      findByValues: (values) =>
        ctx.db.user.findMany({ where: { id: { in: values } }, select }),
      toOption: (user) => ({
        value: user.id,
        label: user.name,
        description: user.email,
      }),
    });
  }),

  /** Gig tags. */
  gigTags: eventOrganiserProcedure
    .input(pickerInput(noFilter))
    .query(({ ctx, input }) => {
      const where = searchAcross(input.query, ["name", "description"]);
      const select = { id: true, name: true, description: true };

      return buildPicker({
        input,
        find: (take) =>
          ctx.db.gigTag.findMany({
            where,
            select,
            orderBy: { name: "asc" },
            take,
          }),
        count: () => ctx.db.gigTag.count({ where }),
        findByValues: (values) =>
          ctx.db.gigTag.findMany({ where: { id: { in: values } }, select }),
        toOption: (tag) => ({
          value: tag.id,
          label: tag.name,
          description: tag.description ?? undefined,
        }),
      });
    }),

  /** Creator profiles, by handle or display name. */
  creatorProfiles: eventOrganiserProcedure
    .input(pickerInput(noFilter))
    .query(({ ctx, input }) => {
      const where = searchAcross(input.query, ["displayName", "handle"]);
      const select = { id: true, displayName: true, handle: true };

      return buildPicker({
        input,
        find: (take) =>
          ctx.db.creatorProfile.findMany({
            where,
            select,
            orderBy: { displayName: "asc" },
            take,
          }),
        count: () => ctx.db.creatorProfile.count({ where }),
        findByValues: (values) =>
          ctx.db.creatorProfile.findMany({
            where: { id: { in: values } },
            select,
          }),
        toOption: (profile) => ({
          value: profile.id,
          label: profile.displayName,
          description: `@${profile.handle}`,
        }),
      });
    }),
});
