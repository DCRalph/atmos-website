"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  addDays,
  dayKey,
  formatTaskDate,
  nzDate,
  nzParts,
  TASK_TIMEZONE,
  startOfWeek,
} from "~/lib/tasks/time";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import { isOpen } from "~/lib/tasks/status";
import { TaskSelect, taskFlag, taskGroup, type TaskRow } from "./shared";
import { TasksCalendar, type CalendarColorBy } from "./calendar";
import { TaskDrawer } from "./task-drawer";
import { TaskForm } from "./task-form";
import { PasteChat, TaskSettings, TaskStandings } from "./task-tools";
import { PlaybooksView } from "./playbooks";
import { useLocalStorage } from "~/hooks/use-local-storage";
import { Checkbox } from "~/components/ui/checkbox";
import { TaskBulkBar } from "./task-bulk-bar";
const VIEWS = [
  "calendar",
  "list",
  "team",
  "proposed",
  "standings",
  "playbooks",
];
export function TasksWorkspace() {
  const search = useSearchParams(),
    router = useRouter();
  const selected = search.get("task");
  const query = api.tasks.list.useQuery(undefined, { refetchInterval: 60_000 });
  const options = api.tasks.options.useQuery();
  // `?view=proposed` and the like, so other pages can link straight to a view.
  const [view, setView] = useState(() => {
      const linked = search.get("view");
      return linked && VIEWS.includes(linked) ? linked : "calendar";
    }),
    // The calendar opens on the month; Week is one click away.
    [week, setWeek] = useState(false),
    [day, setDay] = useState(dayKey(new Date())),
    [person, setPerson] = useState(""),
    [gig, setGig] = useState(search.get("gig") ?? ""),
    [groupBy, setGroupBy] = useState("status"),
    [cellTasks, setCellTasks] = useState<string[] | null>(null),
    [dialog, setDialog] = useState<"new" | "paste" | "settings" | null>(null),
    [newDay, setNewDay] = useState(dayKey(new Date()));
  // Calendar drags, held until Save. Each drop is undone one at a time.
  const [moves, setMoves] = useState<ReadonlyMap<string, Date>>(new Map());
  const [history, setHistory] = useState<
    { id: string; previous: Date | undefined }[]
  >([]);
  // One guard for the page: calendar moves or an unsaved playbook.
  const [playbookDirty, setPlaybookDirty] = useState(false);
  useUnsavedChangesWarning({ enabled: moves.size > 0 || playbookDirty });
  const [colorChoice, setColorChoice] = useLocalStorage(
    "tasks.calendar.colorBy",
    "person",
  );
  // Filtered to one person (or one gig), coloring by them says nothing, so
  // the calendar colors by the other.
  const colorBy: CalendarColorBy =
    person && !gig
      ? "gig"
      : gig && !person
        ? "person"
        : colorChoice === "gig"
          ? "gig"
          : "person";
  const open = (id: string) => {
    const next = new URLSearchParams(search.toString());
    next.set("task", id);
    router.replace(`/admin/tasks?${next}`, { scroll: false });
  };
  const close = () => {
    const next = new URLSearchParams(search.toString());
    next.delete("task");
    router.replace(`/admin/tasks${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  };
  const tasks = (query.data ?? []).filter(
    (t) => (!person || t.assigneeId === person) && (!gig || t.gigId === gig),
  );
  const openTasks = tasks.filter((t) => isOpen(t.status));
  const alerts = api.tasks.alerts.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const utils = api.useUtils();
  const [selectedProposals, setSelectedProposals] = useState<string[]>([]);
  const acceptMany = api.tasks.acceptMany.useMutation({
    onSuccess: (rows) => {
      toast.success(`${rows.length} tasks accepted`);
      setSelectedProposals([]);
      void utils.tasks.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const proposals = tasks.filter((task) => task.status === "PROPOSED");
  const readyProposals = proposals.filter((task) => task.assigneeId);

  /** A task dropped on a day: due that day, at the same time of day. */
  const moveTask = (id: string, toDay: string) => {
    // Held while saving: the save settles what's staged now.
    if (saveMoves.isPending) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const previous = moves.get(id);
    if (dayKey(previous ?? task.projectedDueAt) === toDay) return;
    const { hour, minute } = nzParts(task.dueAt);
    const next = nzDate(toDay, hour, minute);
    setHistory((steps) => [...steps, { id, previous }]);
    setMoves((current) => {
      const updated = new Map(current);
      // Back on the day it's saved for is no change at all.
      if (toDay === dayKey(task.dueAt)) updated.delete(id);
      else updated.set(id, next);
      return updated;
    });
  };
  const undoMove = () => {
    const last = history.at(-1);
    if (!last) return;
    setHistory((steps) => steps.slice(0, -1));
    setMoves((current) => {
      const updated = new Map(current);
      if (last.previous) updated.set(last.id, last.previous);
      else updated.delete(last.id);
      return updated;
    });
  };
  const discardMoves = () => {
    setMoves(new Map());
    setHistory([]);
  };
  const saveMoves = api.tasks.bulk.useMutation({
    onSuccess: ({ changed, failed }) => {
      void utils.tasks.invalidate();
      void utils.dashboard.overview.invalidate();
      if (changed)
        toast.success(
          `Saved ${changed} ${changed === 1 ? "new date" : "new dates"}`,
        );
      if (failed.length)
        toast.error(
          `${failed.length} ${failed.length === 1 ? "task" : "tasks"} couldn't move`,
          {
            description: failed
              .slice(0, 3)
              .map(({ title, message }) => `${title}: ${message}`)
              .join(" · "),
          },
        );
      // What didn't save stays moved, to undo or try again.
      const kept = new Set(failed.map((task) => task.id));
      setMoves(
        (current) => new Map([...current].filter(([id]) => kept.has(id))),
      );
      setHistory((steps) => steps.filter((step) => kept.has(step.id)));
    },
    onError: (error) => toast.error(error.message),
  });
  const take = api.tasks.take.useMutation({
    onSuccess: () => {
      void utils.tasks.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  // Superadmins finish an alert outright instead of taking it on.
  const markDone = api.tasks.override.useMutation({
    onSuccess: () => {
      toast.success("Marked done");
      void utils.tasks.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const load = api.tasks.load.useQuery(
    {
      from: nzDate(week ? startOfWeek(day) : `${day.slice(0, 7)}-01`),
      days: week ? 7 : 35,
      spanDays: week ? 1 : 7,
      gigId: gig || undefined,
    },
    { enabled: view === "team" },
  );
  const visible = openTasks.filter(
    (t) => !cellTasks || cellTasks.includes(t.id),
  );
  // Picked in the list for a bulk change. Only what's still listed counts.
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const selection = visible.filter((t) => picked.has(t.id));
  const pick = (ids: readonly string[], on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  /** A checkbox that picks every task in `rows`, half-ticked when some are. */
  const pickAll = (rows: readonly TaskRow[], label: string) => {
    const on = rows.filter((t) => picked.has(t.id)).length;
    return (
      <Checkbox
        aria-label={label}
        checked={on === 0 ? false : on === rows.length ? true : "indeterminate"}
        onCheckedChange={(checked) =>
          pick(
            rows.map((t) => t.id),
            checked === true,
          )
        }
      />
    );
  };
  const groups = [
    ...new Set(
      visible.map((t) =>
        groupBy === "person"
          ? (t.assignee?.name ?? "Unassigned")
          : taskGroup(t),
      ),
    ),
  ];
  const groupOrder = [
    "Overdue",
    "Today",
    "This week",
    "Later",
    "Waiting",
    "Blocked",
    "In review",
  ];
  if (groupBy !== "person")
    groups.sort((a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b));
  else groups.sort((a, b) => a.localeCompare(b));
  const columns: DataTableColumn<TaskRow>[] = [
    {
      id: "pick",
      header: "",
      className: "w-10",
      cell: (t) => (
        <Checkbox
          aria-label={`Select ${t.title}`}
          checked={picked.has(t.id)}
          onCheckedChange={(checked) => pick([t.id], checked === true)}
        />
      ),
    },
    {
      id: "title",
      header: "Task",
      cell: (t) => (
        <span>
          {t.critical ? "! " : ""}
          {t.title}
        </span>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      accessor: (t) => t.assignee?.name ?? "Unassigned",
    },
    {
      id: "due",
      header: "Due",
      accessor: (t) => t.projectedDueAt,
      cell: (t) => (
        <span>
          {formatTaskDate(t.projectedDueAt)}
          {t.projectedDueAt.getTime() !== t.dueAt.getTime() ? (
            <span className="text-muted-foreground block text-xs">
              Projected · was {formatTaskDate(t.dueAt)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessor: taskFlag,
      cell: (t) => (
        <span>
          {taskFlag(t)}
          {t.risk ? (
            <span className="text-muted-foreground block max-w-72 text-xs">
              {t.risk.short}
            </span>
          ) : null}
        </span>
      ),
    },
    { id: "gig", header: "Gig", accessor: (t) => t.gig?.title ?? "" },
  ];
  const title = new Intl.DateTimeFormat("en-NZ", {
    timeZone: TASK_TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(nzDate(day, 12));
  const move = (direction: number) => {
    if (week) setDay(addDays(day, direction * 7));
    else {
      const date = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + direction);
      setDay(date.toISOString().slice(0, 10));
    }
    setCellTasks(null);
  };
  return (
    <AdminSection
      title="Tasks"
      description="The run-up to every gig, shared across the team."
      actions={
        <>
          <Button variant="outline" onClick={() => setDialog("paste")}>
            Paste chat
          </Button>
          <Button variant="outline" onClick={() => setDialog("settings")}>
            Settings
          </Button>
          <Button
            onClick={() => {
              setNewDay(dayKey(new Date()));
              setDialog("new");
            }}
          >
            <Plus />
            Add task
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {alerts.data?.length ? (
          <section
            aria-label="Task alerts"
            className="border-destructive/30 rounded-lg border"
          >
            {alerts.data.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 last:border-b-0"
              >
                <button
                  type="button"
                  className="min-w-0 text-left text-sm"
                  onClick={() => open(t.id)}
                >
                  <span className="text-destructive mr-2 font-semibold">
                    {taskFlag(t)}
                  </span>
                  {t.title} · {t.assignee?.name ?? "Unassigned"}
                  <span className="text-muted-foreground ml-2">
                    {t.risk
                      ? t.risk.short
                      : t.overdue
                        ? `${Math.max(1, Math.floor(t.lateMinutes / 60))}h late`
                        : formatTaskDate(t.dueAt)}{" "}
                    · {t.flagged ? "Flagged" : "No delay reported"}
                    {t.blockedReason ? ` · ${t.blockedReason}` : ""}
                  </span>
                </button>
                <div className="flex gap-2">
                  {t.status !== "IN_REVIEW" &&
                  t.assigneeId !== options.data?.userId &&
                  !t.waiting ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={take.isPending}
                      onClick={() => take.mutate({ id: t.id })}
                    >
                      Take it
                    </Button>
                  ) : null}
                  {options.data?.superadmin ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={markDone.isPending}
                      onClick={() =>
                        markDone.mutate({ id: t.id, status: "DONE" })
                      }
                    >
                      Mark done
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        ) : null}
        <p className="text-muted-foreground text-sm">
          This week:{" "}
          {
            openTasks.filter(
              (t) =>
                t.projectedDueAt >= nzDate(startOfWeek(dayKey(new Date()))) &&
                t.projectedDueAt <
                  nzDate(addDays(startOfWeek(dayKey(new Date())), 7)),
            ).length
          }{" "}
          due · {openTasks.filter((t) => t.waiting).length} waiting ·{" "}
          {openTasks.filter((t) => t.upForGrabs).length} up for grabs
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div
            className="flex flex-wrap gap-1"
            role="tablist"
            aria-label="Task views"
          >
            {VIEWS.map((v) => (
              <Button
                role="tab"
                aria-selected={view === v}
                key={v}
                variant={view === v ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setView(v);
                  setCellTasks(null);
                }}
              >
                {v[0]!.toUpperCase() + v.slice(1)}
                {v === "proposed"
                  ? ` (${tasks.filter((t) => t.status === "PROPOSED").length})`
                  : ""}
              </Button>
            ))}
          </div>
          {view === "playbooks" ? null : (
            <div className="flex w-full gap-2 sm:w-auto">
              <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
                <TaskSelect
                  aria-label="Person filter"
                  value={person}
                  onValueChange={setPerson}
                  options={[
                    { value: "", label: "Everyone" },
                    ...(options.data?.people.map((p) => ({
                      value: p.id,
                      label: p.name,
                    })) ?? []),
                  ]}
                />
              </div>
              <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
                <TaskSelect
                  aria-label="Gig filter"
                  value={gig}
                  onValueChange={setGig}
                  options={[
                    { value: "", label: "All gigs" },
                    ...(options.data?.gigs.map((g) => ({
                      value: g.id,
                      label: g.title,
                    })) ?? []),
                  ]}
                />
              </div>
            </div>
          )}
        </div>
        {query.error ? (
          <p role="alert" className="text-destructive">
            {query.error.message}
          </p>
        ) : query.isPending ? (
          <p className="text-sm" role="status">
            Loading tasks…
          </p>
        ) : null}
        {view === "calendar" || view === "team" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                aria-label="Previous period"
                onClick={() => move(-1)}
              >
                <ChevronLeft />
              </Button>
              <h2 className="min-w-36 text-center font-semibold">
                {week
                  ? `Week of ${new Intl.DateTimeFormat("en-NZ", { timeZone: TASK_TIMEZONE, day: "numeric", month: "short" }).format(nzDate(startOfWeek(day), 12))}`
                  : title}
              </h2>
              <Button
                size="icon"
                variant="outline"
                aria-label="Next period"
                onClick={() => move(1)}
              >
                <ChevronRight />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDay(dayKey(new Date()))}
              >
                Today
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {view === "calendar" ? (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground mr-1 text-sm">
                    Color by
                  </span>
                  <Button
                    variant={colorBy === "person" ? "secondary" : "ghost"}
                    aria-pressed={colorBy === "person"}
                    disabled={!!person && !gig}
                    title={
                      person && !gig ? "Showing one person's tasks" : undefined
                    }
                    onClick={() => setColorChoice("person")}
                  >
                    Person
                  </Button>
                  <Button
                    variant={colorBy === "gig" ? "secondary" : "ghost"}
                    aria-pressed={colorBy === "gig"}
                    disabled={!!gig && !person}
                    title={
                      gig && !person ? "Showing one gig's tasks" : undefined
                    }
                    onClick={() => setColorChoice("gig")}
                  >
                    Gig
                  </Button>
                </div>
              ) : null}
              <div className="flex gap-1">
                <Button
                  variant={week ? "ghost" : "secondary"}
                  onClick={() => setWeek(false)}
                >
                  Month
                </Button>
                <Button
                  variant={week ? "secondary" : "ghost"}
                  onClick={() => setWeek(true)}
                >
                  Week
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {view === "calendar" && (moves.size > 0 || history.length > 0) ? (
          <div
            role="toolbar"
            aria-label="Unsaved calendar changes"
            className="bg-background/95 sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 backdrop-blur-sm"
          >
            <span className="text-sm font-medium">
              {moves.size
                ? `${moves.size} ${moves.size === 1 ? "task" : "tasks"} moved`
                : "Back where they were"}
            </span>
            <span className="text-muted-foreground text-sm">
              {moves.size ? "Not saved yet" : "Nothing to save"}
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={saveMoves.isPending}
                onClick={discardMoves}
              >
                Discard
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!history.length || saveMoves.isPending}
                onClick={undoMove}
              >
                <Undo2 />
                Undo
              </Button>
              <Button
                size="sm"
                disabled={!moves.size || saveMoves.isPending}
                onClick={() =>
                  saveMoves.mutate({
                    ids: [...moves.keys()],
                    action: {
                      kind: "dates",
                      dueAts: Object.fromEntries(moves),
                    },
                  })
                }
              >
                <Check />
                {saveMoves.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : null}
        {view === "calendar" ? (
          <TasksCalendar
            tasks={tasks}
            gigs={(options.data?.gigs ?? []).filter(
              (g) => !gig || g.id === gig,
            )}
            people={options.data?.people ?? []}
            colorBy={colorBy}
            day={day}
            week={week}
            moves={moves}
            onMove={moveTask}
            onOpen={open}
            onNew={(d) => {
              setNewDay(d);
              setDialog("new");
            }}
          />
        ) : null}
        {view === "list" ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-44">
                <TaskSelect
                  aria-label="Group list"
                  value={groupBy}
                  onValueChange={setGroupBy}
                  options={[
                    { value: "status", label: "Group by status" },
                    { value: "person", label: "Group by person" },
                  ]}
                />
              </div>
              {cellTasks ? (
                <Button variant="ghost" onClick={() => setCellTasks(null)}>
                  Clear day selection
                </Button>
              ) : null}
              {visible.length ? (
                <label className="flex items-center gap-2 text-sm">
                  {pickAll(visible, "Select every task in the list")}
                  Select all
                </label>
              ) : null}
            </div>
            {selection.length ? (
              <TaskBulkBar
                tasks={selection}
                people={options.data?.people ?? []}
                superadmin={!!options.data?.superadmin}
                onDone={(failed) => setPicked(new Set(failed))}
                onClear={() => setPicked(new Set())}
              />
            ) : null}
            {groups.map((group) => {
              const rows = visible.filter(
                (t) =>
                  (groupBy === "person"
                    ? (t.assignee?.name ?? "Unassigned")
                    : taskGroup(t)) === group,
              );
              return (
                <div key={group}>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    {pickAll(rows, `Select every task in ${group}`)}
                    {group}
                    <span className="text-muted-foreground font-normal">
                      {rows.length}
                    </span>
                  </h2>
                  <DataTable
                    data={rows}
                    columns={columns}
                    getRowId={(t) => t.id}
                    onRowClick={(t) => open(t.id)}
                    enableSearch={false}
                    enablePagination={false}
                  />
                </div>
              );
            })}
            {!groups.length ? (
              <p className="text-muted-foreground py-8 text-sm">
                No tasks in this view. Add a task or apply a playbook to a gig.
              </p>
            ) : null}
          </>
        ) : null}
        {view === "team" ? (
          <div>
            <p
              id="task-load-help"
              className="text-muted-foreground mb-3 text-sm"
            >
              Open load · Critical counts double, waiting counts half. Select a
              cell to see its tasks.
            </p>
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm"
                aria-describedby="task-load-help"
              >
                <thead>
                  <tr>
                    <th className="p-2 text-left">Person</th>
                    {load.data?.[0]?.cells.map((cell) => (
                      <th className="p-2" key={cell.day}>
                        {cell.day.slice(5)}
                        {options.data?.gigs.some(
                          (g) =>
                            dayKey(g.gigStartTime) >= cell.day &&
                            dayKey(g.gigStartTime) <
                              addDays(cell.day, week ? 1 : 7),
                        )
                          ? " · Gig"
                          : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {load.data
                    ?.filter((p) => !person || p.id === person)
                    .map((p) => (
                      <tr key={p.id}>
                        <th className="p-2 text-left font-medium">{p.name}</th>
                        {p.cells.map((cell) => (
                          <td key={cell.day} className="p-1">
                            <button
                              type="button"
                              className="focus-visible:ring-ring w-full rounded border px-4 py-4 focus-visible:ring-2"
                              style={{
                                backgroundColor: `color-mix(in srgb, var(--primary) ${Math.min(4 + cell.weighted * 7, 35)}%, transparent)`,
                              }}
                              onClick={() => {
                                setCellTasks(cell.taskIds);
                                setPerson(p.id);
                                setView("list");
                              }}
                              aria-label={`${p.name}, ${cell.day}: ${cell.count} tasks, load ${cell.weighted}`}
                            >
                              {cell.count}
                              <span className="block text-xs">
                                {cell.weighted} load
                              </span>
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {view === "proposed" ? (
          <div className="space-y-3">
            {proposals.length ? (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    aria-label="Select proposals with owners"
                    checked={
                      readyProposals.length > 0 &&
                      readyProposals.every((task) =>
                        selectedProposals.includes(task.id),
                      )
                    }
                    onChange={(e) =>
                      setSelectedProposals(
                        e.target.checked
                          ? readyProposals.map((task) => task.id)
                          : [],
                      )
                    }
                  />
                  Select ready proposals
                </label>
                <Button
                  size="sm"
                  disabled={
                    acceptMany.isPending ||
                    !readyProposals.some((task) =>
                      selectedProposals.includes(task.id),
                    )
                  }
                  onClick={() =>
                    acceptMany.mutate({
                      proposals: readyProposals
                        .filter((task) => selectedProposals.includes(task.id))
                        .map((task) => ({
                          id: task.id,
                          assigneeId: task.assigneeId!,
                          dueAt: task.dueAt,
                        })),
                    })
                  }
                >
                  Accept selected
                </Button>
                <p className="text-muted-foreground text-xs">
                  Check owners and dates before accepting. Open a proposal to
                  edit them.
                </p>
              </div>
            ) : null}
            {proposals.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 rounded-lg border p-4"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  aria-label={`Select ${task.title}`}
                  disabled={!task.assigneeId}
                  checked={selectedProposals.includes(task.id)}
                  onChange={(e) =>
                    setSelectedProposals((ids) =>
                      e.target.checked
                        ? [...ids, task.id]
                        : ids.filter((id) => id !== task.id),
                    )
                  }
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => open(task.id)}
                >
                  <p className="font-medium">{task.title}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {task.assignee?.name ?? "Choose owner"} ·{" "}
                    {formatTaskDate(task.dueAt)} · {task.source}
                  </p>
                  {task.sourceQuote ? (
                    <blockquote className="mt-3 border-l pl-3 text-sm">
                      {task.sourceQuote}
                    </blockquote>
                  ) : null}
                </button>
              </div>
            ))}
            {!proposals.length ? (
              <p className="text-muted-foreground py-8 text-sm">
                No proposals. Paste a chat or plan a gig to draft some.
              </p>
            ) : null}
          </div>
        ) : null}
        {view === "standings" ? <TaskStandings onOpen={open} /> : null}
        {/* Kept mounted on other tabs, so unsaved playbook edits survive a look at the calendar. */}
        <div hidden={view !== "playbooks"}>
          <PlaybooksView onDirtyChange={setPlaybookDirty} />
        </div>
      </div>
      <TaskDrawer id={selected} onClose={close} onOpen={open} />
      <Dialog
        open={!!dialog}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDialog(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog === "new"
                ? "Add task"
                : dialog === "paste"
                  ? "Paste chat"
                  : "Task settings"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "new"
                ? "One owner and an agreed due time."
                : dialog === "paste"
                  ? "Review proposals before assigning responsibility."
                  : "Team preferences and your calendar feed."}
            </DialogDescription>
          </DialogHeader>
          {dialog === "new" ? (
            <TaskForm
              due={nzDate(newDay, 17)}
              gigId={gig || undefined}
              onSaved={(id) => {
                setDialog(null);
                open(id);
              }}
            />
          ) : dialog === "paste" ? (
            <PasteChat />
          ) : dialog === "settings" ? (
            <TaskSettings />
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}
