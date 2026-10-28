"use client";
import { useState } from "react";
import { Clock, NotebookPen, Pin, Plus, TriangleAlert, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import {
  formatTaskWhen,
  weekdayIndex,
  weekFromGig,
  weekLabel,
  type PlaybookGig,
  type PlaybookRole,
  type PlaybookTask,
} from "~/lib/tasks/playbooks";
import { addDays, dayKey, nzParts, startOfWeek } from "~/lib/tasks/time";
import { formatEventDate } from "~/lib/ticketing/dates";
import { RoleSelect, WaitsFor, WhenEditor } from "./playbook-fields";

/**
 * A playbook laid out on a real gig: the run-up calendar (weeks before the
 * gig, Monday to Sunday, a task on the day it's due) and the same tasks as a
 * table for typing out lots at once.
 */

/** A task with where it lands on the preview gig. */
export type PlacedTask = {
  task: PlaybookTask;
  dueAt: Date;
  /** The weekend day a weekdays-only task moved off. */
  movedFrom: string | null;
  day: string;
};

const DRAG_TYPE = "application/x-playbook-task";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLUMNS = "md:grid-cols-[5rem_repeat(7,minmax(0,1fr))]";

/** A day key as a date to format: noon on it in UTC, which is the same day everywhere. */
const noon = (day: string) => new Date(`${day}T12:00:00Z`);
const month = (date: Date) =>
  date.toLocaleString("en-NZ", { month: "short", timeZone: "UTC" });

/** `9pm`, or `9:30pm`. */
function shortTime(date: Date) {
  const { hour, minute } = nzParts(date);
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${hour < 12 ? "am" : "pm"}`;
}

/** The weeks to draw: from the first task's to the last's, always including gig week. */
function weeksOf(placed: readonly PlacedTask[], gigDay: string) {
  const weeks = placed.map((row) => weekFromGig(row.day, gigDay));
  const first = Math.min(0, ...weeks);
  const last = Math.max(0, ...weeks);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

/** `16 to 22 Nov`, or `30 Nov to 6 Dec`. */
function weekRange(monday: string) {
  const sunday = addDays(monday, 6);
  const [from, to] = [noon(monday), noon(sunday)];
  const day = (date: Date) => date.getUTCDate();
  return month(from) === month(to)
    ? `${day(from)} to ${day(to)} ${month(to)}`
    : `${day(from)} ${month(from)} to ${day(to)} ${month(to)}`;
}

/**
 * The run-up as a calendar. Tasks sit on the day they're due for the preview
 * gig. Drag one to another day, or pick it to edit it. On a phone it's a list
 * of days instead.
 */
export function RunUpCalendar({
  placed,
  gig,
  today,
  selected,
  highlight,
  onSelect,
  onMove,
  onAdd,
}: {
  placed: readonly PlacedTask[];
  gig: PlaybookGig;
  today: string;
  selected: string | null;
  highlight: string | null;
  onSelect: (key: string) => void;
  onMove: (key: string, day: string) => void;
  onAdd: (day: string) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  const gigDay = dayKey(gig.startsAt);
  const gigMonday = startOfWeek(gigDay);
  const weeks = weeksOf(placed, gigDay);
  const dim = (task: PlaybookTask) =>
    !!highlight && task.role !== highlight && task.reviewerRole !== highlight;

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div
          className={cn(
            "text-muted-foreground grid border-b text-[11px] tracking-wide uppercase",
            COLUMNS,
          )}
        >
          <span />
          {WEEKDAYS.map((day) => (
            <span key={day} className="px-2 py-1.5">
              {day}
            </span>
          ))}
        </div>
        {weeks.map((week, row) => {
          const monday = addDays(gigMonday, week * 7);
          return (
            <div
              key={week}
              className={cn("grid border-b last:border-b-0", COLUMNS)}
            >
              <div className="px-2 py-1.5 text-xs leading-tight font-semibold text-neutral-300">
                {weekLabel(week)}
              </div>
              {WEEKDAYS.map((_, index) => {
                const day = addDays(monday, index);
                const tasks = placed.filter((row) => row.day === day);
                const isGig = day === gigDay;
                const date = noon(day);
                return (
                  <div
                    key={day}
                    onDragOver={(event) => {
                      if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setOver(day);
                    }}
                    onDragLeave={() =>
                      setOver((cell) => (cell === day ? null : cell))
                    }
                    onDrop={(event) => {
                      const key = event.dataTransfer.getData(DRAG_TYPE);
                      setOver(null);
                      if (!key) return;
                      event.preventDefault();
                      onMove(key, day);
                    }}
                    className={cn(
                      "group flex min-h-16 min-w-0 flex-col gap-1 border-l p-1",
                      tasks.length === 0 && "min-h-10",
                      isGig &&
                        "bg-admin-accent/5 ring-admin-accent/40 ring-1 ring-inset",
                      over === day && "bg-accent/60",
                    )}
                  >
                    <div className="flex h-4 items-center gap-1 text-[11px] tabular-nums">
                      <span
                        className={cn(
                          "text-muted-foreground",
                          day < today && "opacity-50",
                          (day === today || isGig) &&
                            "text-admin-accent font-semibold opacity-100",
                        )}
                      >
                        {date.getUTCDate()}
                        {date.getUTCDate() === 1 || (row === 0 && index === 0)
                          ? ` ${month(date)}`
                          : null}
                      </span>
                      {isGig ? (
                        <span className="text-admin-accent truncate text-[10.5px] font-semibold">
                          Gig {shortTime(gig.startsAt)}
                        </span>
                      ) : day === today ? (
                        <span className="text-muted-foreground text-[10.5px]">
                          Today
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Add a task on ${formatEventDate(date, "UTC")}`}
                        onClick={() => onAdd(day)}
                        className="text-muted-foreground hover:text-foreground ml-auto rounded-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    {tasks.map(({ task, movedFrom }) => (
                      <TaskChip
                        key={task.key}
                        task={task}
                        movedFrom={movedFrom}
                        selected={selected === task.key}
                        dim={dim(task)}
                        onSelect={() => onSelect(task.key)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="md:hidden">
        {weeks.map((week) => {
          const monday = addDays(gigMonday, week * 7);
          const rows = placed.filter(
            (row) => weekFromGig(row.day, gigDay) === week,
          );
          if (rows.length === 0 && week !== 0) return null;
          return (
            <section key={week}>
              <h3 className="text-muted-foreground mt-4 mb-1 flex justify-between text-xs font-semibold tracking-wide uppercase first:mt-0">
                {weekLabel(week)}
                <span className="font-normal tracking-normal normal-case">
                  {weekRange(monday)}
                </span>
              </h3>
              <ul>
                {rows.map(({ task, dueAt }) => (
                  <li key={task.key} className="border-t first:border-t-0">
                    <button
                      type="button"
                      onClick={() => onSelect(task.key)}
                      className={cn(
                        "grid w-full grid-cols-[5.5rem_minmax(0,1fr)] gap-2 py-2 text-left text-sm",
                        dim(task) && "opacity-35",
                      )}
                    >
                      <time className="text-muted-foreground tabular-nums">
                        {formatEventDate(dueAt)}
                      </time>
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {task.title || "Untitled task"}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {formatTaskWhen(task)} · {task.role}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {week === 0 ? (
                  <li className="text-admin-accent border-t py-2 text-sm font-semibold first:border-t-0">
                    {formatEventDate(gig.startsAt)} · Gig{" "}
                    {shortTime(gig.startsAt)}
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

function TaskChip({
  task,
  movedFrom,
  selected,
  dim,
  onSelect,
}: {
  task: PlaybookTask;
  movedFrom: string | null;
  selected: boolean;
  dim: boolean;
  onSelect: () => void;
}) {
  const Icon =
    task.when.kind === "weekday"
      ? Pin
      : task.when.kind === "hours"
        ? Clock
        : null;
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, task.key);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={onSelect}
      aria-pressed={selected}
      title={`${task.title} · ${formatTaskWhen(task)} · ${task.role}`}
      className={cn(
        "bg-muted relative w-full cursor-grab rounded-md border border-l-[3px] border-white/10 border-l-neutral-600 px-1.5 py-1 text-left text-[11.5px] leading-tight active:cursor-grabbing",
        task.critical && "border-l-amber-400",
        selected && "ring-admin-accent border-transparent ring-2",
        dim && "opacity-35",
      )}
    >
      <span className={cn("line-clamp-2 font-medium", Icon && "pr-3.5")}>
        {task.title || "Untitled task"}
      </span>
      {Icon ? (
        <Icon className="text-muted-foreground absolute top-1.5 right-1 size-2.5" />
      ) : null}
      {movedFrom ? (
        <span className="block truncate text-[10.5px] text-amber-400">
          moved off {WEEKDAYS[weekdayIndex(movedFrom)]}
        </span>
      ) : null}
    </button>
  );
}

/**
 * The table's columns when it has room for one line a task, shared by the
 * header and every row. Narrower, a row wraps to three lines. Sized by the
 * table's own width, since the side panel takes some of the screen.
 */
const TABLE_COLUMNS =
  "@5xl:grid-cols-[11rem_6.5rem_minmax(0,1fr)_7.5rem_7.5rem_9rem_auto]";

/**
 * Every task as a row, every field in reach: for typing out a new playbook or
 * changing lots at once. Grouped by week, in date order.
 */
export function PlaybookTable({
  placed,
  roles,
  gig,
  dueTime,
  highlight,
  onChange,
  onRemove,
  onAddRole,
}: {
  placed: readonly PlacedTask[];
  roles: readonly PlaybookRole[];
  gig: PlaybookGig;
  dueTime: string | null;
  highlight: string | null;
  onChange: (key: string, fields: Partial<PlaybookTask>) => void;
  onRemove: (key: string) => void;
  onAddRole: (name: string) => void;
}) {
  const [notes, setNotes] = useState<string | null>(null);
  const gigDay = dayKey(gig.startsAt);
  const tasks = placed.map((row) => row.task);
  const weeks = [...new Set(placed.map((row) => weekFromGig(row.day, gigDay)))];

  return (
    <div className="@container">
      <div
        className={cn(
          "text-muted-foreground hidden gap-1.5 text-[11px] tracking-wide uppercase @5xl:grid",
          TABLE_COLUMNS,
        )}
      >
        <span>When</span>
        <span>Date</span>
        <span>Task</span>
        <span>Owner</span>
        <span>Reviewer</span>
        <span>Waits for</span>
        <span className="w-[6.25rem]" />
      </div>
      {weeks.map((week) => {
        const rows = placed.filter(
          (row) => weekFromGig(row.day, gigDay) === week,
        );
        return (
          <div key={week}>
            <h3 className="text-muted-foreground mt-4 mb-1 flex justify-between text-xs font-semibold tracking-wide uppercase">
              {weekLabel(week)}
              <span className="font-normal tracking-normal normal-case">
                {weekRange(addDays(startOfWeek(gigDay), week * 7))}
              </span>
            </h3>
            <ul>
              {rows.map(({ task, dueAt, movedFrom }) => {
                const label = task.title.trim() || "Untitled task";
                const change = (fields: Partial<PlaybookTask>) =>
                  onChange(task.key, fields);
                return (
                  <li
                    key={task.key}
                    className={cn(
                      "border-t py-1.5 first:border-t-0",
                      highlight &&
                        task.role !== highlight &&
                        task.reviewerRole !== highlight &&
                        "opacity-35",
                    )}
                  >
                    <div
                      className={cn(
                        "grid grid-cols-6 items-center gap-1.5",
                        TABLE_COLUMNS,
                      )}
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            aria-label={`When ${label} is due`}
                            className="col-span-3 h-9 justify-start gap-1.5 truncate px-2.5 font-normal @5xl:col-span-1"
                          >
                            <span className="truncate">
                              {formatTaskWhen(task)}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-96">
                          <WhenEditor
                            task={task}
                            gig={gig}
                            dueTime={dueTime}
                            onChange={change}
                          />
                        </PopoverContent>
                      </Popover>
                      <time
                        className={cn(
                          "col-span-2 truncate text-xs tabular-nums @5xl:col-span-1",
                          movedFrom
                            ? "text-amber-400"
                            : "text-muted-foreground",
                        )}
                        title={
                          movedFrom
                            ? `Moved off ${formatEventDate(noon(movedFrom), "UTC")}, a weekend`
                            : undefined
                        }
                      >
                        {formatEventDate(dueAt)}
                      </time>
                      <div className="flex justify-end gap-0.5 @5xl:order-last">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Notes for ${label}`}
                          aria-expanded={notes === task.key}
                          onClick={() =>
                            setNotes((key) =>
                              key === task.key ? null : task.key,
                            )
                          }
                          className={cn(
                            "relative",
                            notes === task.key || task.notes
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          <NotebookPen />
                          {task.notes ? (
                            <span className="bg-admin-accent absolute top-1.5 right-1.5 size-1.5 rounded-full" />
                          ) : null}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Critical: ${label}`}
                          aria-pressed={task.critical}
                          title="Critical tasks escalate sooner when late"
                          onClick={() => change({ critical: !task.critical })}
                          className={cn(
                            task.critical
                              ? "bg-amber-400/10 text-amber-400 hover:text-amber-400"
                              : "text-muted-foreground",
                          )}
                        >
                          <TriangleAlert />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${label}`}
                          disabled={placed.length <= 1}
                          onClick={() => onRemove(task.key)}
                          className="text-muted-foreground"
                        >
                          <X />
                        </Button>
                      </div>
                      <Input
                        aria-label="Task"
                        placeholder="What needs doing"
                        maxLength={200}
                        value={task.title}
                        onChange={(event) =>
                          change({ title: event.target.value })
                        }
                        className="col-span-6 h-9 @5xl:col-span-1"
                      />
                      <div className="col-span-2 min-w-0 @5xl:col-span-1">
                        <RoleSelect
                          label={`Owner role for ${label}`}
                          value={task.role}
                          roles={roles}
                          onChange={(role) => change({ role: role ?? "" })}
                          onAddRole={onAddRole}
                        />
                      </div>
                      <div className="col-span-2 min-w-0 @5xl:col-span-1">
                        <RoleSelect
                          reviewer
                          label={`Reviewer role for ${label}`}
                          value={task.reviewerRole}
                          roles={roles.filter(
                            (role) => role.name !== task.role,
                          )}
                          onChange={(reviewerRole) => change({ reviewerRole })}
                          onAddRole={onAddRole}
                        />
                      </div>
                      <div className="col-span-2 min-w-0 @5xl:col-span-1">
                        <WaitsFor
                          task={task}
                          others={tasks.filter(
                            (other) => other.key !== task.key,
                          )}
                          label={label}
                          onChange={(dependsOn) => change({ dependsOn })}
                        />
                      </div>
                    </div>
                    {notes === task.key ? (
                      <Textarea
                        aria-label={`Notes for ${label}`}
                        placeholder="Anything whoever gets this task should know"
                        maxLength={20000}
                        value={task.notes ?? ""}
                        onChange={(event) =>
                          change({ notes: event.target.value })
                        }
                        className="mt-1.5 min-h-16 text-sm"
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
