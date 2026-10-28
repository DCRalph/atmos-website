"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Banknote,
  Beer,
  Camera,
  ChartColumn,
  CircleAlert,
  CirclePause,
  Clock,
  Eye,
  Inbox,
  Package,
  SquarePen,
  Ticket,
  TriangleAlert,
  UserCheck,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Segmented } from "~/components/admin/segmented";
import { cn } from "~/lib/utils";
import { dayKey } from "~/lib/tasks/time";
import {
  formatEventDate,
  formatEventTime,
  formatTimeAgo,
} from "~/lib/ticketing/dates";
import { formatNZD, formatNZDWhole } from "~/lib/ticketing/money";
import type { TeamTaskReason, YourTaskReason } from "~/lib/dashboard";
import { formatGap, GroupHeading, Panel, type Overview } from "./parts";

type Group = "yours" | "team" | "wrap";
type Tone = "red" | "amber" | "accent";
type TaskItem = Overview["needs"]["yours"]["tasks"][number]["task"];

/** One line of the queue, whatever kind of thing it is about. */
type Need = {
  key: string;
  group: Group;
  icon: LucideIcon;
  tone?: Tone;
  kind: string;
  title: string;
  /** The task drawer opens from the title, or the title links here. */
  taskId?: string;
  href?: string;
  meta?: string | null;
  when?: string | null;
  whenTone?: Tone;
  actions?: ReactNode;
};

/** Row buttons: smaller than `sm`, so two fit beside a line of text. */
const ACTION = "h-7 px-2.5 text-xs";

const TONE: Record<Tone, string> = {
  red: "text-destructive",
  amber: "text-amber-400",
  accent: "text-admin-accent-text",
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "yours", label: "Yours" },
  { value: "team", label: "Team" },
  { value: "wrap", label: "Wrap-up" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

const YOUR_REASON: Record<
  YourTaskReason,
  { kind: string; icon: LucideIcon; tone?: Tone }
> = {
  review: { kind: "Review", icon: Eye, tone: "accent" },
  "check-back": { kind: "Check back", icon: CirclePause, tone: "amber" },
  overdue: { kind: "Overdue", icon: Clock, tone: "red" },
  "at-risk": { kind: "At risk", icon: TriangleAlert, tone: "amber" },
  "due-soon": { kind: "Due soon", icon: Clock },
};

const TEAM_REASON: Record<
  TeamTaskReason,
  { kind: string; icon: LucideIcon; tone: Tone }
> = {
  "at-risk": { kind: "At risk", icon: TriangleAlert, tone: "amber" },
  unassigned: { kind: "Unowned", icon: UserX, tone: "amber" },
  overdue: { kind: "Overdue", icon: Clock, tone: "red" },
  blocked: { kind: "Blocked", icon: CirclePause, tone: "amber" },
};

/** `4:00 pm` today, `Sat 7 Nov` otherwise. */
function formatWhen(at: Date, now: Date) {
  return dayKey(at) === dayKey(now) ? formatEventTime(at) : formatEventDate(at);
}

function taskWhen(
  task: TaskItem,
  reason: YourTaskReason | TeamTaskReason,
  now: Date,
) {
  if (task.lateMinutes > 0) {
    return {
      when: `${formatGap(task.lateMinutes * 60_000)} late`,
      whenTone: "red" as const,
    };
  }
  if (reason === "at-risk" && task.shortMinutes > 0) {
    return {
      when: `${formatGap(task.shortMinutes * 60_000)} short`,
      whenTone: "amber" as const,
    };
  }
  if (reason === "check-back" && task.checkBackAt) {
    return { when: `check back ${formatWhen(task.checkBackAt, now)}` };
  }
  return { when: `due ${formatWhen(task.dueAt, now)}` };
}

/**
 * The to-do queue: what needs this person, then what needs somebody on the
 * team, then what the last few nights left behind. Quick decisions happen in
 * the row; anything that needs a form opens the task, or the page it lives on.
 */
export function NeedsYou({
  needs,
  now,
  superadmin,
  onOpenTask,
  className,
}: {
  needs: Overview["needs"];
  now: Date;
  /** Adds Mark done to the team's tasks, without anyone taking them. */
  superadmin: boolean;
  onOpenTask: (id: string) => void;
  className?: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const utils = api.useUtils();
  const refresh = () => utils.dashboard.overview.invalidate();
  const failed = (error: { message: string }) => toast.error(error.message);

  const approve = api.tasks.setStatus.useMutation({
    onSuccess: async () => {
      toast.success("Approved");
      await refresh();
    },
    onError: failed,
  });
  const take = api.tasks.take.useMutation({
    onSuccess: async () => {
      toast.success("It's yours");
      await refresh();
    },
    onError: failed,
  });
  const markDone = api.tasks.override.useMutation({
    onSuccess: async () => {
      toast.success("Marked done");
      await refresh();
    },
    onError: failed,
  });
  const nudge = api.tasks.nudge.useMutation({
    onSuccess: () => toast.success("Nudged"),
    onError: failed,
  });
  const approveRental = api.rentals.adminApproveRental.useMutation({
    onSuccess: async () => {
      toast.success("Request approved");
      await refresh();
    },
    onError: failed,
  });
  const rejectRental = api.rentals.adminRejectRental.useMutation({
    onSuccess: async () => {
      toast.success("Request rejected");
      await refresh();
    },
    onError: failed,
  });

  const open = (id: string) => (
    <Button
      size="sm"
      className={ACTION}
      variant="outline"
      onClick={() => onOpenTask(id)}
    >
      Open
    </Button>
  );
  const go = (href: string, label: string) => (
    <Button size="sm" className={ACTION} variant="outline" asChild>
      <Link href={href}>{label}</Link>
    </Button>
  );

  const { yours, team, wrapUp } = needs;
  const rows: Need[] = [
    ...yours.tasks.map(({ reason, task }): Need => ({
      key: `task:${task.id}`,
      group: "yours",
      ...YOUR_REASON[reason],
      title: task.title,
      taskId: task.id,
      meta: [
        task.gigTitle,
        reason === "check-back" ? task.blockedReason : null,
        reason === "at-risk" ? task.riskReason : null,
      ]
        .filter(Boolean)
        .join(" · "),
      ...taskWhen(task, reason, now),
      actions:
        reason === "review" ? (
          <>
            {open(task.id)}
            <Button
              size="sm"
              className={ACTION}
              disabled={approve.isPending}
              onClick={() => approve.mutate({ id: task.id, status: "DONE" })}
            >
              Approve
            </Button>
          </>
        ) : (
          open(task.id)
        ),
    })),
    ...yours.rounds.map((round): Need => ({
      key: `round:${round.id}`,
      group: "yours",
      icon: Beer,
      kind: "Round",
      title: round.owedTo
        ? `You owe ${round.owedTo.name} a round`
        : "You owe a round",
      meta: round.task.title,
      when: formatTimeAgo(round.createdAt, now),
      href: "/admin/tasks?view=standings",
      actions: go("/admin/tasks?view=standings", "Standings"),
    })),
    ...team.tasks.map(({ reason, task }): Need => ({
      key: `task:${task.id}`,
      group: "team",
      ...TEAM_REASON[reason],
      title: task.title,
      taskId: task.id,
      meta: [
        task.gigTitle,
        task.assigneeName,
        task.blockedReason,
        reason === "at-risk" ? task.riskReason : null,
      ]
        .filter(Boolean)
        .join(" · "),
      ...taskWhen(task, reason, now),
      actions: (
        <>
          {reason === "unassigned" && task.status !== "IN_REVIEW" ? (
            <Button
              size="sm"
              className={ACTION}
              variant="outline"
              disabled={take.isPending}
              onClick={() => take.mutate({ id: task.id })}
            >
              Take it
            </Button>
          ) : reason === "overdue" && !task.flagged ? (
            <Button
              size="sm"
              className={ACTION}
              variant="outline"
              disabled={nudge.isPending}
              onClick={() => nudge.mutate({ id: task.id })}
            >
              Nudge
            </Button>
          ) : (
            open(task.id)
          )}
          {superadmin ? (
            <Button
              size="sm"
              className={ACTION}
              disabled={markDone.isPending}
              onClick={() => markDone.mutate({ id: task.id, status: "DONE" })}
            >
              Mark done
            </Button>
          ) : null}
        </>
      ),
    })),
    ...(team.proposals.count > 0
      ? [
          {
            key: "proposals",
            group: "team",
            icon: Inbox,
            kind: "Proposed",
            title:
              team.proposals.count === 1
                ? "1 proposed task"
                : `${team.proposals.count} proposed tasks`,
            meta: team.proposals.titles.join(" · "),
            when: team.proposals.newestAt
              ? formatTimeAgo(team.proposals.newestAt, now)
              : null,
            href: "/admin/tasks?view=proposed",
            actions: go("/admin/tasks?view=proposed", "Review"),
          } satisfies Need,
        ]
      : []),
    ...team.stranded.map((order): Need => ({
      key: `stranded:${order.orderId}`,
      group: "team",
      icon: CircleAlert,
      tone: "red",
      kind: "No tickets",
      title: `${formatNZD(order.amountCents)} paid, no tickets`,
      meta: `Order ${order.orderNumber}`,
      href: `/admin/events/${order.eventId}?section=orders&order=${order.orderId}`,
      actions: go(
        `/admin/events/${order.eventId}?section=orders&order=${order.orderId}`,
        "Open",
      ),
    })),
    ...team.approvals.map((approval): Need => ({
      key: `approvals:${approval.eventId}`,
      group: "team",
      icon: Ticket,
      kind: "Approval",
      title:
        approval.orders === 1
          ? "1 order to approve"
          : `${approval.orders} orders to approve`,
      meta: `${approval.eventName} · ${approval.tickets} ${approval.tickets === 1 ? "ticket" : "tickets"}`,
      when: `oldest ${formatTimeAgo(approval.oldestAt, now)}`,
      href: `/admin/events/${approval.eventId}`,
      actions: go(`/admin/events/${approval.eventId}`, "Review"),
    })),
    ...team.rentals.map((rental): Need => ({
      key: `rental:${rental.id}`,
      group: "team",
      icon: Package,
      kind: "Rental",
      title: `${rental.what} · ${rental.userName}`,
      meta: `${formatEventDate(rental.startDate)} to ${formatEventDate(rental.endDate)} · ${formatNZDWhole(rental.estimatedTotalPrice * 100)}`,
      when: formatTimeAgo(rental.createdAt, now),
      href: "/admin/rentals",
      actions: (
        <>
          <Button
            size="sm"
            className={ACTION}
            variant="outline"
            disabled={rejectRental.isPending}
            onClick={() => rejectRental.mutate({ id: rental.id })}
          >
            Reject
          </Button>
          <Button
            size="sm"
            className={ACTION}
            disabled={approveRental.isPending}
            onClick={() => approveRental.mutate({ id: rental.id })}
          >
            Approve
          </Button>
        </>
      ),
    })),
    ...team.claims.map((claim): Need => ({
      key: `claim:${claim.id}`,
      group: "team",
      icon: UserCheck,
      kind: "Claim",
      title: `${claim.requestingUser.name} wants ${claim.profile.displayName}`,
      meta: "Artist profile claim",
      when: formatTimeAgo(claim.createdAt, now),
      href: "/admin/artist-profiles/claims",
      actions: go("/admin/artist-profiles/claims", "Review"),
    })),
    ...team.drafts.map((gig): Need => ({
      key: `draft:${gig.id}`,
      group: "team",
      icon: SquarePen,
      kind: "Draft gig",
      title: gig.title,
      meta: [
        formatEventDate(gig.gigStartTime),
        gig.imported ? "imported, not published" : "not published",
      ].join(" · "),
      when: formatTimeAgo(gig.createdAt, now),
      href: `/admin/gigs/${gig.id}`,
      actions: go(`/admin/gigs/${gig.id}`, "Review"),
    })),
    ...wrapUp.events.flatMap((event): Need[] => [
      ...(event.doorTotalsEntered
        ? []
        : [
            {
              key: `door:${event.id}`,
              group: "wrap",
              icon: Banknote,
              tone: "amber",
              kind: "Door totals",
              title: "Cash and EFTPOS not entered",
              meta: `${event.name} · ${formatEventDate(event.startsAt)}`,
              href: `/admin/events/${event.id}?section=costs`,
              actions: go(
                `/admin/events/${event.id}?section=costs`,
                "Enter totals",
              ),
            } satisfies Need,
          ]),
      {
        key: `summary:${event.id}`,
        group: "wrap",
        icon: ChartColumn,
        kind: "Summary",
        title: `${event.name} summary`,
        meta: formatEventDate(event.startsAt),
        href: `/admin/events/${event.id}?section=summary`,
        actions: go(`/admin/events/${event.id}?section=summary`, "Open"),
      },
    ]),
    ...wrapUp.photos.map((gig): Need => ({
      key: `photos:${gig.id}`,
      group: "wrap",
      icon: Camera,
      kind: "Photos",
      title: `${gig.waiting} waiting for photos`,
      meta: `${gig.title} · ${gig.photos === 0 ? "gallery is empty" : `${gig.photos} photos up`}`,
      href:
        gig.photos === 0
          ? `/admin/gigs/${gig.id}?section=gallery`
          : `/admin/gigs/${gig.id}`,
      actions:
        gig.photos === 0
          ? go(`/admin/gigs/${gig.id}?section=gallery`, "Upload photos")
          : go(`/admin/gigs/${gig.id}`, "Send photos"),
    })),
  ];

  const counts = {
    all: rows.length,
    yours: rows.filter((row) => row.group === "yours").length,
    team: rows.filter((row) => row.group === "team").length,
    wrap: rows.filter((row) => row.group === "wrap").length,
  };
  const groups: { group: Group; title: string }[] = [
    { group: "yours", title: "Yours" },
    { group: "team", title: "Team" },
    { group: "wrap", title: "Wrap-up" },
  ];

  return (
    <Panel
      className={className}
      title="Needs you"
      aside={
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((option) => ({
            value: option.value,
            label: `${option.label} ${counts[option.value]}`,
          }))}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nothing needs you. Enjoy it.
        </p>
      ) : null}
      {groups
        .filter(({ group }) => filter === "all" || filter === group)
        .map(({ group, title }) => {
          const inGroup = rows.filter((row) => row.group === group);
          if (inGroup.length === 0) return null;
          return (
            <div key={group}>
              <GroupHeading aside={inGroup.length}>{title}</GroupHeading>
              <ul>
                {inGroup.map((row) => (
                  <NeedRow key={row.key} need={row} onOpenTask={onOpenTask} />
                ))}
              </ul>
            </div>
          );
        })}
    </Panel>
  );
}

function NeedRow({
  need,
  onOpenTask,
}: {
  need: Need;
  onOpenTask: (id: string) => void;
}) {
  const Icon = need.icon;
  const title = need.taskId ? (
    <button
      type="button"
      onClick={() => onOpenTask(need.taskId!)}
      className="text-left font-medium hover:underline"
    >
      {need.title}
    </button>
  ) : need.href ? (
    <Link href={need.href} className="font-medium hover:underline">
      {need.title}
    </Link>
  ) : (
    <span className="font-medium">{need.title}</span>
  );

  return (
    <li className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2.5 gap-y-2 border-t py-2.5 text-sm first:border-t-0 lg:grid-cols-[7rem_minmax(0,1fr)_8.5rem_auto] lg:items-center lg:gap-x-3">
      <span
        className={cn(
          "text-muted-foreground flex items-center gap-2 pt-0.5 text-xs lg:pt-0",
          need.tone && TONE[need.tone],
        )}
      >
        <Icon className="size-4 shrink-0 lg:size-3.5" aria-hidden />
        <span className="max-lg:sr-only">{need.kind}</span>
      </span>
      <div className="min-w-0">
        {title}
        <p className="text-muted-foreground truncate text-xs">
          <span className="lg:hidden">{need.kind}</span>
          {need.meta ? (
            <>
              <span className="lg:hidden"> · </span>
              {need.meta}
            </>
          ) : null}
          {need.when ? (
            <span
              className={cn("lg:hidden", need.whenTone && TONE[need.whenTone])}
            >
              {" "}
              · {need.when}
            </span>
          ) : null}
        </p>
      </div>
      <span
        className={cn(
          "text-muted-foreground hidden text-xs lg:block",
          need.whenTone && TONE[need.whenTone],
        )}
      >
        {need.when}
      </span>
      {need.actions ? (
        <div className="col-start-2 flex flex-wrap gap-1.5 lg:col-start-auto lg:justify-end">
          {need.actions}
        </div>
      ) : null}
    </li>
  );
}
