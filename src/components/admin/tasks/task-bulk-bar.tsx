"use client";
import { useState } from "react";
import {
  CalendarClock,
  CheckCheck,
  ChevronDown,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useConfirm } from "~/components/confirm-provider";
import type { bulkTaskActionSchema } from "~/lib/tasks/input";
import { TaskSelect, type TaskRow } from "./shared";

type Action = z.input<typeof bulkTaskActionSchema>;

/** Moves offered for due dates, in days. */
const SHIFTS = [-7, -1, 1, 2, 7, 14];
/** The most one bulk change takes, as `tasks.bulk` allows. */
const MOST = 200;

const shiftLabel = (days: number) => {
  const weeks = Math.abs(days) % 7 === 0 ? Math.abs(days) / 7 : 0;
  const size = weeks
    ? `${weeks} ${weeks === 1 ? "week" : "weeks"}`
    : `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`;
  return `${days < 0 ? "−" : "+"}${size}`;
};

/** What a finished bulk change says it did: `Moved 5 tasks`. */
function doneMessage(action: Action, count: number) {
  const tasks = `${count} ${count === 1 ? "task" : "tasks"}`;
  switch (action.kind) {
    case "assign":
      return `Reassigned ${tasks}`;
    case "shift":
      return `Moved ${tasks} ${shiftLabel(action.days)}`;
    case "dates":
      return `Moved ${tasks}`;
    case "critical":
      return action.critical
        ? `Flagged ${tasks} critical`
        : `Unflagged ${tasks}`;
    case "cancel":
      return `Cancelled ${tasks}`;
    case "delete":
      return `Deleted ${tasks}`;
    case "status":
      return action.status === "DONE"
        ? `Marked ${tasks} done`
        : `Moved ${tasks} to ${action.status === "TODO" ? "to do" : "in progress"}`;
  }
}

/**
 * The bar over the task list once tasks are picked: reassign, move due dates,
 * flag, cancel or delete them together. Superadmins can also finish them or
 * set their status outright, past the usual rules, and move the agreed date
 * with the due date. Tasks a change can't apply to stay picked, with why.
 */
export function TaskBulkBar({
  tasks,
  people,
  superadmin,
  onDone,
  onClear,
}: {
  tasks: readonly TaskRow[];
  people: readonly { id: string; name: string }[];
  superadmin: boolean;
  /** With the tasks the change could not apply to, to keep them picked. */
  onDone: (failedIds: string[]) => void;
  onClear: () => void;
}) {
  const utils = api.useUtils();
  const confirm = useConfirm();
  const [agreed, setAgreed] = useState(false);
  const [moving, setMoving] = useState(false);
  const bulk = api.tasks.bulk.useMutation({
    onSuccess: ({ changed, failed }, { action }) => {
      void utils.tasks.invalidate();
      void utils.dashboard.overview.invalidate();
      if (changed) toast.success(doneMessage(action, changed));
      if (failed.length)
        toast.error(
          `${failed.length} ${failed.length === 1 ? "task" : "tasks"} couldn't change`,
          {
            description: failed
              .slice(0, 3)
              .map(({ title, message }) => `${title}: ${message}`)
              .join(" · "),
          },
        );
      onDone(failed.map((task) => task.id));
    },
    onError: (error) => toast.error(error.message),
  });
  const count = tasks.length;
  const busy = bulk.isPending || count > MOST;
  const run = (action: Action) =>
    bulk.mutate({ ids: tasks.map((task) => task.id), action });
  const confirmed = async (action: "cancel" | "delete") =>
    confirm({
      title: `${action === "cancel" ? "Cancel" : "Delete"} ${count} ${count === 1 ? "task" : "tasks"}?`,
      description:
        action === "cancel"
          ? "They stay in the timeline as cancelled. A superadmin can reopen them."
          : "They're gone for good, with their timelines.",
      confirmLabel: action === "cancel" ? "Cancel tasks" : "Delete",
      variant: "destructive",
    });

  return (
    <div
      role="toolbar"
      aria-label="Change the picked tasks"
      className="bg-background/95 sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 backdrop-blur-sm"
    >
      <span className="flex items-center gap-1">
        <span className="text-sm font-medium">{count} selected</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <X />
        </Button>
      </span>
      <div className="w-40">
        <TaskSelect
          aria-label="Reassign the picked tasks"
          disabled={busy}
          value=""
          onValueChange={(assigneeId) => {
            if (assigneeId) run({ kind: "assign", assigneeId });
          }}
          options={[
            { value: "", label: "Reassign to…" },
            ...people.map((person) => ({
              value: person.id,
              label: person.name,
            })),
          ]}
        />
      </div>
      <Popover open={moving} onOpenChange={setMoving}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            <CalendarClock />
            Move due
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <p className="text-muted-foreground px-1 pb-1.5 text-xs">
            Move their due dates by
          </p>
          <div className="grid grid-cols-3 gap-1">
            {SHIFTS.map((days) => (
              <Button
                key={days}
                variant="ghost"
                size="sm"
                className="tabular-nums"
                disabled={busy}
                onClick={() => {
                  setMoving(false);
                  run({ kind: "shift", days, agreed });
                }}
              >
                {shiftLabel(days)}
              </Button>
            ))}
          </div>
          {superadmin ? (
            <label className="mt-2 flex items-start gap-2 border-t px-1 pt-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
              />
              <span>
                Move the agreed date too
                <span className="text-muted-foreground block text-xs">
                  Superadmin. Standings won&apos;t count them late, and the hard
                  deadline doesn&apos;t apply.
                </span>
              </span>
            </label>
          ) : null}
        </PopoverContent>
      </Popover>
      {superadmin ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => run({ kind: "status", status: "DONE" })}
        >
          <CheckCheck />
          Mark done
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            More
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem
            onSelect={() => run({ kind: "critical", critical: true })}
          >
            <TriangleAlert />
            Flag critical
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => run({ kind: "critical", critical: false })}
          >
            Unflag critical
          </DropdownMenuItem>
          {superadmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                Superadmin, past the usual rules
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => run({ kind: "status", status: "TODO" })}
              >
                Back to to do
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => run({ kind: "status", status: "IN_PROGRESS" })}
              >
                In progress
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async () => {
              if (await confirmed("cancel")) run({ kind: "cancel" });
            }}
          >
            <X />
            Cancel tasks
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={async () => {
              if (await confirmed("delete")) run({ kind: "delete" });
            }}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-muted-foreground text-sm" aria-live="polite">
        {bulk.isPending
          ? "Working…"
          : count > MOST
            ? `Up to ${MOST} at a time`
            : null}
      </span>
    </div>
  );
}
