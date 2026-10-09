"use client";
import { useRef, useState } from "react";
import { addDays, dayKey, nzDate, TASK_TIMEZONE } from "~/lib/tasks/time";
import { cn } from "~/lib/utils";
import { taskFlag, type TaskRow } from "./shared";
import type { RouterOutputs } from "~/trpc/react";
type Point = { x: number; y: number };
export function TasksCalendar({
  tasks,
  gigs,
  day,
  week,
  onOpen,
  onNew,
}: {
  tasks: TaskRow[];
  gigs: RouterOutputs["tasks"]["options"]["gigs"];
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
  return (
    <div className="overflow-x-auto rounded-lg border">
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
                  className="border-primary bg-primary/10 mb-1 border-l-2 p-1.5 text-xs font-semibold"
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
                  className={cn(
                    "bg-muted/40 hover:bg-muted focus-visible:ring-ring mb-1 block w-full rounded border-l-2 p-1.5 text-left text-xs focus-visible:ring-2",
                    task.atRisk || task.overdue
                      ? "border-destructive"
                      : "border-primary/40",
                    related.includes(task.id) &&
                      "bg-primary/15 ring-primary/40 ring-1",
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
                  {task.waiting || task.atRisk || task.overdue ? (
                    <span className="text-muted-foreground block">
                      {taskFlag(task)}
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
