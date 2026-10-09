"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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
  TASK_TIMEZONE,
  startOfWeek,
} from "~/lib/tasks/time";
import { isOpen } from "~/lib/tasks/status";
import { TaskSelect, taskFlag, taskGroup, type TaskRow } from "./shared";
import { TasksCalendar } from "./calendar";
import { TaskDrawer } from "./task-drawer";
import { TaskForm } from "./task-form";
import {
  ApplyPlaybook,
  PasteChat,
  TaskSettings,
  TaskStandings,
} from "./task-tools";
export function TasksWorkspace() {
  const search = useSearchParams(),
    router = useRouter();
  const selected = search.get("task");
  const query = api.tasks.list.useQuery(undefined, { refetchInterval: 60_000 });
  const options = api.tasks.options.useQuery();
  const [view, setView] = useState("calendar"),
    [week, setWeek] = useState(true),
    [day, setDay] = useState(dayKey(new Date())),
    [person, setPerson] = useState(""),
    [gig, setGig] = useState(search.get("gig") ?? ""),
    [groupBy, setGroupBy] = useState("status"),
    [cellTasks, setCellTasks] = useState<string[] | null>(null),
    [dialog, setDialog] = useState<
      "new" | "paste" | "settings" | "playbook" | null
    >(null),
    [newDay, setNewDay] = useState(dayKey(new Date()));
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

  const take = api.tasks.take.useMutation({
    onSuccess: () => {
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
    { id: "status", header: "Status", accessor: taskFlag },
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
                    {t.atRisk
                      ? `${Math.ceil(t.shortMinutes / 60)}h short of deadline`
                      : t.overdue
                        ? `${Math.max(1, Math.floor(t.lateMinutes / 60))}h late`
                        : formatTaskDate(t.dueAt)}{" "}
                    · {t.flagged ? "Flagged" : "No delay reported"}
                    {t.blockedReason ? ` · ${t.blockedReason}` : ""}
                  </span>
                </button>
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
            {["calendar", "list", "team", "proposed", "standings"].map((v) => (
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
          <div className="flex gap-2">
            <div className="w-40">
              <TaskSelect
                aria-label="Person filter"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
              >
                <option value="">Everyone</option>
                {options.data?.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </TaskSelect>
            </div>
            <div className="w-44">
              <TaskSelect
                aria-label="Gig filter"
                value={gig}
                onChange={(e) => setGig(e.target.value)}
              >
                <option value="">All gigs</option>
                {options.data?.gigs.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </TaskSelect>
            </div>
          </div>
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
        ) : null}
        {view === "calendar" ? (
          <TasksCalendar
            tasks={tasks}
            gigs={(options.data?.gigs ?? []).filter(
              (g) => !gig || g.id === gig,
            )}
            day={day}
            week={week}
            onOpen={open}
            onNew={(d) => {
              setNewDay(d);
              setDialog("new");
            }}
          />
        ) : null}
        {view === "list" ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-44">
                <TaskSelect
                  aria-label="Group list"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                >
                  <option value="status">Group by status</option>
                  <option value="person">Group by person</option>
                </TaskSelect>
              </div>
              {cellTasks ? (
                <Button variant="ghost" onClick={() => setCellTasks(null)}>
                  Clear day selection
                </Button>
              ) : null}
            </div>
            {groups.map((group) => (
              <div key={group}>
                <h2 className="mb-2 text-sm font-semibold">{group}</h2>
                <DataTable
                  data={visible.filter(
                    (t) =>
                      (groupBy === "person"
                        ? (t.assignee?.name ?? "Unassigned")
                        : taskGroup(t)) === group,
                  )}
                  columns={columns}
                  getRowId={(t) => t.id}
                  onRowClick={(t) => open(t.id)}
                  enableSearch={false}
                  enablePagination={false}
                />
              </div>
            ))}
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
        <Button variant="outline" onClick={() => setDialog("playbook")}>
          Apply playbook
        </Button>
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
                  : dialog === "playbook"
                    ? "Apply playbook"
                    : "Task settings"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "new"
                ? "One owner and an agreed due time."
                : dialog === "paste"
                  ? "Review proposals before assigning responsibility."
                  : dialog === "playbook"
                    ? "Assign the roles and create the gig’s usual tasks."
                    : "Team preferences, calendar feeds and reusable playbooks."}
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
          ) : dialog === "playbook" ? (
            <ApplyPlaybook
              gigId={gig || undefined}
              onDone={() => setDialog(null)}
            />
          ) : dialog === "settings" ? (
            <TaskSettings />
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}
