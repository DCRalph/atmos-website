"use client";
import { useState } from "react";
import { CalendarDays, Plus, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useConfirm } from "~/components/confirm-provider";
import { cn } from "~/lib/utils";
import { WEEKDAY_KEYS } from "~/lib/tasks/input";
import {
  WEEKDAY_NAMES,
  daysBetween,
  formatClock,
  formatTaskWhen,
  moveWhen,
  playbookDueAt,
  type PlaybookGig,
  type PlaybookRole,
  type PlaybookTask,
  type PlaybookWhen,
} from "~/lib/tasks/playbooks";
import { addDays, dayKey, formatTaskDate } from "~/lib/tasks/time";
import { formatEventDate } from "~/lib/ticketing/dates";
import { TaskField, TaskSelect } from "./shared";

/**
 * The pieces of the playbook editor that edit one thing: when a task is due,
 * which role it belongs to, what it waits for, and the playbook's roles.
 */

export type Person = { id: string; name: string };

/** Every half hour of the day, for due times. */
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const value = `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`;
  return { value, label: formatClock(value) };
});

/** A time picker that also offers whatever odd time is already set. */
export function timeOptions(current: string | null | undefined) {
  return current && !TIME_OPTIONS.some((option) => option.value === current)
    ? [{ value: current, label: formatClock(current) }, ...TIME_OPTIONS]
    : TIME_OPTIONS;
}

/**
 * A number committed on blur or Enter, so a task doesn't jump around the
 * calendar while it's being typed. Key it by `value` to pick up outside
 * changes.
 */
function NumberField({
  value,
  label,
  step = 1,
  onCommit,
}: {
  value: number;
  label: string;
  step?: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const parsed = Number(text.trim());
    if (!text.trim() || !Number.isFinite(parsed) || parsed < 0)
      setText(String(value));
    else if (parsed !== value) onCommit(parsed);
  };
  return (
    <Input
      aria-label={label}
      inputMode={step < 1 ? "decimal" : "numeric"}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="h-9 w-16 text-right tabular-nums"
    />
  );
}

/** A select sized to sit inside a sentence. */
function Pick({
  className,
  ...props
}: Parameters<typeof TaskSelect>[0] & { className?: string }) {
  return (
    <div className={cn("w-28 shrink-0", className)}>
      <TaskSelect {...props} />
    </div>
  );
}

/**
 * When a task is due, as a rule counted from the gig: days or weeks, a
 * weekday, or hours from doors. Shows where it lands on the preview gig.
 * Switching kind keeps the task on the same day.
 */
export function WhenEditor({
  task,
  gig,
  dueTime,
  onChange,
}: {
  task: Pick<PlaybookTask, "key" | "when" | "time">;
  gig: PlaybookGig;
  dueTime: string | null;
  onChange: (fields: Partial<Pick<PlaybookTask, "when" | "time">>) => void;
}) {
  const { when } = task;
  const { dueAt, movedFrom } = playbookDueAt(task, gig, dueTime);
  const gigDay = dayKey(gig.startsAt);
  const offset = daysBetween(gigDay, dayKey(dueAt));
  const [weeksUnit, setWeeksUnit] = useState(
    when.kind === "days" && when.days !== 0 && when.days % 7 === 0,
  );
  const setWhen = (next: PlaybookWhen) => onChange({ when: next });

  const switchTo = (kind: PlaybookWhen["kind"]) => {
    if (kind === when.kind) return;
    if (kind === "hours")
      return setWhen({
        kind: "hours",
        hours:
          Math.round((dueAt.getTime() - gig.startsAt.getTime()) / 1_800_000) /
          2,
        from: "start",
      });
    if (kind === "days")
      return setWhen({
        kind: "days",
        days: Math.min(30, Math.max(-365, offset)),
      });
    // A weekday rule can't land on the gig day, so that becomes the day before.
    const day = offset === 0 ? addDays(gigDay, -1) : dayKey(dueAt);
    setWhen(
      moveWhen(
        { when: { kind: "weekday", day: "mon", side: "before", weeks: 0 } },
        day,
        gig,
        dueTime,
      ),
    );
  };

  const sides = [
    { value: "before", label: "before" },
    { value: "after", label: "after" },
  ];
  const away =
    offset === 0
      ? "on the gig day"
      : `${Math.abs(offset)} ${Math.abs(offset) === 1 ? "day" : "days"} ${offset < 0 ? "before" : "after"} the gig`;

  return (
    <div className="space-y-2.5">
      <Tabs
        value={when.kind}
        onValueChange={(kind) => switchTo(kind as PlaybookWhen["kind"])}
      >
        <TabsList className="w-full">
          <TabsTrigger value="days">Days</TabsTrigger>
          <TabsTrigger value="weekday">Weekday</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
        </TabsList>
      </Tabs>

      {when.kind === "days" ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <NumberField
              key={`${when.days}-${weeksUnit}`}
              label="How many"
              value={Math.abs(
                weeksUnit && when.days % 7 === 0 ? when.days / 7 : when.days,
              )}
              onCommit={(count) => {
                const days = Math.round(count) * (weeksUnit ? 7 : 1);
                setWhen({
                  ...when,
                  days: Math.min(
                    30,
                    Math.max(-365, when.days > 0 ? days : -days),
                  ),
                });
              }}
            />
            <Pick
              aria-label="Days or weeks"
              className="w-24"
              value={weeksUnit && when.days % 7 === 0 ? "weeks" : "days"}
              onValueChange={(unit) => {
                const weeks = unit === "weeks";
                setWeeksUnit(weeks);
                const count = Math.abs(
                  weeksUnit && when.days % 7 === 0 ? when.days / 7 : when.days,
                );
                const days = count * (weeks ? 7 : 1);
                setWhen({
                  ...when,
                  days: Math.min(
                    30,
                    Math.max(-365, when.days > 0 ? days : -days),
                  ),
                });
              }}
              options={[
                { value: "days", label: "days" },
                { value: "weeks", label: "weeks" },
              ]}
            />
            <Pick
              aria-label="Before or after the gig"
              className="w-24"
              value={when.days > 0 ? "after" : "before"}
              onValueChange={(side) =>
                setWhen({
                  ...when,
                  days: Math.min(
                    30,
                    side === "after"
                      ? Math.abs(when.days)
                      : -Math.abs(when.days),
                  ),
                })
              }
              options={sides}
            />
            <span>the gig</span>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={!!when.weekdays}
              onCheckedChange={(checked) =>
                setWhen({
                  kind: "days",
                  days: when.days,
                  ...(checked ? { weekdays: true } : {}),
                })
              }
            />
            <span>
              Weekdays only
              <span className="text-muted-foreground block text-xs">
                A weekend date moves to the Friday before, or the Monday after
                the gig.
              </span>
            </span>
          </label>
        </>
      ) : null}

      {when.kind === "weekday" ? (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span>The</span>
          <Pick
            aria-label="Weekday"
            className="w-36"
            value={when.day}
            onValueChange={(day) =>
              setWhen({
                ...when,
                day: WEEKDAY_KEYS.find((key) => key === day) ?? when.day,
              })
            }
            options={WEEKDAY_KEYS.map((day) => ({
              value: day,
              label: WEEKDAY_NAMES[day],
            }))}
          />
          <Pick
            aria-label="How many weeks further out"
            value={String(when.weeks)}
            onValueChange={(weeks) =>
              setWhen({ ...when, weeks: Number(weeks) })
            }
            options={Array.from(
              { length: Math.max(13, when.weeks + 1) },
              (_, weeks) => ({
                value: String(weeks),
                label:
                  weeks === 0
                    ? "just"
                    : `${weeks} ${weeks === 1 ? "week" : "weeks"}`,
              }),
            )}
          />
          <Pick
            aria-label="Before or after the gig"
            className="w-24"
            value={when.side}
            onValueChange={(side) =>
              setWhen({ ...when, side: side === "after" ? "after" : "before" })
            }
            options={sides}
          />
          <span>the gig</span>
        </div>
      ) : null}

      {when.kind === "hours" ? (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <NumberField
            key={when.hours}
            label="How many hours"
            step={0.5}
            value={Math.abs(when.hours)}
            onCommit={(hours) =>
              setWhen({
                ...when,
                hours: Math.min(
                  720,
                  when.hours > 0 ? hours : -Math.min(8760, hours),
                ),
              })
            }
          />
          <span>hours</span>
          <Pick
            aria-label="Before or after"
            className="w-24"
            value={when.hours > 0 ? "after" : "before"}
            onValueChange={(side) =>
              setWhen({
                ...when,
                hours:
                  side === "after"
                    ? Math.min(720, Math.abs(when.hours))
                    : -Math.abs(when.hours),
              })
            }
            options={sides}
          />
          <Pick
            aria-label="Counted from"
            value={when.from}
            onValueChange={(from) =>
              setWhen({
                ...when,
                from:
                  from === "doors" ? "doors" : from === "end" ? "end" : "start",
              })
            }
            options={[
              { value: "doors", label: "doors" },
              { value: "start", label: "the start" },
              { value: "end", label: "close" },
            ]}
          />
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground w-6">At</span>
          <Pick
            aria-label="Due time"
            className="w-56"
            value={task.time ?? ""}
            onValueChange={(time) => onChange({ time: time || undefined })}
            options={[
              {
                value: "",
                label: `Default (${dueTime ? formatClock(dueTime) : "gig start"})`,
              },
              ...timeOptions(task.time),
            ]}
          />
        </div>
      )}

      <p className="text-muted-foreground flex gap-2 border-t pt-2.5 text-xs">
        <CalendarDays className="mt-px size-3.5 shrink-0" />
        <span>
          {movedFrom ? (
            <>
              {formatEventDate(new Date(`${movedFrom}T12:00:00Z`), "UTC")} is a
              weekend, so it moves to{" "}
            </>
          ) : (
            "Lands on "
          )}
          <span className="text-foreground font-medium">
            {formatTaskDate(dueAt)}
          </span>
          , {away}.
        </span>
      </p>
    </div>
  );
}

const NEW_ROLE = "__new_role__";

/**
 * Picks one of the playbook's roles, or adds a new one in place. Reviewers
 * can also have no review.
 */
export function RoleSelect({
  value,
  roles,
  label,
  reviewer = false,
  onChange,
  onAddRole,
}: {
  value: string | undefined;
  roles: readonly PlaybookRole[];
  label: string;
  reviewer?: boolean;
  onChange: (role: string | undefined) => void;
  onAddRole: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const add = () => {
    const name = text.trim();
    setAdding(false);
    setText("");
    if (!name) return;
    onAddRole(name);
    onChange(name);
  };
  if (adding)
    return (
      <div className="flex gap-1.5">
        <Input
          autoFocus
          aria-label={`New role for ${label}`}
          placeholder="Role name"
          maxLength={80}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
            if (event.key === "Escape") setAdding(false);
          }}
          onBlur={add}
          className="h-9 min-w-0"
        />
      </div>
    );
  return (
    <TaskSelect
      aria-label={label}
      value={value ?? ""}
      onValueChange={(next) => {
        if (next === NEW_ROLE) setAdding(true);
        else onChange(next || undefined);
      }}
      options={[
        { value: "", label: reviewer ? "No review" : "Choose a role" },
        ...roles.map((role) => ({ value: role.name, label: role.name })),
        { value: NEW_ROLE, label: "New role…" },
      ]}
    />
  );
}

/** The other tasks this one waits for, ticked from a list in date order. */
export function WaitsFor({
  task,
  others,
  label,
  onChange,
}: {
  task: Pick<PlaybookTask, "dependsOn">;
  others: readonly PlaybookTask[];
  label: string;
  onChange: (dependsOn: string[]) => void;
}) {
  const waits = others.filter((other) => task.dependsOn.includes(other.key));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`What ${label} waits for`}
          className={cn(
            "h-9 w-full justify-start truncate px-2.5 font-normal",
            waits.length === 0 && "text-muted-foreground",
          )}
        >
          <span className="truncate">
            {waits.length
              ? waits.map((other) => other.title || "Untitled").join(", ")
              : "Nothing"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-80 w-80 overflow-y-auto p-1"
      >
        <p className="text-muted-foreground px-2 py-1.5 text-xs">
          Waits for these to be done
        </p>
        {others.map((other) => (
          <label
            key={other.key}
            className="hover:bg-accent flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm"
          >
            <Checkbox
              className="mt-0.5"
              checked={task.dependsOn.includes(other.key)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...task.dependsOn, other.key]
                    : task.dependsOn.filter((key) => key !== other.key),
                )
              }
            />
            <span className="min-w-0">
              <span className="block">{other.title || "Untitled task"}</span>
              <span className="text-muted-foreground block text-xs">
                {formatTaskWhen(other)}
              </span>
            </span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Everything about one playbook task, for the side panel or a sheet on a phone. */
export function TaskPanel({
  task,
  others,
  roles,
  gig,
  dueTime,
  canRemove,
  onChange,
  onAddRole,
  onRemove,
}: {
  task: PlaybookTask;
  others: readonly PlaybookTask[];
  roles: readonly PlaybookRole[];
  gig: PlaybookGig;
  dueTime: string | null;
  canRemove: boolean;
  onChange: (fields: Partial<PlaybookTask>) => void;
  onAddRole: (name: string) => void;
  onRemove: () => void;
}) {
  const label = task.title.trim() || "this task";
  return (
    <div className="space-y-4">
      <TaskField label="Task">
        <Input
          placeholder="What needs doing"
          maxLength={200}
          value={task.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </TaskField>
      <div className="grid gap-2">
        <span className="text-sm font-medium">When</span>
        <WhenEditor
          key={task.key}
          task={task}
          gig={gig}
          dueTime={dueTime}
          onChange={onChange}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <span className="text-sm font-medium">Owner</span>
          <RoleSelect
            label={`Owner role for ${label}`}
            value={task.role}
            roles={roles}
            onChange={(role) => onChange({ role: role ?? "" })}
            onAddRole={onAddRole}
          />
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium">Reviewer</span>
          <RoleSelect
            reviewer
            label={`Reviewer role for ${label}`}
            value={task.reviewerRole}
            roles={roles.filter((role) => role.name !== task.role)}
            onChange={(reviewerRole) => onChange({ reviewerRole })}
            onAddRole={onAddRole}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium">Waits for</span>
        <WaitsFor
          task={task}
          others={others}
          label={label}
          onChange={(dependsOn) => onChange({ dependsOn })}
        />
      </div>
      <TaskField label="Notes">
        <Textarea
          placeholder="Anything whoever gets this task should know"
          maxLength={20000}
          value={task.notes ?? ""}
          onChange={(event) => onChange({ notes: event.target.value })}
          className="min-h-20 text-sm font-normal"
        />
      </TaskField>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={task.critical}
            onCheckedChange={(checked) => onChange({ critical: !!checked })}
          />
          <span>
            Critical
            <span className="text-muted-foreground block text-xs">
              Escalates sooner when late
            </span>
          </span>
        </label>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={!canRemove}
          onClick={onRemove}
        >
          Remove task
        </Button>
      </div>
    </div>
  );
}

/**
 * The playbook's roles: who owns its work. Each can be renamed (which moves
 * its tasks with it, or merges it into a role of that name), given the person
 * who usually fills it, and a line on what it covers. Picking a role's task
 * count shows just its tasks on the calendar.
 */
export function RolesManager({
  roles,
  tasks,
  people,
  highlight,
  onHighlight,
  onRename,
  onChange,
  onAdd,
  onRemove,
}: {
  roles: readonly PlaybookRole[];
  tasks: readonly PlaybookTask[];
  people: readonly Person[];
  highlight: string | null;
  onHighlight: (role: string | null) => void;
  onRename: (from: string, to: string) => void;
  onChange: (name: string, fields: Partial<PlaybookRole>) => void;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const name = text.trim();
    if (!name) return;
    onAdd(name);
    setText("");
  };
  return (
    <div>
      <ul className="divide-y">
        {roles.map((role) => (
          <RoleRow
            key={role.name}
            role={role}
            others={roles.filter((other) => other.name !== role.name)}
            owns={tasks.filter((task) => task.role === role.name).length}
            reviews={
              tasks.filter((task) => task.reviewerRole === role.name).length
            }
            people={people}
            highlighted={highlight === role.name}
            onHighlight={() =>
              onHighlight(highlight === role.name ? null : role.name)
            }
            onRename={(to) => onRename(role.name, to)}
            onChange={(fields) => onChange(role.name, fields)}
            onRemove={() => onRemove(role.name)}
          />
        ))}
      </ul>
      <div className="mt-2 flex gap-1.5">
        <Input
          aria-label="New role"
          placeholder="Add a role, like door"
          maxLength={80}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
          }}
          className="h-8"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!text.trim() || roles.length >= 20}
          onClick={add}
        >
          <Plus />
          Add
        </Button>
      </div>
    </div>
  );
}

function RoleRow({
  role,
  others,
  owns,
  reviews,
  people,
  highlighted,
  onHighlight,
  onRename,
  onChange,
  onRemove,
}: {
  role: PlaybookRole;
  others: readonly PlaybookRole[];
  owns: number;
  reviews: number;
  people: readonly Person[];
  highlighted: boolean;
  onHighlight: () => void;
  onRename: (to: string) => void;
  onChange: (fields: Partial<PlaybookRole>) => void;
  onRemove: () => void;
}) {
  const confirm = useConfirm();
  const [name, setName] = useState(role.name);
  const used = owns + reviews;
  const rename = async () => {
    const to = name.trim();
    if (!to || to === role.name) return setName(role.name);
    if (
      others.some((other) => other.name === to) &&
      !(await confirm({
        title: `Merge ${role.name} into ${to}?`,
        description: `Its tasks move to ${to}, and ${role.name} goes.`,
        confirmLabel: "Merge",
      }))
    )
      return setName(role.name);
    onRename(to);
  };
  const usage = [
    owns ? `${owns} ${owns === 1 ? "task" : "tasks"}` : null,
    reviews ? `reviews ${reviews}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="space-y-1.5 py-2.5">
      <div className="flex items-center gap-1">
        <Input
          aria-label={`Role name ${role.name}`}
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => void rename()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="h-8 min-w-0 flex-1 font-medium"
        />
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={highlighted}
          disabled={!used}
          title={used ? "Show just its tasks" : undefined}
          onClick={onHighlight}
          className={cn(
            "h-8 px-2 text-xs font-normal",
            highlighted
              ? "bg-admin-accent/10 text-admin-accent hover:text-admin-accent"
              : "text-muted-foreground",
          )}
        >
          {usage || "Not used"}
        </Button>
        {used ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${role.name}`}
                className="text-muted-foreground"
              >
                <X />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-1">
              <p className="text-muted-foreground px-2 py-1.5 text-xs">
                {others.length
                  ? `Move its ${used === 1 ? "task" : `${used} tasks`} to`
                  : "Add another role to move its tasks to first."}
              </p>
              {others.map((other) => (
                <button
                  key={other.name}
                  type="button"
                  onClick={() => onRename(other.name)}
                  className="hover:bg-accent w-full rounded-sm px-2 py-1.5 text-left text-sm"
                >
                  {other.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${role.name}`}
            className="text-muted-foreground"
            onClick={onRemove}
          >
            <X />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 text-sm">
        <span className="text-muted-foreground text-xs">Usually</span>
        <TaskSelect
          aria-label={`Who is usually ${role.name}`}
          value={
            role.userId && people.some((person) => person.id === role.userId)
              ? role.userId
              : ""
          }
          onValueChange={(userId) => onChange({ userId: userId || null })}
          options={[
            { value: "", label: "Ask each time" },
            ...people.map((person) => ({
              value: person.id,
              label: person.name,
            })),
          ]}
        />
        <span className="text-muted-foreground text-xs">Covers</span>
        <Input
          aria-label={`What ${role.name} covers`}
          placeholder="What it covers"
          maxLength={160}
          value={role.note ?? ""}
          onChange={(event) => onChange({ note: event.target.value })}
          className="h-8"
        />
      </div>
    </li>
  );
}
