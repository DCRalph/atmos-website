"use client";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  CalendarPlus,
  ChevronDown,
  Clock,
  Copy,
  Pin,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { useConfirm } from "~/components/confirm-provider";
import { cn } from "~/lib/utils";
import { playbookInputSchema } from "~/lib/tasks/input";
import {
  DEFAULT_PLAYBOOK_ROLES,
  moveWhen,
  playbookDueAt,
  playbookDueDates,
  playbookPlan,
  playbookRoles,
  playbookSpan,
  renameRole,
  sampleGig,
  type PlaybookRole,
  type PlaybookTask,
  type PlaybookWhen,
  type Weekday,
} from "~/lib/tasks/playbooks";
import {
  STARTER_PLAYBOOKS,
  type StarterPlaybook,
} from "~/lib/tasks/starter-playbooks";
import { dayKey } from "~/lib/tasks/time";
import { formatEventDate } from "~/lib/ticketing/dates";
import { TaskField, TaskSelect } from "./shared";
import { PlaybookTable, RunUpCalendar } from "./playbook-calendar";
import { RolesManager, TaskPanel, timeOptions } from "./playbook-fields";

type Playbook = RouterOutputs["tasks"]["options"]["playbooks"][number];
type Draft = {
  name: string;
  dueTime: string | null;
  roles: PlaybookRole[];
  tasks: PlaybookTask[];
};

const SAMPLES: { value: Weekday; label: string }[] = [
  { value: "fri", label: "A Friday gig" },
  { value: "sat", label: "A Saturday gig" },
  { value: "sun", label: "A Sunday gig" },
];

const blankTask = (
  role: string,
  when: PlaybookWhen = { kind: "days", days: -7 },
): PlaybookTask => ({
  key: crypto.randomUUID(),
  title: "",
  when,
  role,
  critical: false,
  dependsOn: [],
});

const newDraft = (): Draft => ({
  name: "",
  dueTime: "17:00",
  roles: DEFAULT_PLAYBOOK_ROLES.map((name) => ({ name, userId: null })),
  tasks: [blankTask(DEFAULT_PLAYBOOK_ROLES[0]!)],
});

const toDraft = ({ name, dueTime, roles, tasks }: Draft): Draft => ({
  name,
  dueTime,
  roles,
  tasks,
});

/** A rule with its fields in one order, so an untouched one compares equal. */
function cleanWhen(when: PlaybookWhen): PlaybookWhen {
  if (when.kind === "days")
    return when.weekdays
      ? { kind: "days", days: when.days, weekdays: true }
      : { kind: "days", days: when.days };
  if (when.kind === "weekday")
    return {
      kind: "weekday",
      day: when.day,
      side: when.side,
      weeks: when.weeks,
    };
  return { kind: "hours", hours: when.hours, from: when.from };
}

/** What gets saved: trimmed, with empty optional fields left out. */
function cleanDraft(draft: Draft) {
  return {
    name: draft.name.trim(),
    dueTime: draft.dueTime,
    roles: draft.roles.map(({ name, userId, note }) => ({
      name: name.trim(),
      userId,
      ...(note?.trim() ? { note: note.trim() } : {}),
    })),
    tasks: draft.tasks.map((task) => ({
      key: task.key,
      title: task.title.trim(),
      ...(task.notes?.trim() ? { notes: task.notes } : {}),
      when: cleanWhen(task.when),
      ...(task.time && task.when.kind !== "hours" ? { time: task.time } : {}),
      role: task.role.trim(),
      ...(task.reviewerRole?.trim()
        ? { reviewerRole: task.reviewerRole.trim() }
        : {}),
      critical: task.critical,
      dependsOn: task.dependsOn,
    })),
  };
}

const fingerprint = (draft: Draft) => JSON.stringify(cleanDraft(draft));

/** True on screens wide enough for the side panel beside the calendar, with room for its days. */
function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(min-width: 1440px)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1440px)").matches,
    () => true,
  );
}

/**
 * The Playbooks tab: one playbook at a time, laid out on a gig's run-up, with
 * the playbook's roles beside it. The team's playbooks and the starters sit
 * in the picker top left.
 */
export function PlaybooksView({
  onDirtyChange,
}: {
  /**
   * Whether the open playbook has unsaved changes. The Tasks page guards
   * leaving with one warning for everything on it, so it asks here.
   */
  onDirtyChange: (dirty: boolean) => void;
}) {
  const options = api.tasks.options.useQuery();
  const utils = api.useUtils();
  const confirm = useConfirm();
  const playbooks = options.data?.playbooks ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // Nothing picked yet opens the first playbook, so the tab is never blank.
  const current =
    selected === "new"
      ? null
      : (playbooks.find((book) => book.id === selected) ??
        (selected ? null : (playbooks[0] ?? null)));
  const editing = selected === "new" ? "new" : (current?.id ?? null);
  const starters = STARTER_PLAYBOOKS.filter(
    (starter) => !playbooks.some((book) => book.name === starter.name),
  );

  /** True when it's fine to leave the playbook being edited. */
  const canLeave = async () =>
    !dirty ||
    confirm({
      title: "Discard changes?",
      description: "This playbook has changes that haven't been saved.",
      confirmLabel: "Discard",
      variant: "destructive",
    });

  const choose = async (next: string) => {
    if (next === editing || !(await canLeave())) return;
    setDirty(false);
    setSelected(next);
  };

  const addStarter = api.tasks.createPlaybook.useMutation({
    onSuccess: async (book) => {
      await utils.tasks.options.invalidate();
      setDirty(false);
      setSelected(book.id);
      toast.success(`${book.name} added`);
    },
    onError: (error) => toast.error(error.message),
  });

  if (options.isPending) {
    return <p className="text-muted-foreground text-sm">Loading playbooks…</p>;
  }

  const list = {
    playbooks,
    starters,
    editing,
    adding: addStarter.isPending,
    onChoose: (id: string) => void choose(id),
    onAddStarter: (starter: StarterPlaybook) =>
      void canLeave().then((ok) => {
        if (ok)
          addStarter.mutate({
            name: starter.name,
            dueTime: starter.dueTime,
            roles: starter.roles,
            tasks: starter.tasks,
          });
      }),
  };

  if (!editing) {
    return (
      <div className="mx-auto max-w-md rounded-lg border">
        <h2 className="border-b px-3.5 py-3 text-sm font-semibold">
          Playbooks
        </h2>
        <PlaybookList {...list} />
      </div>
    );
  }

  return (
    <PlaybookEditor
      key={editing}
      book={current}
      picker={
        <PlaybookPicker label={current?.name ?? "New playbook"} list={list} />
      }
      onDirtyChange={setDirty}
      onSaved={(id) => {
        setDirty(false);
        setSelected(id);
      }}
      onDeleted={() => {
        setDirty(false);
        setSelected(null);
      }}
    />
  );
}

type ListProps = {
  playbooks: readonly Playbook[];
  starters: readonly StarterPlaybook[];
  editing: string | null;
  adding: boolean;
  onChoose: (id: string) => void;
  onAddStarter: (starter: StarterPlaybook) => void;
};

/** The team's playbooks, a new one, and the starters not added yet. */
function PlaybookList({
  playbooks,
  starters,
  editing,
  adding,
  onChoose,
  onAddStarter,
}: ListProps) {
  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-1.5 pt-1 pb-1">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Yours{" "}
          <span className="font-normal tracking-normal normal-case">
            {playbooks.length}
          </span>
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs"
          onClick={() => onChoose("new")}
        >
          <Plus />
          New
        </Button>
      </div>
      {playbooks.length === 0 ? (
        <p className="text-muted-foreground px-1.5 pb-2 text-sm">
          None yet. Add a starter below or make a new one.
        </p>
      ) : null}
      <ul>
        {playbooks.map((book) => (
          <li key={book.id}>
            <button
              type="button"
              aria-current={editing === book.id}
              onClick={() => onChoose(book.id)}
              className={cn(
                "hover:bg-accent/50 w-full rounded-md border border-transparent px-2.5 py-2 text-left",
                editing === book.id && "bg-muted border-white/10",
              )}
            >
              <span className="block text-sm font-medium">{book.name}</span>
              <span className="text-muted-foreground block text-xs">
                {book.tasks.length} {book.tasks.length === 1 ? "task" : "tasks"}{" "}
                · {playbookSpan(book.tasks)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {starters.length > 0 ? (
        <>
          <h3 className="text-muted-foreground mt-3 px-1.5 pb-1 text-xs font-semibold tracking-wide uppercase">
            Starters
          </h3>
          <ul>
            {starters.map((starter) => (
              <li
                key={starter.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t px-1.5 py-2 first:border-t-0"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {starter.name}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {starter.tasks.length} tasks · {starter.description}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs"
                  disabled={adding}
                  onClick={() => onAddStarter(starter)}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** The playbook being edited, as a dropdown of the rest. */
function PlaybookPicker({ label, list }: { label: string; list: ListProps }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 max-w-64 min-w-0 justify-start gap-1.5 px-2 text-sm font-semibold"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[70dvh] w-80 overflow-y-auto p-0"
      >
        <PlaybookList
          {...list}
          onChoose={(id) => {
            setOpen(false);
            list.onChoose(id);
          }}
          onAddStarter={(starter) => {
            setOpen(false);
            list.onAddStarter(starter);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * One playbook, laid out on a gig. The calendar (or table) shows every task
 * on the day it lands for the gig picked under "Dates shown for". The side
 * panel edits the picked task, or the playbook's name and roles when none is
 * picked. Changes collect until Save.
 */
function PlaybookEditor({
  book,
  picker,
  onDirtyChange,
  onSaved,
  onDeleted,
}: {
  /** Null for a new playbook. */
  book: Playbook | null;
  picker: ReactNode;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const options = api.tasks.options.useQuery();
  const utils = api.useUtils();
  const confirm = useConfirm();
  const wide = useWide();
  const [today] = useState(() => dayKey(new Date()));
  const [draft, setDraft] = useState<Draft>(() =>
    book ? toDraft(book) : newDraft(),
  );
  // The tasks as opened pick the preview gig, so it holds still while you edit.
  const [opened] = useState(draft);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "table">("calendar");
  const [preview, setPreview] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // An untouched draft follows the saved playbook, so remembering the usual
  // people while applying doesn't leave stale ones to save back. Edits in
  // progress are left alone.
  const [base, setBase] = useState(book);
  if (book !== base) {
    setBase(book);
    if (book && base && fingerprint(draft) === fingerprint(toDraft(base)))
      setDraft(toDraft(book));
  }
  const dirty = book
    ? fingerprint(draft) !== fingerprint(toDraft(book))
    : draft.name.trim() !== "" ||
      draft.tasks.some((task) => task.title.trim() !== "");
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // Dates are shown for a real upcoming gig when one is far enough out that
  // none of the playbook has passed, else a sample Saturday.
  const gigs = (options.data?.gigs ?? []).filter(
    (gig) => dayKey(gig.gigStartTime) >= today,
  );
  const roomy = gigs.find((gig) =>
    opened.tasks.every(
      (task) =>
        dayKey(playbookDueAt(task, gig.times, opened.dueTime).dueAt) >= today,
    ),
  );
  const previewKey = preview ?? roomy?.id ?? "sat";
  const sample = SAMPLES.find((option) => option.value === previewKey);
  const gig =
    gigs.find((option) => option.id === previewKey)?.times ??
    sampleGig(sample?.value ?? "sat", opened.tasks, today);

  const dates = playbookDueDates(draft, gig);
  const placed = draft.tasks
    .map((task) => {
      const { dueAt, movedFrom } = dates.get(task.key)!;
      return { task, dueAt, movedFrom, day: dayKey(dueAt) };
    })
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const selectedTask =
    draft.tasks.find((task) => task.key === selected) ?? null;

  const onError = (error: { message: string }) => toast.error(error.message);
  const saved = async (id: string) => {
    await utils.tasks.options.invalidate();
    toast.success("Playbook saved");
    onSaved(id);
  };
  const create = api.tasks.createPlaybook.useMutation({
    onSuccess: (row) => saved(row.id),
    onError,
  });
  const update = api.tasks.updatePlaybook.useMutation({
    onSuccess: (row) => saved(row.id),
    onError,
  });
  const remove = api.tasks.deletePlaybook.useMutation({
    onSuccess: async () => {
      await utils.tasks.options.invalidate();
      toast.success("Playbook deleted");
      onDeleted();
    },
    onError,
  });

  const save = () => {
    if (!draft.name.trim()) return toast.error("Name the playbook first");
    const untitled = draft.tasks.find((task) => !task.title.trim());
    const roleless = draft.tasks.find((task) => !task.role.trim());
    if (untitled ?? roleless) {
      setSelected((untitled ?? roleless)!.key);
      return toast.error(
        untitled ? "Every task needs a name" : "Every task needs an owner role",
      );
    }
    const parsed = playbookInputSchema.safeParse(cleanDraft(draft));
    if (!parsed.success)
      return toast.error(
        parsed.error.issues[0]?.message ?? "Check the playbook tasks",
      );
    if (book) update.mutate({ id: book.id, playbook: parsed.data });
    else create.mutate(parsed.data);
  };

  const change = (key: string, fields: Partial<PlaybookTask>) =>
    setDraft((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.key === key ? { ...task, ...fields } : task,
      ),
    }));
  const addTask = (day?: string) => {
    const task = blankTask(
      draft.roles[0]?.name ?? "",
      day
        ? moveWhen({ when: { kind: "days", days: 0 } }, day, gig, draft.dueTime)
        : undefined,
    );
    setDraft((current) => ({ ...current, tasks: [...current.tasks, task] }));
    setSelected(task.key);
  };
  const removeTask = (key: string) => {
    setDraft((current) => ({
      ...current,
      tasks: current.tasks
        .filter((task) => task.key !== key)
        .map((task) => ({
          ...task,
          dependsOn: task.dependsOn.filter((dep) => dep !== key),
        })),
    }));
    setSelected((current) => (current === key ? null : current));
  };
  const moveTask = (key: string, day: string) => {
    const task = draft.tasks.find((row) => row.key === key);
    if (task) change(key, { when: moveWhen(task, day, gig, draft.dueTime) });
  };
  const addRole = (name: string) =>
    setDraft((current) =>
      current.roles.some((role) => role.name === name)
        ? current
        : { ...current, roles: [...current.roles, { name, userId: null }] },
    );

  const pending = create.isPending || update.isPending;
  // The table edits tasks in their rows, so a task only opens from the calendar.
  const panel =
    selectedTask && view === "calendar" ? (
      <TaskPanel
        task={selectedTask}
        others={placed
          .map((row) => row.task)
          .filter((task) => task.key !== selectedTask.key)}
        roles={draft.roles}
        gig={gig}
        dueTime={draft.dueTime}
        canRemove={draft.tasks.length > 1}
        onChange={(fields) => change(selectedTask.key, fields)}
        onAddRole={addRole}
        onRemove={() => removeTask(selectedTask.key)}
      />
    ) : null;
  const panelTitle = selectedTask?.title.trim()
    ? selectedTask.title
    : "New task";

  return (
    // The table edits every task in its row and needs the width, so the
    // panel only sits beside the calendar.
    <div
      className={cn(
        "grid gap-3",
        view === "calendar" &&
          "min-[1440px]:grid-cols-[minmax(0,1fr)_24rem] min-[1440px]:items-start",
      )}
    >
      <section className="min-w-0 rounded-lg border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {picker}
            <span className="text-muted-foreground shrink-0 text-sm">
              {draft.tasks.length} {draft.tasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Tabs
              value={view}
              onValueChange={(next) =>
                setView(next === "table" ? "table" : "calendar")
              }
            >
              <TabsList aria-label="Playbook view" className="h-8">
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
                <TabsTrigger value="table">Table</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              disabled={draft.tasks.length >= 100}
              onClick={() => addTask()}
            >
              <Plus />
              Add task
            </Button>
            {book ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={dirty || create.isPending}
                  title={dirty ? "Save first" : undefined}
                  onClick={() =>
                    create.mutate({
                      ...cleanDraft(toDraft(book)),
                      name: `${book.name} copy`,
                    })
                  }
                >
                  <Copy />
                  Duplicate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={remove.isPending}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Delete this playbook?",
                        description:
                          "Tasks already made from it stay where they are.",
                        confirmLabel: "Delete",
                        variant: "destructive",
                      })
                    )
                      remove.mutate({ id: book.id });
                  }}
                >
                  <Trash2 />
                  Delete
                </Button>
                <Button
                  size="sm"
                  disabled={dirty}
                  title={dirty ? "Save first" : undefined}
                  onClick={() => setApplying(true)}
                >
                  <CalendarPlus />
                  Apply to a gig
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b px-3.5 py-2 text-sm">
          <span className="text-muted-foreground">Due at</span>
          <div className="w-36">
            <TaskSelect
              aria-label="When tasks are due"
              value={draft.dueTime ?? ""}
              onValueChange={(time) =>
                setDraft((current) => ({ ...current, dueTime: time || null }))
              }
              options={[
                { value: "", label: "Gig start time" },
                ...timeOptions(draft.dueTime),
              ]}
            />
          </div>
          <span className="text-muted-foreground">
            unless a task says otherwise
          </span>
          <span className="bg-border mx-1 hidden h-5 w-px md:block" />
          <span className="text-muted-foreground">Dates shown for</span>
          <div className="w-72 max-w-full">
            <TaskSelect
              aria-label="Gig to show dates for"
              value={previewKey}
              onValueChange={setPreview}
              options={[
                ...gigs.map((option) => ({
                  value: option.id,
                  label: `${option.title} · ${formatEventDate(option.gigStartTime)}`,
                })),
                ...SAMPLES,
              ]}
            />
          </div>
        </div>
        <div className="p-3.5">
          {view === "calendar" ? (
            <>
              <RunUpCalendar
                placed={placed}
                gig={gig}
                today={today}
                selected={selected}
                highlight={highlight}
                onSelect={setSelected}
                onMove={moveTask}
                onAdd={addTask}
              />
              <p className="text-muted-foreground mt-2 hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs md:flex">
                <span className="inline-flex items-center gap-1">
                  <Pin className="size-3" />
                  on a weekday
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  hours from doors or close
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-[3px] rounded-full bg-amber-400" />
                  critical
                </span>
                <span>
                  Drag a task to another day. It keeps its kind of rule.
                </span>
              </p>
            </>
          ) : (
            <PlaybookTable
              placed={placed}
              roles={draft.roles}
              gig={gig}
              dueTime={draft.dueTime}
              highlight={highlight}
              onChange={change}
              onRemove={removeTask}
              onAddRole={addRole}
            />
          )}
        </div>

        {dirty || !book ? (
          <div className="bg-background/95 sticky bottom-0 flex flex-wrap items-center justify-between gap-2 rounded-b-lg border-t px-3.5 py-2.5 backdrop-blur-sm">
            <span className="text-muted-foreground text-sm">
              {book ? "Unsaved changes" : "New playbook, not saved yet"}
            </span>
            <div className="flex gap-2">
              {book ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDraft(toDraft(book))}
                >
                  Discard
                </Button>
              ) : null}
              <Button size="sm" disabled={pending} onClick={save}>
                {pending ? "Saving…" : "Save playbook"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <aside
        className={cn(
          "min-w-0 rounded-lg border",
          view === "calendar" &&
            "min-[1440px]:sticky min-[1440px]:top-20 min-[1440px]:max-h-[calc(100dvh-6rem)] min-[1440px]:overflow-y-auto",
        )}
      >
        <div className="flex min-h-11 items-center justify-between gap-2 border-b px-3.5 py-1.5">
          <h2 className="truncate text-sm font-semibold">
            {wide && panel ? panelTitle : "Playbook"}
          </h2>
          {wide && panel ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close task"
              onClick={() => setSelected(null)}
            >
              <X />
            </Button>
          ) : null}
        </div>
        <div className="p-3.5">
          {wide && panel ? (
            panel
          ) : (
            <div className="space-y-4">
              <TaskField label="Name">
                <Input
                  placeholder="Name this playbook"
                  maxLength={100}
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </TaskField>
              <div>
                <h3 className="text-sm font-medium">Roles</h3>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Tasks belong to roles. Applying the playbook asks who fills
                  each one, starting with who usually does.
                </p>
                <RolesManager
                  roles={draft.roles}
                  tasks={draft.tasks}
                  people={options.data?.people ?? []}
                  highlight={highlight}
                  onHighlight={setHighlight}
                  onRename={(from, to) => {
                    setDraft((current) => ({
                      ...current,
                      ...renameRole(current, from, to),
                    }));
                    setHighlight((role) => (role === from ? to : role));
                  }}
                  onChange={(name, fields) =>
                    setDraft((current) => ({
                      ...current,
                      roles: current.roles.map((role) =>
                        role.name === name ? { ...role, ...fields } : role,
                      ),
                    }))
                  }
                  onAdd={addRole}
                  onRemove={(name) =>
                    setDraft((current) => ({
                      ...current,
                      roles: current.roles.filter((role) => role.name !== name),
                    }))
                  }
                />
              </div>
            </div>
          )}
        </div>
      </aside>

      {!wide ? (
        <Sheet
          open={!!panel}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{panelTitle}</SheetTitle>
              <SheetDescription className="sr-only">
                Edit this playbook task
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">{panel}</div>
          </SheetContent>
        </Sheet>
      ) : null}

      {book ? (
        <Dialog open={applying} onOpenChange={setApplying}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Apply {book.name}</DialogTitle>
              <DialogDescription>
                Makes {book.tasks.length} tasks for the gig, dated from it.
              </DialogDescription>
            </DialogHeader>
            {applying ? (
              <ApplyPlaybook
                playbookId={book.id}
                onDone={() => setApplying(false)}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

/**
 * Turns a playbook into tasks for a gig. Pick the gig and who fills each role
 * (starting with who usually does), and every task is listed with its real
 * date before anything is made, with the ones already past their date called
 * out.
 */
export function ApplyPlaybook({
  gigId,
  playbookId,
  onDone,
}: {
  /** Fixed when applying from a gig's Tasks tab. */
  gigId?: string;
  /** Fixed when applying from the playbook itself. */
  playbookId?: string;
  onDone?: () => void;
}) {
  const options = api.tasks.options.useQuery(),
    utils = api.useUtils();
  const [gig, setGig] = useState(gigId ?? ""),
    [bookId, setBookId] = useState(playbookId ?? ""),
    [picked, setPicked] = useState<Record<string, string>>({}),
    [remember, setRemember] = useState(false);
  const [now] = useState(() => Date.now());
  const people = options.data?.people ?? [];
  const book = options.data?.playbooks.find((b) => b.id === bookId);
  const gigRow = options.data?.gigs.find((g) => g.id === gig);
  const used = book ? playbookRoles(book.tasks) : [];
  // The playbook's own order, then anything a task uses that it doesn't list.
  const roles = book
    ? [
        ...book.roles.filter((role) => used.includes(role.name)),
        ...used
          .filter((name) => !book.roles.some((role) => role.name === name))
          .map((name) => ({ name, userId: null, note: undefined })),
      ]
    : [];
  const usual = (role: PlaybookRole) =>
    role.userId && people.some((person) => person.id === role.userId)
      ? role.userId
      : "";
  const picks = Object.fromEntries(
    roles.map((role) => [role.name, picked[role.name] ?? usual(role)]),
  );
  const changed = roles.some(
    (role) => picks[role.name] && picks[role.name] !== usual(role),
  );
  const nameOf = (id: string | undefined) =>
    people.find((person) => person.id === id)?.name;
  const preview =
    book && gigRow ? playbookPlan(book, gigRow.times, new Date(now)) : [];
  const late = preview.filter(({ dueAt }) => dueAt.getTime() < now).length;
  const pushed = preview.filter(
    ({ dueAt, projectedAt }) => projectedAt.getTime() > dueAt.getTime(),
  ).length;

  const apply = api.tasks.applyPlaybook.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.length} tasks created`);
      void utils.tasks.invalidate();
      onDone?.();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        apply.mutate({
          gigId: gig,
          playbookId: bookId,
          roles: picks,
          remember: changed && remember,
        });
      }}
    >
      {!gigId ? (
        <TaskField label="Gig">
          <TaskSelect
            required
            value={gig}
            onValueChange={setGig}
            options={[
              { value: "", label: "Choose gig" },
              ...(options.data?.gigs.map((g) => ({
                value: g.id,
                label: `${g.title} · ${formatEventDate(g.gigStartTime)}`,
              })) ?? []),
            ]}
          />
        </TaskField>
      ) : null}
      {!playbookId ? (
        <TaskField label="Playbook">
          <TaskSelect
            required
            value={bookId}
            onValueChange={(value) => {
              setBookId(value);
              setPicked({});
            }}
            options={[
              { value: "", label: "Choose playbook" },
              ...(options.data?.playbooks.map((b) => ({
                value: b.id,
                label: `${b.name} · ${b.tasks.length} tasks`,
              })) ?? []),
            ]}
          />
        </TaskField>
      ) : null}
      {roles.length > 0 ? (
        <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
          {roles.map((role) => (
            <label key={role.name} className="contents text-sm">
              <span className="min-w-0">
                <span className="block truncate">{role.name}</span>
                {role.note ? (
                  <span className="text-muted-foreground block truncate text-xs">
                    {role.note}
                  </span>
                ) : null}
              </span>
              <TaskSelect
                required
                aria-label={`Who is ${role.name}`}
                value={picks[role.name] ?? ""}
                onValueChange={(value) =>
                  setPicked({ ...picked, [role.name]: value })
                }
                options={[
                  { value: "", label: "Choose someone" },
                  ...people.map((p) => ({
                    value: p.id,
                    label: `${p.name}${p.id === usual(role) ? " · usually" : ""} · ${p.load.count} due this week`,
                  })),
                ]}
              />
            </label>
          ))}
          {changed ? (
            <label className="col-start-2 flex items-center gap-2 text-sm">
              <Checkbox
                checked={remember}
                onCheckedChange={(checked) => setRemember(!!checked)}
              />
              Make these the usual people for {book?.name}
            </label>
          ) : null}
        </div>
      ) : null}
      {preview.length > 0 ? (
        <div className="border-t pt-3">
          {late > 0 ? (
            <p className="mb-2 text-sm text-amber-400">
              {late === 1
                ? "1 task is already past its date and will start late."
                : `${late} tasks are already past their date and will start late.`}
              {pushed > 0
                ? ` ${pushed} ${pushed === 1 ? "task moves" : "tasks move"} later to wait on what's late.`
                : null}
            </p>
          ) : null}
          <ul className="max-h-72 overflow-y-auto pr-1">
            {preview.map(({ item, dueAt, projectedAt, atRisk }) => (
              <li
                key={item.key}
                className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] gap-2 py-1 text-sm"
              >
                <time
                  className={cn(
                    "tabular-nums",
                    dueAt.getTime() < now
                      ? "text-amber-400"
                      : "text-muted-foreground",
                  )}
                >
                  {formatEventDate(dueAt)}
                </time>
                <span className="min-w-0">
                  <span className="block truncate">{item.title}</span>
                  {atRisk || projectedAt.getTime() > dueAt.getTime() ? (
                    <span
                      className={cn(
                        "block text-xs",
                        atRisk ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {atRisk
                        ? "At risk: what it waits for runs past the gig"
                        : `Moves to ${formatEventDate(projectedAt)}, waiting on what's late`}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground text-xs leading-5">
                  {nameOf(picks[item.role]) ?? item.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button
          disabled={
            apply.isPending ||
            !bookId ||
            !gig ||
            roles.some((role) => !picks[role.name])
          }
        >
          {apply.isPending
            ? "Creating…"
            : book
              ? `Create ${book.tasks.length} tasks`
              : "Apply playbook"}
        </Button>
      </div>
    </form>
  );
}
