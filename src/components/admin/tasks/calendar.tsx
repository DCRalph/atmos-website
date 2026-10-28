"use client";
import { useRef, useState } from "react";
import { addDays, dayKey, nzDate, TASK_TIMEZONE } from "~/lib/tasks/time";
import { cn } from "~/lib/utils";
import { taskFlag, type TaskRow } from "./shared";
import type { RouterOutputs } from "~/trpc/react";
type Point = { x: number; y: number };

/** What the calendar colors tasks by: who owns them, or which gig they're for. */
export type CalendarColorBy = "person" | "gig";

/**
 * A bar and a faint wash per person or gig, readable on the dark admin and
 * clear of the reds, ambers and lime that already mean late, critical and
 * today. Neighbours differ most, since gigs close together sit side by side.
 */
const SWATCHES = [
  { bar: "border-l-sky-400", wash: "bg-sky-400/10", dot: "bg-sky-400" },
  {
    bar: "border-l-orange-400",
    wash: "bg-orange-400/10",
    dot: "bg-orange-400",
  },
  {
    bar: "border-l-violet-400",
    wash: "bg-violet-400/10",
    dot: "bg-violet-400",
  },
  {
    bar: "border-l-emerald-400",
    wash: "bg-emerald-400/10",
    dot: "bg-emerald-400",
  },
  { bar: "border-l-pink-400", wash: "bg-pink-400/10", dot: "bg-pink-400" },
  {
    bar: "border-l-yellow-200",
    wash: "bg-yellow-200/10",
    dot: "bg-yellow-200",
  },
  { bar: "border-l-cyan-300", wash: "bg-cyan-300/10", dot: "bg-cyan-300" },
  {
    bar: "border-l-indigo-300",
    wash: "bg-indigo-300/10",
    dot: "bg-indigo-300",
  },
] as const;
/** Unassigned, or not for a gig. */
const PLAIN = {
  bar: "border-l-muted-foreground/40",
  wash: "bg-muted/40",
  dot: "bg-muted-foreground/40",
};

/** The labels shown in red: the task is late, or will be. */
const LATE = ["At risk", "Overdue", "Late, flagged"];

/** Waiting on another task, or blocked on something outside the team. */
const paused = (task: TaskRow) => task.waiting || task.status === "BLOCKED";

export function TasksCalendar({
  tasks,
  gigs,
  people,
  colorBy,
  day,
  week,
  onOpen,
  onNew,
}: {
  tasks: TaskRow[];
  gigs: RouterOutputs["tasks"]["options"]["gigs"];
  /** Everyone who can own tasks, in a fixed order so their colors hold still. */
  people: readonly { id: string; name: string }[];
  colorBy: CalendarColorBy;
  day: string;
  week: boolean;
  onOpen: (id: string) => void;
  onNew: (day: string) => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const [lines, setLines] = useState<{ from: Point; to: Point }[]>([]);
  const [related, setRelated] = useState<string[]>([]);
  const base = week ? day : `${day.slice(0, 7)}-01`;
  const weekday = (new Date(`${base}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(base, -weekday);
  const dates = Array.from({ length: week ? 7 : 42 }, (_, i) =>
    addDays(start, i),
  );
  const heading = new Intl.DateTimeFormat("en-NZ", {
    timeZone: TASK_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const showLinks = (task: TaskRow) => {
    const rect = grid.current?.getBoundingClientRect();
    if (!rect) return;
    const edges = [
      ...task.dependencies.map((dep) => ({
        from: dep.dependsOnId,
        to: task.id,
      })),
      ...task.dependents.map((dep) => ({ from: task.id, to: dep.taskId })),
    ];
    setRelated([task.id, ...edges.flatMap((edge) => [edge.from, edge.to])]);
    setLines(
      edges.flatMap((edge) => {
        const a = nodes.current.get(edge.from)?.getBoundingClientRect(),
          b = nodes.current.get(edge.to)?.getBoundingClientRect();
        return a && b
          ? [
              {
                from: {
                  x: a.right - rect.left,
                  y: a.top + a.height / 2 - rect.top,
                },
                to: {
                  x: b.left - rect.left,
                  y: b.top + b.height / 2 - rect.top,
                },
              },
            ]
          : [];
      }),
    );
  };
  const clear = () => {
    setLines([]);
    setRelated([]);
  };

  // A color per person, or per gig in date order (then any older gig a task
  // is still open for), so the same one keeps its color from week to week.
  const keys =
    colorBy === "person"
      ? people.map((person) => person.id)
      : [
          ...new Set([
            ...gigs.map((gig) => gig.id),
            ...tasks.flatMap((task) => (task.gigId ? [task.gigId] : [])),
          ]),
        ];
  const swatch = (key: string | null | undefined) => {
    const index = key ? keys.indexOf(key) : -1;
    return index < 0 ? PLAIN : SWATCHES[index % SWATCHES.length]!;
  };
  const keyOf = (task: TaskRow) =>
    colorBy === "person" ? task.assigneeId : task.gigId;
  const shown = tasks.filter(
    (task) =>
      task.status !== "PROPOSED" && dates.includes(dayKey(task.projectedDueAt)),
  );
  const legend = [
    ...new Map(
      shown.map((task) => {
        const key = keyOf(task) ?? "";
        const name =
          colorBy === "person"
            ? (task.assignee?.name ?? "Unassigned")
            : (task.gig?.title ?? "No gig");
        return [key, { key, name }];
      }),
    ).values(),
  ].sort(
    (a, b) =>
      (a.key ? keys.indexOf(a.key) : Infinity) -
      (b.key ? keys.indexOf(b.key) : Infinity),
  );

  return (
    <div className="overflow-x-auto rounded-lg border">
      {legend.length > 0 ? (
        <ul
          aria-label={`Colors by ${colorBy}`}
          className="text-muted-foreground flex min-w-[720px] flex-wrap gap-x-4 gap-y-1 border-b px-3 py-2 text-xs"
        >
          {legend.map(({ key, name }) => (
            <li key={key} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", swatch(key).dot)} />
              <span className="text-foreground/85">{name}</span>
            </li>
          ))}
          {shown.some(paused) ? (
            <li className="flex items-center gap-1.5">
              <span className="bg-muted-foreground/40 size-2 rounded-full opacity-60" />
              Grayed out: waiting on something else
            </li>
          ) : null}
        </ul>
      ) : null}
      <div
        ref={grid}
        className={cn(
          "relative grid min-w-[720px] grid-cols-7",
          week && "min-h-96",
        )}
      >
        {!week &&
          ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
            <div
              key={label}
              className="bg-muted/30 text-muted-foreground border-b p-2 text-center text-xs"
            >
              {label}
            </div>
          ))}
        {dates.map((date) => (
          <div
            key={date}
            className={cn(
              "min-h-32 border-r border-b p-2 last:border-r-0",
              date.slice(0, 7) !== day.slice(0, 7) && !week && "bg-muted/15",
              date === dayKey(new Date()) && "bg-primary/5",
            )}
          >
            <button
              type="button"
              onClick={() => onNew(date)}
              className="hover:bg-muted focus-visible:ring-ring mb-2 rounded px-1 text-xs focus-visible:ring-2"
              aria-label={`Add task on ${date}`}
            >
              {week ? heading.format(nzDate(date, 12)) : Number(date.slice(-2))}
            </button>
            {gigs
              .filter((gig) => dayKey(gig.gigStartTime) === date)
              .map((gig) => (
                <div
                  key={gig.id}
                  className={cn(
                    "mb-1 p-1.5 text-xs font-semibold",
                    colorBy === "gig"
                      ? cn(
                          "rounded border-l-[3px]",
                          swatch(gig.id).bar,
                          swatch(gig.id).wash,
                        )
                      : "border-primary bg-primary/10 border-l-2",
                  )}
                >
                  {gig.title} · Gig
                </div>
              ))}
            {tasks
              .filter(
                (task) =>
                  task.status !== "PROPOSED" &&
                  dayKey(task.projectedDueAt) === date,
              )
              .map((task) => (
                <button
                  type="button"
                  key={task.id}
                  ref={(node) => {
                    if (node) nodes.current.set(task.id, node);
                    else nodes.current.delete(task.id);
                  }}
                  onMouseEnter={() => showLinks(task)}
                  onMouseLeave={clear}
                  onFocus={() => showLinks(task)}
                  onBlur={clear}
                  onClick={() => onOpen(task.id)}
                  title={task.risk?.detail}
                  className={cn(
                    "hover:bg-muted focus-visible:ring-ring mb-1 block w-full rounded border-l-[3px] p-1.5 text-left text-xs transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2",
                    swatch(keyOf(task)).bar,
                    swatch(keyOf(task)).wash,
                    related.includes(task.id)
                      ? "ring-primary/40 ring-1"
                      : paused(task) && "opacity-55",
                  )}
                >
                  <span className="block font-medium">
                    {task.critical ? "! " : ""}
                    {task.title}
                  </span>
                  <span className="text-muted-foreground">
                    {task.assignee?.name ?? "Unassigned"} ·{" "}
                    {new Intl.DateTimeFormat("en-NZ", {
                      timeZone: TASK_TIMEZONE,
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(task.projectedDueAt)}
                  </span>
                  {task.projectedDueAt.getTime() !== task.dueAt.getTime() ? (
                    <span className="text-muted-foreground block">
                      Projected
                    </span>
                  ) : null}
                  {paused(task) || task.atRisk || task.overdue ? (
                    <span
                      className={cn(
                        "block",
                        LATE.includes(taskFlag(task))
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {taskFlag(task)}
                    </span>
                  ) : null}
                  {task.risk ? (
                    <span className="text-muted-foreground line-clamp-3 block">
                      {task.risk.short}
                    </span>
                  ) : null}
                </button>
              ))}
          </div>
        ))}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="task-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          {lines.map((line, i) => (
            <path
              key={i}
              d={`M${line.from.x},${line.from.y} C${line.from.x + 30},${line.from.y} ${line.to.x - 30},${line.to.y} ${line.to.x},${line.to.y}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-primary"
              markerEnd="url(#task-arrow)"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
