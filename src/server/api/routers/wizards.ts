import { TicketEventStatus } from "~Prisma/client";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";

/** How far back "recent" reaches when a wizard asks which gig or event. */
const RECENT_DAYS = 60;
const DAY = 24 * 60 * 60 * 1000;

/**
 * What the wizards' "which one?" step lists: everything coming up, soonest
 * first, and the last couple of months behind it, newest first. Each row
 * carries the few facts a wizard uses to say why you might pick it ("no
 * poster", "no tickets yet"), and nothing heavier.
 */
export const wizardsRouter = createTRPCRouter({
  gigChoices: adminProcedure.query(async ({ ctx }) => {
    const now = Date.now();
    const gigs = await ctx.db.gig.findMany({
      where: { gigStartTime: { gte: new Date(now - RECENT_DAYS * DAY) } },
      orderBy: { gigStartTime: "asc" },
      select: {
        id: true,
        title: true,
        status: true,
        isTba: true,
        gigStartTime: true,
        gigEndTime: true,
        posterFileUploadId: true,
        venue: { select: { name: true } },
        subtitle: true,
        ticketLink: true,
        ticketEvents: {
          where: { status: { not: TicketEventStatus.ARCHIVED } },
          select: { id: true },
        },
        _count: {
          select: {
            scheduleItems: { where: { kind: "SET" } },
            media: { where: { type: "photo" } },
          },
        },
      },
    });

    return gigs.map((gig) => ({
      id: gig.id,
      title: gig.title,
      isDraft: gig.status === "DRAFT",
      isTba: gig.isTba,
      startsAt: gig.gigStartTime,
      venue: gig.venue?.name ?? gig.subtitle,
      hasVenue: gig.venue !== null,
      hasPoster: gig.posterFileUploadId !== null,
      hasTickets: gig.ticketEvents.length > 0 || Boolean(gig.ticketLink),
      eventId: gig.ticketEvents[0]?.id ?? null,
      sets: gig._count.scheduleItems,
      photos: gig._count.media,
      isPast:
        (
          gig.gigEndTime ?? new Date(gig.gigStartTime.getTime() + 6 * 3600e3)
        ).getTime() < now,
    }));
  }),

  eventChoices: adminProcedure.query(async ({ ctx }) => {
    const now = Date.now();
    const events = await ctx.db.ticketEvent.findMany({
      where: {
        status: { not: TicketEventStatus.ARCHIVED },
        startsAt: { gte: new Date(now - RECENT_DAYS * DAY) },
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        startsAt: true,
        endsAt: true,
        venueName: true,
        gigId: true,
        _count: { select: { staff: true } },
      },
    });

    return events.map((event) => ({
      id: event.id,
      title: event.name,
      isDraft: event.status === TicketEventStatus.DRAFT,
      startsAt: event.startsAt,
      venue: event.venueName,
      gigId: event.gigId,
      doorStaff: event._count.staff,
      isPast:
        (
          event.endsAt ?? new Date(event.startsAt.getTime() + 6 * 3600e3)
        ).getTime() < now,
    }));
  }),
});
