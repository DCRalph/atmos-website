"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, ListPlus, Plus } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Segmented } from "~/components/admin/segmented";
import { TaskDrawer } from "~/components/admin/tasks/task-drawer";
import { TaskForm } from "~/components/admin/tasks/task-form";
import { cn } from "~/lib/utils";
import { addDays, dayKey, nzDate } from "~/lib/tasks/time";
import { formatEventDate, formatEventTime } from "~/lib/ticketing/dates";
import { formatNZDWhole } from "~/lib/ticketing/money";
import { AdminSearch } from "./dashboard/admin-search";
import { ComingUp } from "./dashboard/coming-up";
import { LiveBand } from "./dashboard/live-band";
import { NeedsYou } from "./dashboard/needs-you";
import type { Overview } from "./dashboard/parts";

const longDate = new Intl.DateTimeFormat("en-NZ", {
  timeZone: "Pacific/Auckland",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * The admin home: what's on now, the queue of things that need you or the
 * team, and the month ahead. On desktop the page fits the window and the queue
 * and Coming up scroll on their own; on a phone the page scrolls, and the two
 * are tabs.
 */
export function AdminDashboard() {
  const overview = api.dashboard.overview.useQuery(undefined, {
    // Faster while a night is on, so the door and the stage stay current.
    refetchInterval: (query) =>
      query.state.data?.live.length ? 20_000 : 60_000,
  });
  const utils = api.useUtils();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [tab, setTab] = useState<"needs" | "coming">("needs");

  const data = overview.data;
  const now = data?.now ?? new Date();

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:min-h-[40rem] lg:flex-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{longDate.format(now)}</h1>
          <p className="text-muted-foreground text-sm">
            {data ? headline(data) : "\u00a0"}
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center max-sm:[&>a]:px-2 max-sm:[&>a>svg]:hidden max-sm:[&>button]:px-2 max-sm:[&>button>svg]:hidden">
          <div className="col-span-3 sm:contents">
            <AdminSearch />
          </div>
          <Button variant="outline" onClick={() => setAddingTask(true)}>
            <ListPlus />
            Add task
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/events/new">
              <CalendarPlus />
              Create event
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/gigs/new">
              <Plus />
              Create gig
            </Link>
          </Button>
        </div>
      </div>

      {data ? (
        <>
          <Pulse pulse={data.pulse} />
          {data.live.map((night) => (
            <LiveBand key={night.key} night={night} now={now} />
          ))}
          <Segmented
            label="Show"
            className="w-fit lg:hidden"
            value={tab}
            onChange={setTab}
            options={[
              { value: "needs", label: "Needs you" },
              { value: "coming", label: `Coming up ${data.comingUp.length}` },
            ]}
          />
          <div className="grid min-h-0 gap-3 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_23.75rem]">
            <NeedsYou
              needs={data.needs}
              now={now}
              onOpenTask={setTaskId}
              className={cn(tab !== "needs" && "max-lg:hidden")}
            />
            <ComingUp
              items={data.comingUp}
              now={now}
              className={cn(tab !== "coming" && "max-lg:hidden")}
            />
          </div>
        </>
      ) : overview.isError ? (
        <p className="text-destructive text-sm">
          Couldn&apos;t load the dashboard. {overview.error.message}
        </p>
      ) : (
        <div className="grid gap-3 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_23.75rem]">
          <Skeleton className="h-96 lg:h-full" />
          <Skeleton className="h-96 max-lg:hidden lg:h-full" />
        </div>
      )}

      <TaskDrawer
        id={taskId}
        onClose={() => {
          setTaskId(null);
          void utils.dashboard.overview.invalidate();
        }}
        onOpen={setTaskId}
      />
      <Dialog open={addingTask} onOpenChange={setAddingTask}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
            <DialogDescription>
              One owner and an agreed due time.
            </DialogDescription>
          </DialogHeader>
          {addingTask ? (
            <TaskForm
              due={nzDate(addDays(dayKey(now), 1), 17)}
              onSaved={(id) => {
                setAddingTask(false);
                setTaskId(id);
                void utils.dashboard.overview.invalidate();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The line under the date: what's on, or what's next. */
function headline(data: Overview) {
  const time = formatEventTime(data.now);
  const live = data.live[0];
  if (live) return `${time} · ${live.title} is on`;
  const next = data.comingUp.find((item) => item.kind === "night");
  if (next) {
    return `${time} · next up ${next.title}, ${formatEventDate(next.at)}`;
  }
  return `${time} · nothing on in the next month`;
}

/** A sentence of numbers. Money is net of refunds, as on Payments. */
function Pulse({ pulse }: { pulse: Overview["pulse"] }) {
  const items = [
    {
      href: "/admin/payments",
      value: pulse.ticketsToday,
      label: "tickets in 24h",
    },
    {
      href: "/admin/payments",
      value: formatNZDWhole(pulse.takenWeekCents),
      label: "in tickets this week",
    },
    {
      href: "/admin/payments",
      value: formatNZDWhole(pulse.donatedWeekCents),
      label: "donated this week",
    },
    {
      href: "/admin/analytics",
      value: pulse.declinesToday,
      label:
        pulse.declinesToday === 1
          ? "card decline in 24h"
          : "card declines in 24h",
      warn: pulse.declinesToday > 0,
    },
    {
      href: "/admin/activity-logs",
      value: pulse.changesToday,
      label: "changes by the team in 24h",
    },
  ];
  return (
    <p className="text-muted-foreground no-scrollbar -mx-4 flex gap-x-5 overflow-x-auto px-4 text-sm whitespace-nowrap sm:mx-0 sm:flex-wrap sm:gap-y-1 sm:overflow-visible sm:px-0">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="hover:text-foreground"
        >
          <span
            className={cn(
              "text-foreground font-semibold tabular-nums",
              item.warn && "text-amber-400",
            )}
          >
            {item.value}
          </span>{" "}
          {item.label}
        </Link>
      ))}
    </p>
  );
}
