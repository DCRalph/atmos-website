import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  ActivityType,
  EventStaffRole,
  Prisma,
  TicketEventStatus,
  TicketOrderStatus,
  TicketStatus,
} from "~Prisma/client";
import {
  adminProcedure,
  createTRPCRouter,
  eventOrganiserProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { logActivity } from "~/server/utils/activity-log";
import {
  remainingInTier,
  tierUnavailableReason,
} from "~/server/ticketing/inventory";
import {
  getTicketingSettings,
  resolveBookingFee,
} from "~/server/ticketing/settings";
import { pushEventPassUpdates } from "~/server/wallet/apple-push";
import type { SerializedEditorState } from "lexical";

/**
 * Admin CRUD for ticketed events, their tiers, and door staff assignments,
 * plus the two public reads the buy panel needs.
 */

const LEXICAL_STATE_SCHEMA = z.custom<SerializedEditorState>(
  (val) =>
    typeof val === "object" &&
    val !== null &&
    "root" in (val as Record<string, unknown>),
  { message: "Invalid Lexical editor state" },
);

function toLexicalJsonInput(
  value: SerializedEditorState | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as unknown as Prisma.InputJsonValue;
}

/**
 * How many rows a combobox picker returns. Small on purpose — the search box
 * is the navigation, not the scrollbar.
 */
const PICKER_LIMIT = 20;

/** URL-safe slug, deduplicated with a numeric suffix. */
function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event"
  );
}

async function uniqueSlug(
  db: Prisma.TransactionClient,
  desired: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(desired);
  for (let suffix = 0; suffix < 50; suffix++) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const clash = await db.ticketEvent.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash || clash.id === excludeId) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const eventInputSchema = z.object({
  name: z.string().trim().min(1, "Give the event a name"),
  slug: z.string().trim().optional(),
  gigId: z.string().nullable().optional(),
  shortDescription: z.string().trim().max(300).nullable().optional(),
  descriptionLexical: LEXICAL_STATE_SCHEMA.nullable().optional(),
  posterFileUploadId: z.string().nullable().optional(),
  venueName: z.string().trim().nullable().optional(),
  venueAddress: z.string().trim().nullable().optional(),
  timezone: z.string().trim().default("Pacific/Auckland"),
  doorsAt: z.date().nullable().optional(),
  startsAt: z.date(),
  endsAt: z.date().nullable().optional(),
  salesOpenAt: z.date().nullable().optional(),
  salesCloseAt: z.date().nullable().optional(),
  capacity: z.number().int().min(1).nullable().optional(),
  maxTicketsPerOrder: z.number().int().min(1).max(50).default(10),
  requireAttendeeNames: z.boolean().default(true),
  reentryAllowed: z.boolean().default(false),
  isR18: z.boolean().default(true),
  bookingFeeFixedCents: z.number().int().min(0).nullable().optional(),
  bookingFeePercentBp: z.number().int().min(0).max(5000).nullable().optional(),
  gstNumber: z.string().trim().nullable().optional(),
});

const tierInputSchema = z.object({
  name: z.string().trim().min(1, "Give the tier a name"),
  description: z.string().trim().nullable().optional(),
  priceCents: z.number().int().min(0),
  allocation: z.number().int().min(0),
  salesStartAt: z.date().nullable().optional(),
  salesEndAt: z.date().nullable().optional(),
  isActive: z.boolean().default(true),
  isHidden: z.boolean().default(false),
  maxPerOrder: z.number().int().min(1).max(50).default(10),
  maxPerEmail: z.number().int().min(1).nullable().optional(),
  requiresApproval: z.boolean().default(false),
});

function assertSaneDates(input: {
  startsAt: Date;
  endsAt?: Date | null;
  doorsAt?: Date | null;
  salesOpenAt?: Date | null;
  salesCloseAt?: Date | null;
}) {
  if (input.endsAt && input.endsAt < input.startsAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The event can't end before it starts.",
    });
  }
  if (input.doorsAt && input.doorsAt > input.startsAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Doors can't open after the event starts.",
    });
  }
  if (
    input.salesOpenAt &&
    input.salesCloseAt &&
    input.salesCloseAt < input.salesOpenAt
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Ticket sales can't close before they open.",
    });
  }
}

export const ticketEventsRouter = createTRPCRouter({
  // ---------------------------------------------------------------- admin

  list: eventOrganiserProcedure
    .input(
      z
        .object({
          includeArchived: z.boolean().default(false),
        })
        .default({ includeArchived: false }),
    )
    .query(async ({ ctx, input }) => {
      const events = await ctx.db.ticketEvent.findMany({
        where: input.includeArchived
          ? {}
          : { status: { not: TicketEventStatus.ARCHIVED } },
        orderBy: { startsAt: "desc" },
        include: {
          gig: { select: { id: true, title: true } },
          tiers: {
            select: {
              id: true,
              allocation: true,
              soldCount: true,
              heldCount: true,
              priceCents: true,
            },
          },
          _count: { select: { tickets: true } },
        },
      });

      return events.map((event) => {
        const allocation = event.tiers.reduce((s, t) => s + t.allocation, 0);
        const sold = event.tiers.reduce((s, t) => s + t.soldCount, 0);
        return {
          ...event,
          totalAllocation: event.capacity ?? allocation,
          totalSold: sold,
          remaining: Math.max(0, (event.capacity ?? allocation) - sold),
        };
      });
    }),

  byId: eventOrganiserProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.ticketEvent.findUnique({
        where: { id: input.id },
        include: {
          gig: { select: { id: true, title: true, gigStartTime: true } },
          tiers: { orderBy: { sortOrder: "asc" } },
          staff: true,
        },
      });
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      const [settings, staffUsers, revenue] = await Promise.all([
        getTicketingSettings(),
        ctx.db.user.findMany({
          where: { id: { in: event.staff.map((s) => s.userId) } },
          select: { id: true, name: true, email: true, image: true },
        }),
        ctx.db.ticketOrder.aggregate({
          where: { eventId: event.id, status: TicketOrderStatus.PAID },
          _sum: { totalCents: true, refundedCents: true },
          _count: true,
        }),
      ]);

      const userById = new Map(staffUsers.map((u) => [u.id, u]));

      return {
        ...event,
        effectiveBookingFee: resolveBookingFee(event, settings),
        siteDefaults: settings,
        staff: event.staff.map((assignment) => ({
          ...assignment,
          user: userById.get(assignment.userId) ?? null,
        })),
        totals: {
          orders: revenue._count,
          grossCents: revenue._sum.totalCents ?? 0,
          refundedCents: revenue._sum.refundedCents ?? 0,
        },
      };
    }),

  create: adminProcedure
    .input(eventInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertSaneDates(input);

      const settings = await getTicketingSettings();
      const slug = await uniqueSlug(ctx.db, input.slug ?? input.name);

      const event = await ctx.db.ticketEvent.create({
        data: {
          slug,
          name: input.name,
          gigId: input.gigId ?? null,
          shortDescription: input.shortDescription ?? null,
          descriptionLexical: toLexicalJsonInput(input.descriptionLexical),
          posterFileUploadId: input.posterFileUploadId ?? null,
          venueName: input.venueName ?? null,
          venueAddress: input.venueAddress ?? null,
          timezone: input.timezone,
          doorsAt: input.doorsAt ?? null,
          startsAt: input.startsAt,
          endsAt: input.endsAt ?? null,
          salesOpenAt: input.salesOpenAt ?? null,
          salesCloseAt: input.salesCloseAt ?? null,
          capacity: input.capacity ?? null,
          maxTicketsPerOrder: input.maxTicketsPerOrder,
          requireAttendeeNames: input.requireAttendeeNames,
          reentryAllowed: input.reentryAllowed,
          isR18: input.isR18,
          bookingFeeFixedCents: input.bookingFeeFixedCents ?? null,
          bookingFeePercentBp: input.bookingFeePercentBp ?? null,
          // Snapshot the GST number so a receipt reprinted in two years still
          // shows the number that was current at the time of sale.
          gstNumber: input.gstNumber ?? settings.gstNumber,
        },
      });

      await logActivity({
        type: ActivityType.TICKET_EVENT_CREATED,
        action: `Created ticketed event "${event.name}"`,
        userId: ctx.session.user.id,
        details: { eventId: event.id, slug: event.slug },
      });

      return event;
    }),

  update: adminProcedure
    .input(eventInputSchema.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;

      const existing = await ctx.db.ticketEvent.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      assertSaneDates({
        startsAt: rest.startsAt ?? existing.startsAt,
        endsAt: rest.endsAt === undefined ? existing.endsAt : rest.endsAt,
        doorsAt: rest.doorsAt === undefined ? existing.doorsAt : rest.doorsAt,
        salesOpenAt:
          rest.salesOpenAt === undefined
            ? existing.salesOpenAt
            : rest.salesOpenAt,
        salesCloseAt:
          rest.salesCloseAt === undefined
            ? existing.salesCloseAt
            : rest.salesCloseAt,
      });

      if (rest.capacity != null) {
        const sold = await ctx.db.ticket.count({
          where: { eventId: id, status: TicketStatus.VALID },
        });
        if (rest.capacity < sold) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${sold} tickets are already sold — capacity can't go below that.`,
          });
        }
      }

      const slug =
        rest.slug && rest.slug !== existing.slug
          ? await uniqueSlug(ctx.db, rest.slug, id)
          : undefined;

      const event = await ctx.db.ticketEvent.update({
        where: { id },
        data: {
          ...(slug ? { slug } : {}),
          ...(rest.name !== undefined ? { name: rest.name } : {}),
          ...(rest.gigId !== undefined ? { gigId: rest.gigId } : {}),
          ...(rest.shortDescription !== undefined
            ? { shortDescription: rest.shortDescription }
            : {}),
          ...(rest.descriptionLexical !== undefined
            ? {
                descriptionLexical: toLexicalJsonInput(rest.descriptionLexical),
              }
            : {}),
          ...(rest.posterFileUploadId !== undefined
            ? { posterFileUploadId: rest.posterFileUploadId }
            : {}),
          ...(rest.venueName !== undefined
            ? { venueName: rest.venueName }
            : {}),
          ...(rest.venueAddress !== undefined
            ? { venueAddress: rest.venueAddress }
            : {}),
          ...(rest.timezone !== undefined ? { timezone: rest.timezone } : {}),
          ...(rest.doorsAt !== undefined ? { doorsAt: rest.doorsAt } : {}),
          ...(rest.startsAt !== undefined ? { startsAt: rest.startsAt } : {}),
          ...(rest.endsAt !== undefined ? { endsAt: rest.endsAt } : {}),
          ...(rest.salesOpenAt !== undefined
            ? { salesOpenAt: rest.salesOpenAt }
            : {}),
          ...(rest.salesCloseAt !== undefined
            ? { salesCloseAt: rest.salesCloseAt }
            : {}),
          ...(rest.capacity !== undefined ? { capacity: rest.capacity } : {}),
          ...(rest.maxTicketsPerOrder !== undefined
            ? { maxTicketsPerOrder: rest.maxTicketsPerOrder }
            : {}),
          ...(rest.requireAttendeeNames !== undefined
            ? { requireAttendeeNames: rest.requireAttendeeNames }
            : {}),
          ...(rest.reentryAllowed !== undefined
            ? { reentryAllowed: rest.reentryAllowed }
            : {}),
          ...(rest.isR18 !== undefined ? { isR18: rest.isR18 } : {}),
          ...(rest.bookingFeeFixedCents !== undefined
            ? { bookingFeeFixedCents: rest.bookingFeeFixedCents }
            : {}),
          ...(rest.bookingFeePercentBp !== undefined
            ? { bookingFeePercentBp: rest.bookingFeePercentBp }
            : {}),
          ...(rest.gstNumber !== undefined
            ? { gstNumber: rest.gstNumber }
            : {}),
        },
      });

      await logActivity({
        type: ActivityType.TICKET_EVENT_UPDATED,
        action: `Updated ticketed event "${event.name}"`,
        userId: ctx.session.user.id,
        details: { eventId: event.id },
      });

      // Anything printed on a wallet pass changed, so push the new version to
      // the phones already holding one. Failures are logged, never fatal — a
      // pass that missed an update is not a reason to fail the edit.
      const passAffectingChange =
        (rest.startsAt !== undefined &&
          rest.startsAt.getTime() !== existing.startsAt.getTime()) ||
        (rest.doorsAt !== undefined &&
          rest.doorsAt?.getTime() !== existing.doorsAt?.getTime()) ||
        (rest.venueName !== undefined &&
          rest.venueName !== existing.venueName) ||
        (rest.venueAddress !== undefined &&
          rest.venueAddress !== existing.venueAddress) ||
        (rest.name !== undefined && rest.name !== existing.name);

      if (passAffectingChange) {
        void pushEventPassUpdates(event.id).catch((cause) =>
          console.error("[wallet] pass update push failed", cause),
        );
      }

      return event;
    }),

  setStatus: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          TicketEventStatus.DRAFT,
          TicketEventStatus.PUBLISHED,
          TicketEventStatus.SALES_PAUSED,
          TicketEventStatus.SOLD_OUT,
          TicketEventStatus.CANCELLED,
          TicketEventStatus.ARCHIVED,
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.ticketEvent.findUnique({
        where: { id: input.id },
        include: { tiers: { select: { id: true } } },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      if (
        input.status === TicketEventStatus.PUBLISHED &&
        existing.tiers.length === 0
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add at least one ticket tier before publishing.",
        });
      }

      const event = await ctx.db.ticketEvent.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.status === TicketEventStatus.PUBLISHED &&
          !existing.publishedAt
            ? { publishedAt: new Date() }
            : {}),
        },
      });

      await logActivity({
        type:
          input.status === TicketEventStatus.PUBLISHED
            ? ActivityType.TICKET_EVENT_PUBLISHED
            : input.status === TicketEventStatus.CANCELLED
              ? ActivityType.TICKET_EVENT_CANCELLED
              : ActivityType.TICKET_EVENT_UPDATED,
        action: `Set "${event.name}" to ${input.status}`,
        userId: ctx.session.user.id,
        details: { eventId: event.id, status: input.status },
      });

      if (input.status === TicketEventStatus.CANCELLED) {
        void pushEventPassUpdates(event.id).catch((cause) =>
          console.error("[wallet] cancellation push failed", cause),
        );
      }

      return event;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ticketCount = await ctx.db.ticket.count({
        where: { eventId: input.id },
      });
      if (ticketCount > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Tickets have been issued for this event — archive it instead of deleting.",
        });
      }

      const event = await ctx.db.ticketEvent.delete({
        where: { id: input.id },
      });

      await logActivity({
        type: ActivityType.TICKET_EVENT_DELETED,
        action: `Deleted ticketed event "${event.name}"`,
        userId: ctx.session.user.id,
        details: { eventId: event.id },
      });

      return { ok: true as const };
    }),

  // ----------------------------------------------------------------- tiers

  createTier: adminProcedure
    .input(tierInputSchema.extend({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { eventId, ...rest } = input;

      const last = await ctx.db.ticketTier.findFirst({
        where: { eventId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });

      const tier = await ctx.db.ticketTier.create({
        data: {
          eventId,
          name: rest.name,
          description: rest.description ?? null,
          priceCents: rest.priceCents,
          allocation: rest.allocation,
          salesStartAt: rest.salesStartAt ?? null,
          salesEndAt: rest.salesEndAt ?? null,
          isActive: rest.isActive,
          isHidden: rest.isHidden,
          maxPerOrder: rest.maxPerOrder,
          maxPerEmail: rest.maxPerEmail ?? null,
          requiresApproval: rest.requiresApproval,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
      });

      await logActivity({
        type: ActivityType.TICKET_TIER_CREATED,
        action: `Added tier "${tier.name}"`,
        userId: ctx.session.user.id,
        details: { eventId, tierId: tier.id },
      });

      return tier;
    }),

  updateTier: adminProcedure
    .input(tierInputSchema.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;

      const existing = await ctx.db.ticketTier.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tier not found" });
      }

      // Shrinking an allocation below what is already committed would make
      // `remaining` negative and the buy panel nonsense.
      if (rest.allocation !== undefined) {
        const committed = existing.soldCount + existing.heldCount;
        if (rest.allocation < committed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${committed} already sold or held in this tier — allocation can't go below that.`,
          });
        }
      }

      const tier = await ctx.db.ticketTier.update({
        where: { id },
        data: {
          ...(rest.name !== undefined ? { name: rest.name } : {}),
          ...(rest.description !== undefined
            ? { description: rest.description }
            : {}),
          ...(rest.priceCents !== undefined
            ? { priceCents: rest.priceCents }
            : {}),
          ...(rest.allocation !== undefined
            ? { allocation: rest.allocation }
            : {}),
          ...(rest.salesStartAt !== undefined
            ? { salesStartAt: rest.salesStartAt }
            : {}),
          ...(rest.salesEndAt !== undefined
            ? { salesEndAt: rest.salesEndAt }
            : {}),
          ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
          ...(rest.isHidden !== undefined ? { isHidden: rest.isHidden } : {}),
          ...(rest.maxPerOrder !== undefined
            ? { maxPerOrder: rest.maxPerOrder }
            : {}),
          ...(rest.maxPerEmail !== undefined
            ? { maxPerEmail: rest.maxPerEmail }
            : {}),
          ...(rest.requiresApproval !== undefined
            ? { requiresApproval: rest.requiresApproval }
            : {}),
        },
      });

      await logActivity({
        type: ActivityType.TICKET_TIER_UPDATED,
        action: `Updated tier "${tier.name}"`,
        userId: ctx.session.user.id,
        details: { eventId: tier.eventId, tierId: tier.id },
      });

      return tier;
    }),

  deleteTier: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const issued = await ctx.db.ticket.count({ where: { tierId: input.id } });
      if (issued > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Tickets have been issued in this tier — deactivate it instead of deleting.",
        });
      }

      const tier = await ctx.db.ticketTier.delete({ where: { id: input.id } });

      await logActivity({
        type: ActivityType.TICKET_TIER_DELETED,
        action: `Deleted tier "${tier.name}"`,
        userId: ctx.session.user.id,
        details: { eventId: tier.eventId, tierId: tier.id },
      });

      return { ok: true as const };
    }),

  reorderTiers: adminProcedure
    .input(
      z.object({
        eventId: z.string(),
        tierIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.tierIds.map((tierId, index) =>
          ctx.db.ticketTier.update({
            where: { id: tierId },
            data: { sortOrder: index },
          }),
        ),
      );
      return { ok: true as const };
    }),

  // ----------------------------------------------------------------- staff

  assignStaff: adminProcedure
    .input(
      z.object({
        eventId: z.string(),
        userId: z.string(),
        role: z
          .enum([EventStaffRole.SCANNER, EventStaffRole.MANAGER])
          .default(EventStaffRole.SCANNER),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, email: true },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const assignment = await ctx.db.ticketEventStaff.upsert({
        where: {
          eventId_userId: { eventId: input.eventId, userId: input.userId },
        },
        update: { role: input.role },
        create: {
          eventId: input.eventId,
          userId: input.userId,
          role: input.role,
          createdBy: ctx.session.user.id,
        },
      });

      await logActivity({
        type: ActivityType.DOOR_STAFF_ASSIGNED,
        action: `Assigned ${user.name} to the door`,
        userId: ctx.session.user.id,
        targetUserId: user.id,
        details: { eventId: input.eventId, role: input.role },
      });

      return assignment;
    }),

  removeStaff: adminProcedure
    .input(z.object({ eventId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.ticketEventStaff
        .delete({
          where: {
            eventId_userId: { eventId: input.eventId, userId: input.userId },
          },
        })
        .catch(() => undefined);

      await logActivity({
        type: ActivityType.DOOR_STAFF_REMOVED,
        action: `Removed door staff from event`,
        userId: ctx.session.user.id,
        targetUserId: input.userId,
        details: { eventId: input.eventId },
      });

      return { ok: true as const };
    }),

  // --------------------------------------------------------------- pickers
  //
  // Combobox sources. Each returns at most `PICKER_LIMIT` rows plus the true
  // match count, so the UI can say "showing 20 of 340" instead of quietly
  // truncating. Filtering happens in Postgres — these tables grow forever and
  // shipping all of one to the browser to populate a dropdown stops working
  // long before anyone notices it has.

  /** Users who can be put on a door. */
  eligibleStaff: adminProcedure
    .input(
      z
        .object({
          query: z.string().trim().max(80).default(""),
          /** Hide people already on this event's door. */
          excludeEventId: z.string().optional(),
        })
        .default({ query: "" }),
    )
    .query(async ({ ctx, input }) => {
      const assignedIds = input.excludeEventId
        ? (
            await ctx.db.ticketEventStaff.findMany({
              where: { eventId: input.excludeEventId },
              select: { userId: true },
            })
          ).map((row) => row.userId)
        : [];

      const where = {
        ...(assignedIds.length > 0 ? { id: { notIn: assignedIds } } : {}),
        ...(input.query
          ? {
              OR: [
                {
                  name: { contains: input.query, mode: "insensitive" as const },
                },
                {
                  email: {
                    contains: input.query,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      };

      const [users, total] = await Promise.all([
        ctx.db.user.findMany({
          where,
          select: { id: true, name: true, email: true, image: true },
          orderBy: { name: "asc" },
          take: PICKER_LIMIT,
        }),
        ctx.db.user.count({ where }),
      ]);

      return {
        options: users.map((user) => ({
          value: user.id,
          label: user.name,
          description: user.email,
        })),
        total,
      };
    }),

  /** Gigs, for the "link this event to a gig" picker. */
  gigOptions: adminProcedure
    .input(
      z
        .object({ query: z.string().trim().max(80).default("") })
        .default({ query: "" }),
    )
    .query(async ({ ctx, input }) => {
      const where = input.query
        ? {
            OR: [
              {
                title: { contains: input.query, mode: "insensitive" as const },
              },
              {
                subtitle: {
                  contains: input.query,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {};

      const [gigs, total] = await Promise.all([
        ctx.db.gig.findMany({
          where,
          select: { id: true, title: true, gigStartTime: true },
          orderBy: { gigStartTime: "desc" },
          take: PICKER_LIMIT,
        }),
        ctx.db.gig.count({ where }),
      ]);

      return {
        options: gigs.map((gig) => ({
          value: gig.id,
          label: gig.title,
          description: gig.gigStartTime.toLocaleDateString("en-NZ", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        })),
        total,
      };
    }),

  /** Ticketed events, for scoping a discount code. */
  eventOptions: adminProcedure
    .input(
      z
        .object({ query: z.string().trim().max(80).default("") })
        .default({ query: "" }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        status: { not: TicketEventStatus.ARCHIVED },
        ...(input.query
          ? { name: { contains: input.query, mode: "insensitive" as const } }
          : {}),
      };

      const [events, total] = await Promise.all([
        ctx.db.ticketEvent.findMany({
          where,
          select: {
            id: true,
            name: true,
            startsAt: true,
            timezone: true,
            venueName: true,
          },
          orderBy: { startsAt: "desc" },
          take: PICKER_LIMIT,
        }),
        ctx.db.ticketEvent.count({ where }),
      ]);

      return {
        options: events.map((event) => ({
          value: event.id,
          label: event.name,
          description: [
            event.startsAt.toLocaleDateString("en-NZ", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            event.venueName,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
        total,
      };
    }),

  // ---------------------------------------------------------------- public

  /** The public event page. Only ever returns events that are on sale. */
  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.ticketEvent.findUnique({
        where: { slug: input.slug },
        include: {
          tiers: { orderBy: { sortOrder: "asc" } },
          gig: { select: { id: true, title: true } },
        },
      });

      if (
        !event ||
        event.status === TicketEventStatus.DRAFT ||
        event.status === TicketEventStatus.ARCHIVED
      ) {
        return null;
      }

      return toPublicEvent(event, await getTicketingSettings());
    }),

  /** Buy panel data for a gig page. Null when the gig has no live event. */
  forGig: publicProcedure
    .input(z.object({ gigId: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.ticketEvent.findFirst({
        where: {
          gigId: input.gigId,
          status: {
            in: [
              TicketEventStatus.PUBLISHED,
              TicketEventStatus.SALES_PAUSED,
              TicketEventStatus.SOLD_OUT,
              TicketEventStatus.CANCELLED,
            ],
          },
        },
        orderBy: { startsAt: "asc" },
        include: {
          tiers: { orderBy: { sortOrder: "asc" } },
          gig: { select: { id: true, title: true } },
        },
      });

      if (!event) return null;
      return toPublicEvent(event, await getTicketingSettings());
    }),

  /** Upcoming on-sale events, for `/events`. */
  upcoming: publicProcedure.query(async ({ ctx }) => {
    const events = await ctx.db.ticketEvent.findMany({
      where: {
        status: {
          in: [
            TicketEventStatus.PUBLISHED,
            TicketEventStatus.SALES_PAUSED,
            TicketEventStatus.SOLD_OUT,
          ],
        },
        startsAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      },
      orderBy: { startsAt: "asc" },
      include: { tiers: { orderBy: { sortOrder: "asc" } } },
    });

    const settings = await getTicketingSettings();
    return events.map((event) => toPublicEvent(event, settings));
  }),
});

type EventWithTiers = Prisma.TicketEventGetPayload<{
  include: { tiers: true };
}> & { gig?: { id: string; title: string } | null };

/**
 * Public projection of an event.
 *
 * Deliberately does not leak `soldCount` — a promoter's sales numbers are not
 * public information. Remaining stock is exposed only as a coarse "low stock"
 * flag plus a count when it drops under ten, which is enough to create urgency
 * without publishing the books.
 */
function toPublicEvent(
  event: EventWithTiers,
  settings: Awaited<ReturnType<typeof getTicketingSettings>>,
) {
  const now = new Date();
  const fee = resolveBookingFee(event, settings);

  const tiers = event.tiers
    .filter((tier) => !tier.isHidden)
    .map((tier) => {
      const remaining = remainingInTier(tier);
      const reason = tierUnavailableReason(tier, now);
      return {
        id: tier.id,
        name: tier.name,
        description: tier.description,
        priceCents: tier.priceCents,
        maxPerOrder: tier.maxPerOrder,
        isFree: tier.priceCents === 0,
        requiresApproval: tier.requiresApproval,
        available: reason === null,
        unavailableReason: reason,
        salesStartAt: tier.salesStartAt,
        salesEndAt: tier.salesEndAt,
        lowStock: remaining > 0 && remaining <= 10,
        remainingIfLow: remaining > 0 && remaining <= 10 ? remaining : null,
      };
    });

  const onSale = tiers.some((tier) => tier.available);
  const cheapest = tiers
    .filter((tier) => tier.available)
    .reduce<number | null>(
      (min, tier) =>
        min === null ? tier.priceCents : Math.min(min, tier.priceCents),
      null,
    );

  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    status: event.status,
    shortDescription: event.shortDescription,
    descriptionLexical: event.descriptionLexical,
    posterFileUploadId: event.posterFileUploadId,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    timezone: event.timezone,
    doorsAt: event.doorsAt,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    isR18: event.isR18,
    maxTicketsPerOrder: event.maxTicketsPerOrder,
    requireAttendeeNames: event.requireAttendeeNames,
    gig: event.gig ?? null,
    tiers,
    onSale,
    fromPriceCents: cheapest,
    /** Disclosed up front — NZ drip-pricing rules mean fees can't be a surprise. */
    bookingFee: fee,
    salesOpenAt: event.salesOpenAt,
    salesCloseAt: event.salesCloseAt,
  };
}

export type PublicTicketEvent = NonNullable<
  Awaited<ReturnType<typeof toPublicEvent>>
>;
