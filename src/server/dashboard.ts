import "server-only";
import {
  Prisma,
  RentalStatus,
  TicketEventStatus,
  TicketOrderStatus,
  TicketStatus,
} from "~Prisma/client";
import { db } from "~/server/db";
import { readTasks, taskAlerts, type TaskRow } from "~/server/tasks/data";
import { admittedCount } from "~/server/ticketing/scan";
import { paidWithoutTickets } from "~/server/ticketing/declines";
import { unreadCounts } from "~/server/gig-chat";
import { donationWhere, orderWhere } from "~/server/api/routers/payments";
import { activityRows, runSheetActivity } from "~/lib/run-sheet/live-activity";
import {
  COMING_UP_DAYS,
  WRAP_UP_DAYS,
  nightChecks,
  teamTaskReason,
  yourTaskReason,
} from "~/lib/dashboard";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** How long a night with no end time is treated as running for. */
const NIGHT_HOURS = 8;

/** Events that are, or were, really happening. */
const RUNNING_EVENT = {
  notIn: [
    TicketEventStatus.DRAFT,
    TicketEventStatus.CANCELLED,
    TicketEventStatus.ARCHIVED,
  ],
};

const SCHEDULE_ROW = {
  id: true,
  kind: true,
  label: true,
  role: true,
  startsAt: true,
  endsAt: true,
  sortOrder: true,
  leadMinutes: true,
  artists: {
    orderBy: { sortOrder: "asc" },
    select: { artistProfile: { select: { displayName: true } } },
  },
} satisfies Prisma.GigScheduleItemSelect;

const EVENT_FIELDS = {
  id: true,
  name: true,
  gigId: true,
  status: true,
  startsAt: true,
  doorsAt: true,
  endsAt: true,
  capacity: true,
  venueName: true,
  posterFileUploadId: true,
  tiers: { select: { allocation: true, soldCount: true } },
  _count: { select: { staff: true } },
} satisfies Prisma.TicketEventSelect;

type NightEvent = Prisma.TicketEventGetPayload<{ select: typeof EVENT_FIELDS }>;

/**
 * Everything the admin dashboard draws, for one person at one moment: what is
 * on now, the queue of things that need them or the team, the next month, and
 * a handful of numbers. One query so the page loads in one go.
 */
export async function dashboardOverview(userId: string, now = new Date()) {
  const horizon = new Date(now.getTime() + COMING_UP_DAYS * DAY);
  const [nights, tasks] = await Promise.all([
    readNights(now, horizon),
    readTasks(db, now),
  ]);
  const live = nights.filter((night) => night.isLive);
  const [liveNights, needs, pulse] = await Promise.all([
    Promise.all(live.map((night) => liveDetail(night, userId))),
    readNeeds(userId, tasks, now),
    readPulse(userId, now),
  ]);

  return {
    now,
    pulse,
    live: liveNights,
    needs,
    comingUp: await readComingUp(
      nights.filter((night) => !night.isLive && night.startsAt > now),
      tasks,
      now,
      horizon,
    ),
  };
}

export type DashboardOverview = Awaited<ReturnType<typeof dashboardOverview>>;

/**
 * Gigs and ticketed events from twelve hours ago to the horizon, paired up:
 * a gig and its event are one night. An event with no gig is a night of its
 * own.
 */
async function readNights(now: Date, horizon: Date) {
  const from = new Date(now.getTime() - NIGHT_HOURS * HOUR);
  const [gigs, events] = await Promise.all([
    db.gig.findMany({
      where: { gigStartTime: { gte: from, lte: horizon } },
      orderBy: { gigStartTime: "asc" },
      select: {
        id: true,
        title: true,
        status: true,
        isTba: true,
        announceAt: true,
        isAffiliated: true,
        gigStartTime: true,
        gigEndTime: true,
        ticketLink: true,
        posterFileUploadId: true,
        venue: { select: { name: true } },
        scheduleItems: { select: SCHEDULE_ROW },
        notifyRecipients: {
          select: {
            user: { select: { _count: { select: { deviceTokens: true } } } },
          },
        },
        ticketEvents: {
          where: { status: { not: TicketEventStatus.CANCELLED } },
          orderBy: { startsAt: "asc" },
          take: 1,
          select: EVENT_FIELDS,
        },
      },
    }),
    db.ticketEvent.findMany({
      where: {
        gigId: null,
        status: { not: TicketEventStatus.CANCELLED },
        startsAt: { gte: from, lte: horizon },
      },
      orderBy: { startsAt: "asc" },
      select: EVENT_FIELDS,
    }),
  ]);

  const fromGigs = gigs.map((gig) => {
    const event = gig.ticketEvents[0] ?? null;
    const rows = activityRows(
      gig.scheduleItems.map((item) => ({
        ...item,
        artists: item.artists.map((artist) => artist.artistProfile),
      })),
    );
    const startsAt = gig.gigStartTime;
    const endsAt =
      gig.gigEndTime ?? new Date(startsAt.getTime() + NIGHT_HOURS * HOUR);
    // The night opens with whichever comes first, the gig or its doors.
    const opensAt = new Date(
      Math.min(
        startsAt.getTime(),
        (event?.doorsAt ?? event?.startsAt ?? startsAt).getTime(),
      ),
    );
    const stage = runSheetActivity({ id: gig.id, title: gig.title, rows }, now);
    return {
      key: `gig:${gig.id}`,
      title: gig.title,
      startsAt,
      venue: gig.venue?.name ?? event?.venueName ?? null,
      // A draft is a placeholder, not a night that is happening.
      isLive:
        gig.status === "PUBLISHED" &&
        ((opensAt <= now && now < endsAt) || !!stage?.current),
      gig,
      event,
      stage,
      checks: nightChecks({
        gig: {
          isDraft: gig.status === "DRAFT",
          isAffiliated: gig.isAffiliated,
          hasPoster: !!gig.posterFileUploadId,
          hasVenue: !!gig.venue,
          hasTicketLink: !!gig.ticketLink?.trim(),
          scheduleRows: gig.scheduleItems.length,
          timedRows: rows.length,
          recipientsWithoutApp: gig.notifyRecipients.filter(
            (recipient) => recipient.user._count.deviceTokens === 0,
          ).length,
        },
        event: event && eventFacts(event),
      }),
    };
  });

  const fromEvents = events.map((event) => {
    const startsAt = event.startsAt;
    const endsAt =
      event.endsAt ?? new Date(startsAt.getTime() + NIGHT_HOURS * HOUR);
    const opensAt = event.doorsAt ?? startsAt;
    return {
      key: `event:${event.id}`,
      title: event.name,
      startsAt,
      venue: event.venueName,
      isLive:
        event.status !== TicketEventStatus.DRAFT &&
        event.status !== TicketEventStatus.ARCHIVED &&
        opensAt <= now &&
        now < endsAt,
      gig: null,
      event,
      stage: null,
      checks: nightChecks({ gig: null, event: eventFacts(event) }),
    };
  });

  return [...fromGigs, ...fromEvents].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
}

type Night = Awaited<ReturnType<typeof readNights>>[number];

function eventFacts(event: NightEvent) {
  return {
    isDraft: event.status === TicketEventStatus.DRAFT,
    hasPoster: !!event.posterFileUploadId,
    hasVenue: !!event.venueName,
    doorStaff: event._count.staff,
  };
}

function eventCapacity(event: NightEvent) {
  return (
    event.capacity ??
    event.tiers.reduce((total, tier) => total + tier.allocation, 0)
  );
}

/** The live band: the door, the stage and the room, for one night. */
async function liveDetail(night: Night, userId: string) {
  const event =
    night.event && night.event.status !== TicketEventStatus.DRAFT
      ? night.event
      : null;
  const gigId = night.gig?.id ?? null;

  const [door, chat] = await Promise.all([
    event ? doorNumbers(event) : null,
    gigId ? chatNumbers(gigId, userId) : null,
  ]);

  return {
    key: night.key,
    title: night.title,
    venue: night.venue,
    startsAt: night.startsAt,
    gigId,
    eventId: event?.id ?? null,
    stage: night.stage
      ? { current: night.stage.current, next: night.stage.next }
      : null,
    door,
    chat,
  };
}

async function doorNumbers(event: NightEvent) {
  const [inside, sold, doorTickets, doorTakings] = await Promise.all([
    admittedCount(event.id),
    db.ticket.count({
      where: { eventId: event.id, status: TicketStatus.VALID },
    }),
    db.ticket.count({
      where: {
        eventId: event.id,
        status: TicketStatus.VALID,
        isComp: false,
        order: { soldByUserId: { not: null } },
      },
    }),
    db.ticketOrder.aggregate({
      where: {
        ...orderWhere(null),
        eventId: event.id,
        soldByUserId: { not: null },
      },
      _sum: { totalCents: true, refundedCents: true },
    }),
  ]);
  return {
    inside,
    sold,
    capacity: eventCapacity(event),
    doorTickets,
    doorCents:
      (doorTakings._sum.totalCents ?? 0) -
      (doorTakings._sum.refundedCents ?? 0),
  };
}

async function chatNumbers(gigId: string, userId: string) {
  const [unread, last] = await Promise.all([
    unreadCounts(userId, [gigId]),
    db.gigChatMessage.findFirst({
      where: { gigId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        body: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    }),
  ]);
  return {
    unread: unread.get(gigId) ?? 0,
    last: last
      ? { author: last.author.name, body: last.body, at: last.createdAt }
      : null,
  };
}

function taskSummary(task: TaskRow) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    dueAt: task.dueAt,
    lateMinutes: task.lateMinutes,
    shortMinutes: task.shortMinutes,
    flagged: task.flagged,
    blockedReason: task.blockedReason,
    checkBackAt: task.checkBackAt,
    gigTitle: task.gig?.title ?? null,
    assigneeName: task.assignee?.name ?? null,
  };
}

/**
 * The queue. Yours is what only this person can move: their own late or
 * due work, reviews waiting on them, and rounds they owe. Team is everything
 * else somebody should pick up. Wrap-up is what the last few nights left
 * behind.
 */
async function readNeeds(userId: string, tasks: TaskRow[], now: Date) {
  const wrapFrom = new Date(now.getTime() - WRAP_UP_DAYS * DAY);
  const [rounds, approvals, rentals, claims, drafts, stranded, ended, photos] =
    await Promise.all([
      db.taskRound.findMany({
        where: { owedById: userId, settledAt: null, waivedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          owedTo: { select: { name: true } },
          task: { select: { id: true, title: true } },
        },
      }),
      db.ticketOrder.findMany({
        where: { status: TicketOrderStatus.AWAITING_APPROVAL },
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
          event: { select: { id: true, name: true } },
          items: { select: { quantity: true, groupSize: true } },
        },
      }),
      db.rental.findMany({
        where: { status: RentalStatus.PENDING },
        orderBy: { startDate: "asc" },
        select: {
          id: true,
          userName: true,
          startDate: true,
          endDate: true,
          estimatedTotalPrice: true,
          createdAt: true,
          gearPackage: { select: { name: true } },
          _count: { select: { rentalItems: true } },
        },
      }),
      db.artistClaimRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          profile: { select: { id: true, displayName: true } },
          requestingUser: { select: { name: true } },
        },
      }),
      db.gig.findMany({
        where: { status: "DRAFT", gigStartTime: { gte: now } },
        orderBy: { gigStartTime: "asc" },
        select: {
          id: true,
          title: true,
          gigStartTime: true,
          createdAt: true,
          _count: { select: { imports: true } },
        },
      }),
      paidWithoutTickets(
        db,
        Prisma.sql`e.status NOT IN ('DRAFT', 'CANCELLED')`,
      ),
      db.ticketEvent.findMany({
        where: {
          status: RUNNING_EVENT,
          startsAt: {
            gte: new Date(wrapFrom.getTime() - NIGHT_HOURS * HOUR),
            lte: now,
          },
        },
        orderBy: { startsAt: "desc" },
        select: {
          id: true,
          name: true,
          startsAt: true,
          endsAt: true,
          doorTotals: { select: { eventId: true } },
        },
      }),
      db.gig.findMany({
        where: {
          gigStartTime: { gte: new Date(now.getTime() - 30 * DAY), lte: now },
          photoSignups: { some: { notifiedAt: null } },
        },
        orderBy: { gigStartTime: "desc" },
        select: {
          id: true,
          title: true,
          gigStartTime: true,
          gigEndTime: true,
          _count: {
            select: {
              photoSignups: { where: { notifiedAt: null } },
              media: { where: { type: "photo" } },
            },
          },
        },
      }),
    ]);

  const yours = tasks.flatMap((task) => {
    const reason = yourTaskReason(task, userId, now);
    return reason ? [{ reason, task: taskSummary(task) }] : [];
  });
  const yoursIds = new Set(yours.map((item) => item.task.id));
  const team = taskAlerts(tasks)
    .filter((task) => task.assigneeId !== userId && !yoursIds.has(task.id))
    .map((task) => ({ reason: teamTaskReason(task), task: taskSummary(task) }));

  const proposals = tasks.filter((task) => task.status === "PROPOSED");

  const approvalsByEvent = new Map<
    string,
    {
      eventId: string;
      eventName: string;
      orders: number;
      tickets: number;
      oldestAt: Date;
    }
  >();
  for (const order of approvals) {
    const tickets = order.items.reduce(
      (total, item) => total + item.quantity * item.groupSize,
      0,
    );
    const entry = approvalsByEvent.get(order.event.id);
    if (entry) {
      entry.orders += 1;
      entry.tickets += tickets;
    } else {
      approvalsByEvent.set(order.event.id, {
        eventId: order.event.id,
        eventName: order.event.name,
        orders: 1,
        tickets,
        oldestAt: order.createdAt,
      });
    }
  }

  const finished = ended.filter(
    (event) =>
      (event.endsAt ??
        new Date(event.startsAt.getTime() + NIGHT_HOURS * HOUR)) <= now,
  );

  return {
    yours: { tasks: yours, rounds },
    team: {
      tasks: team,
      proposals: {
        count: proposals.length,
        titles: proposals.slice(0, 3).map((task) => task.title),
        newestAt: proposals.reduce<Date | null>(
          (newest, task) =>
            !newest || task.createdAt > newest ? task.createdAt : newest,
          null,
        ),
      },
      approvals: [...approvalsByEvent.values()],
      rentals: rentals.map(({ gearPackage, _count, ...rental }) => ({
        ...rental,
        what:
          gearPackage?.name ??
          `${_count.rentalItems} ${_count.rentalItems === 1 ? "item" : "items"}`,
      })),
      claims,
      drafts: drafts.map(({ _count, ...gig }) => ({
        ...gig,
        imported: _count.imports > 0,
      })),
      stranded,
    },
    wrapUp: {
      events: finished.map((event) => ({
        id: event.id,
        name: event.name,
        startsAt: event.startsAt,
        doorTotalsEntered: !!event.doorTotals,
      })),
      photos: photos
        .filter(
          (gig) =>
            (gig.gigEndTime ??
              new Date(gig.gigStartTime.getTime() + NIGHT_HOURS * HOUR)) <= now,
        )
        .map((gig) => ({
          id: gig.id,
          title: gig.title,
          startsAt: gig.gigStartTime,
          waiting: gig._count.photoSignups,
          photos: gig._count.media,
        })),
    },
  };
}

/**
 * The month ahead, in date order: every night with its readiness check, and
 * the moments between them that change something (an announcement, sales
 * opening, a tier releasing, a campaign ending, gear going out or back).
 */
async function readComingUp(
  nights: Night[],
  tasks: TaskRow[],
  now: Date,
  horizon: Date,
) {
  const window = { gt: now, lte: horizon };
  const [announcements, salesOpen, tierReleases, campaigns, rentals] =
    await Promise.all([
      db.gig.findMany({
        where: { isTba: true, announceAt: window },
        select: { id: true, title: true, announceAt: true },
      }),
      db.ticketEvent.findMany({
        where: {
          status: { not: TicketEventStatus.CANCELLED },
          salesOpenAt: window,
        },
        select: { id: true, name: true, status: true, salesOpenAt: true },
      }),
      db.ticketTier.findMany({
        where: {
          isActive: true,
          salesStartAt: window,
          event: { status: { not: TicketEventStatus.CANCELLED } },
        },
        select: {
          id: true,
          name: true,
          allocation: true,
          priceCents: true,
          salesStartAt: true,
          event: { select: { id: true, name: true } },
        },
      }),
      db.campaign.findMany({
        where: { OR: [{ startsAt: window }, { endsAt: window }] },
        select: {
          id: true,
          name: true,
          startsAt: true,
          endsAt: true,
          spendCents: true,
          event: { select: { name: true } },
        },
      }),
      db.rental.findMany({
        where: {
          status: RentalStatus.APPROVED,
          OR: [{ startDate: window }, { endDate: window }],
        },
        select: {
          id: true,
          userName: true,
          startDate: true,
          endDate: true,
          gearPackage: { select: { name: true } },
        },
      }),
    ]);

  const inWindow = (at: Date | null): at is Date =>
    !!at && at > now && at <= horizon;
  const openTasks = (gigId: string) =>
    tasks.filter(
      (task) =>
        task.gigId === gigId &&
        task.status !== "DONE" &&
        task.status !== "CANCELLED" &&
        task.status !== "PROPOSED",
    );

  const items = [
    ...nights.map((night) => {
      const gigTasks = night.gig ? openTasks(night.gig.id) : [];
      const event = night.event;
      return {
        kind: "night" as const,
        key: night.key,
        at: night.startsAt,
        title: night.title,
        venue: night.venue,
        gigId: night.gig?.id ?? null,
        eventId: event?.id ?? null,
        isAffiliated: night.gig?.isAffiliated ?? false,
        tbaUntil: night.gig?.isTba ? (night.gig.announceAt ?? null) : null,
        sales:
          event && event.status !== TicketEventStatus.DRAFT
            ? {
                sold: event.tiers.reduce(
                  (total, tier) => total + tier.soldCount,
                  0,
                ),
                capacity: eventCapacity(event),
              }
            : null,
        checks: night.checks,
        tasks: {
          open: gigTasks.length,
          atRisk: gigTasks.filter((task) => task.atRisk).length,
          overdue: gigTasks.filter((task) => task.overdue && !task.waiting)
            .length,
        },
      };
    }),
    ...announcements.flatMap((gig) =>
      gig.announceAt
        ? [
            {
              kind: "announce" as const,
              key: `announce:${gig.id}`,
              at: gig.announceAt,
              title: gig.title,
              gigId: gig.id,
            },
          ]
        : [],
    ),
    ...salesOpen.flatMap((event) =>
      event.salesOpenAt
        ? [
            {
              kind: "sales-open" as const,
              key: `sales:${event.id}`,
              at: event.salesOpenAt,
              title: event.name,
              eventId: event.id,
              isDraft: event.status === TicketEventStatus.DRAFT,
            },
          ]
        : [],
    ),
    ...tierReleases.flatMap((tier) =>
      tier.salesStartAt
        ? [
            {
              kind: "tier" as const,
              key: `tier:${tier.id}`,
              at: tier.salesStartAt,
              title: tier.name,
              eventId: tier.event.id,
              eventName: tier.event.name,
              allocation: tier.allocation,
              priceCents: tier.priceCents,
            },
          ]
        : [],
    ),
    ...campaigns.flatMap((campaign) =>
      (["start", "end"] as const).flatMap((edge) => {
        const at = edge === "start" ? campaign.startsAt : campaign.endsAt;
        return inWindow(at)
          ? [
              {
                kind: "campaign" as const,
                key: `campaign:${campaign.id}:${edge}`,
                at,
                edge,
                title: campaign.name,
                eventName: campaign.event?.name ?? null,
                spendCents: campaign.spendCents,
              },
            ]
          : [];
      }),
    ),
    ...rentals.flatMap((rental) =>
      (["out", "back"] as const).flatMap((edge) => {
        const at = edge === "out" ? rental.startDate : rental.endDate;
        return inWindow(at)
          ? [
              {
                kind: "rental" as const,
                key: `rental:${rental.id}:${edge}`,
                at,
                edge,
                title: rental.gearPackage?.name ?? "Gear",
                userName: rental.userName,
                backAt: rental.endDate,
              },
            ]
          : [];
      }),
    ),
  ];

  return items.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** The numbers strip. Money follows the Payments page: net of refunds. */
async function readPulse(userId: string, now: Date) {
  const dayAgo = new Date(now.getTime() - DAY);
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const [ticketsToday, takenWeek, donatedWeek, declinesToday, changesToday] =
    await Promise.all([
      db.ticket.count({
        where: {
          status: TicketStatus.VALID,
          isComp: false,
          order: orderWhere(dayAgo),
        },
      }),
      db.ticketOrder.aggregate({
        where: orderWhere(weekAgo),
        _sum: { totalCents: true, refundedCents: true },
      }),
      db.donation.aggregate({
        where: donationWhere(weekAgo),
        _sum: { amountCents: true, refundedCents: true },
      }),
      db.ticketPaymentAttempt.count({
        where: { status: "FAILED", attemptedAt: { gte: dayAgo } },
      }),
      db.activityLog.count({
        where: {
          createdAt: { gte: dayAgo },
          OR: [{ userId: null }, { userId: { not: userId } }],
        },
      }),
    ]);

  return {
    ticketsToday,
    takenWeekCents:
      (takenWeek._sum.totalCents ?? 0) - (takenWeek._sum.refundedCents ?? 0),
    donatedWeekCents:
      (donatedWeek._sum.amountCents ?? 0) -
      (donatedWeek._sum.refundedCents ?? 0),
    declinesToday,
    changesToday,
  };
}
