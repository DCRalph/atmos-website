"use client";
import { useEffect, useId, useState } from "react";
import {
  CalendarPlus,
  Copy,
  NotebookPen,
  Plus,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
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
import { useConfirm } from "~/components/confirm-provider";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import { cn } from "~/lib/utils";
import { playbookSchema } from "~/lib/tasks/input";
import {
  DEFAULT_PLAYBOOK_ROLES,
  formatOffset,
  playbookPhase,
  playbookPlan,
  playbookRoles,
  playbookSpan,
} from "~/lib/tasks/playbooks";
import { STARTER_PLAYBOOKS } from "~/lib/tasks/starter-playbooks";
import { formatEventDate } from "~/lib/ticketing/dates";
import { TaskField, TaskSelect } from "./shared";

type Playbook = RouterOutputs["tasks"]["options"]["playbooks"][number];
type Item = Playbook["items"][number];

const DAY = 1440;
/** The furthest the editor lets a task sit from the gig, as the schema does. */
const MIN_OFFSET = -365 * DAY;
const MAX_OFFSET = 30 * DAY;

const blankItem = (offsetMinutes = -7 * DAY): Item => ({
  key: crypto.randomUUID(),
  title: "",
  role: "",
  offsetMinutes,
  critical: false,
  dependsOn: [],
});

const byOffset = (a: Item, b: Item) => a.offsetMinutes - b.offsetMinutes;

/** The table's columns on desktop, shared by the header and every row. */
const COLUMNS = "lg:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem_10rem_auto]";

/** Empty optional fields go to the server as absent, not as "". */
const cleanItems = (items: Item[]) =>
  items.map(({ notes, reviewerRole, ...item }) => ({
    ...item,
    title: item.title.trim(),
    role: item.role.trim(),
    ...(notes?.trim() ? { notes } : {}),
    ...(reviewerRole?.trim() ? { reviewerRole: reviewerRole.trim() } : {}),
  }));

/** A comparable form of a playbook, whatever order its keys arrived in. */
const fingerprint = (name: string, items: Item[]) =>
  JSON.stringify([
    name.trim(),
    cleanItems(items).map((item) => [
      item.key,
      item.title,
      item.offsetMinutes,
      item.role,
      item.reviewerRole ?? "",
      item.notes ?? "",
      item.critical,
      item.dependsOn,
    ]),
  ]);

/**
 * The Playbooks tab: the team's playbooks and the starters beside them, and
 * the selected one open in the editor.
 */
export function PlaybooksView() {
  const options = api.tasks.options.useQuery();
  const utils = api.useUtils();
  const confirm = useConfirm();
  const playbooks = options.data?.playbooks ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

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

  return (
    <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
      <aside className="rounded-lg border lg:sticky lg:top-20">
        <div className="flex min-h-11 items-center justify-between gap-2 border-b px-3.5 py-1.5">
          <h2 className="text-sm font-semibold">Playbooks</h2>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            onClick={() => void choose("new")}
          >
            <Plus />
            New
          </Button>
        </div>
        <div className="p-2">
          <h3 className="text-muted-foreground px-1.5 pt-1 pb-1 text-xs font-semibold tracking-wide uppercase">
            Yours{" "}
            <span className="font-normal tracking-normal normal-case">
              {playbooks.length}
            </span>
          </h3>
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
                  onClick={() => void choose(book.id)}
                  className={cn(
                    "hover:bg-accent/50 w-full rounded-md border border-transparent px-2.5 py-2 text-left",
                    editing === book.id && "bg-muted border-white/10",
                  )}
                >
                  <span className="block text-sm font-medium">{book.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {book.items.length}{" "}
                    {book.items.length === 1 ? "task" : "tasks"} ·{" "}
                    {playbookSpan(book.items)}
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
                        {starter.items.length} tasks · {starter.description}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs"
                      disabled={addStarter.isPending}
                      onClick={async () => {
                        if (await canLeave())
                          addStarter.mutate({
                            name: starter.name,
                            items: starter.items,
                          });
                      }}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </aside>

      {editing ? (
        <PlaybookEditor
          key={editing}
          book={current}
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
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          Add a starter or make a new playbook to get going.
        </div>
      )}
    </div>
  );
}

/**
 * One playbook as a table: every field of every task in its row, grouped by
 * how far out it is. Changes collect until Save.
 */
function PlaybookEditor({
  book,
  onDirtyChange,
  onSaved,
  onDeleted,
}: {
  /** Null for a new playbook. */
  book: Playbook | null;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const utils = api.useUtils();
  const confirm = useConfirm();
  const roleList = useId();
  const [name, setName] = useState(book?.name ?? "");
  const [items, setItems] = useState<Item[]>(
    () => book?.items ?? [blankItem()],
  );
  const [openNotes, setOpenNotes] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const dirty = book
    ? fingerprint(name, items) !== fingerprint(book.name, book.items)
    : name.trim() !== "" || items.some((item) => item.title.trim() !== "");
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useUnsavedChangesWarning({ enabled: dirty });

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
    if (!name.trim()) return toast.error("Name the playbook first");
    const parsed = playbookSchema.safeParse(cleanItems(items));
    if (!parsed.success) {
      return toast.error(
        parsed.error.issues[0]?.message ?? "Check the playbook tasks",
      );
    }
    if (book)
      update.mutate({ id: book.id, name: name.trim(), items: parsed.data });
    else create.mutate({ name: name.trim(), items: parsed.data });
  };

  const change = (key: string, fields: Partial<Item>) =>
    setItems((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...fields } : row)),
    );
  const removeItem = (key: string) =>
    setItems((rows) =>
      rows
        .filter((row) => row.key !== key)
        .map((row) => ({
          ...row,
          dependsOn: row.dependsOn.filter((dep) => dep !== key),
        })),
    );

  const sorted = [...items].sort(byOffset);
  const phases = sorted.reduce<{ phase: string; items: Item[] }[]>(
    (groups, item) => {
      const phase = playbookPhase(item.offsetMinutes);
      const last = groups.at(-1);
      if (last?.phase === phase) last.items.push(item);
      else groups.push({ phase, items: [item] });
      return groups;
    },
    [],
  );
  const roles = playbookRoles(items);
  const suggestions = [...new Set([...DEFAULT_PLAYBOOK_ROLES, ...roles])];
  const pending = create.isPending || update.isPending;

  return (
    <section className="min-w-0 rounded-lg border">
      <div className="space-y-1.5 border-b px-3.5 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Input
            aria-label="Playbook name"
            placeholder="Name this playbook"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 min-w-0 flex-1 basis-64 text-lg font-semibold"
          />
          {book ? (
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={dirty || create.isPending}
                title={dirty ? "Save first" : undefined}
                onClick={() =>
                  create.mutate({
                    name: `${book.name} copy`,
                    items: book.items,
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
            </div>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-medium">
            {items.length} {items.length === 1 ? "task" : "tasks"}
          </span>{" "}
          · {playbookSpan(items)}
          {roles.length > 0 ? (
            <>
              {" "}
              · roles{" "}
              <span className="text-foreground">{roles.join(", ")}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="px-3.5 pb-3">
        <div
          className={cn(
            "text-muted-foreground hidden gap-1.5 pt-3 text-[11px] tracking-wide uppercase lg:grid",
            COLUMNS,
          )}
        >
          <span title="Days from the gig. -30 is 30 days before, 2 is 2 days after.">
            Day
          </span>
          <span>Task</span>
          <span>Owner</span>
          <span>Reviewer</span>
          <span>Waits for</span>
          <span className="w-[6.25rem]" />
        </div>
        {phases.map(({ phase, items: inPhase }) => (
          <div key={phase}>
            <h3 className="text-muted-foreground mt-4 mb-1 flex justify-between text-xs font-semibold tracking-wide uppercase">
              {phase}
              <span className="font-normal tracking-normal normal-case">
                {inPhase.length}
              </span>
            </h3>
            <ul>
              {inPhase.map((item) => (
                <PlaybookRow
                  key={item.key}
                  item={item}
                  others={sorted.filter((other) => other.key !== item.key)}
                  roleList={roleList}
                  notesOpen={openNotes === item.key}
                  onToggleNotes={() =>
                    setOpenNotes((key) => (key === item.key ? null : item.key))
                  }
                  canRemove={items.length > 1}
                  onChange={(fields) => change(item.key, fields)}
                  onRemove={() => removeItem(item.key)}
                />
              ))}
            </ul>
          </div>
        ))}
        <datalist id={roleList}>
          {suggestions.map((role) => (
            <option key={role} value={role} />
          ))}
        </datalist>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={items.length >= 100}
          onClick={() => {
            const item = blankItem(sorted.at(-1)?.offsetMinutes);
            setItems((rows) => [...rows, item]);
          }}
        >
          <Plus />
          Add task
        </Button>
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
                onClick={() => {
                  setName(book.name);
                  setItems(book.items);
                }}
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

      {book ? (
        <Dialog open={applying} onOpenChange={setApplying}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Apply {book.name}</DialogTitle>
              <DialogDescription>
                Makes {book.items.length} tasks for the gig, due back from its
                start.
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
    </section>
  );
}

/**
 * One task of a playbook. On a phone it wraps: day and title, then owner and
 * reviewer, then what it waits for beside the toggles.
 */
function PlaybookRow({
  item,
  others,
  roleList,
  notesOpen,
  onToggleNotes,
  canRemove,
  onChange,
  onRemove,
}: {
  item: Item;
  others: Item[];
  roleList: string;
  notesOpen: boolean;
  onToggleNotes: () => void;
  canRemove: boolean;
  onChange: (fields: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const label = item.title.trim() || "Untitled task";
  const waits = others.filter((other) => item.dependsOn.includes(other.key));
  return (
    <li className="border-t py-1.5 first:border-t-0">
      <div
        className={cn(
          "grid grid-cols-[3.75rem_minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5",
          COLUMNS,
        )}
      >
        <DayInput
          key={item.offsetMinutes}
          value={item.offsetMinutes}
          label={label}
          onCommit={(offsetMinutes) => onChange({ offsetMinutes })}
        />
        <Input
          aria-label="Task"
          placeholder="What needs doing"
          maxLength={200}
          value={item.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="col-span-3 h-8 lg:col-span-1"
        />
        <Input
          aria-label={`Owner role for ${label}`}
          placeholder="Owner"
          list={roleList}
          maxLength={80}
          value={item.role}
          onChange={(event) => onChange({ role: event.target.value })}
          className="col-span-2 h-8 lg:col-span-1"
        />
        <Input
          aria-label={`Reviewer role for ${label}`}
          placeholder="No review"
          list={roleList}
          maxLength={80}
          value={item.reviewerRole ?? ""}
          onChange={(event) => onChange({ reviewerRole: event.target.value })}
          className="col-span-2 h-8 lg:col-span-1"
        />
        <div className="col-span-3 lg:col-span-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label={`What ${label} waits for`}
                className={cn(
                  "h-8 w-full justify-start truncate px-2.5 font-normal",
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
                    checked={item.dependsOn.includes(other.key)}
                    onCheckedChange={(checked) =>
                      onChange({
                        dependsOn: checked
                          ? [...item.dependsOn, other.key]
                          : item.dependsOn.filter((key) => key !== other.key),
                      })
                    }
                  />
                  <span className="min-w-0">
                    <span className="block">
                      {other.title || "Untitled task"}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {formatOffset(other.offsetMinutes)}
                    </span>
                  </span>
                </label>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Notes for ${label}`}
            aria-expanded={notesOpen}
            onClick={onToggleNotes}
            className={cn(
              "relative",
              (notesOpen || item.notes) && "text-foreground",
              !notesOpen && !item.notes && "text-muted-foreground",
            )}
          >
            <NotebookPen />
            {item.notes ? (
              <span className="bg-admin-accent absolute top-1.5 right-1.5 size-1.5 rounded-full" />
            ) : null}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Critical: ${label}`}
            aria-pressed={item.critical}
            title="Critical tasks escalate sooner when late"
            onClick={() => onChange({ critical: !item.critical })}
            className={cn(
              item.critical
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
            disabled={!canRemove}
            onClick={onRemove}
            className="text-muted-foreground"
          >
            <X />
          </Button>
        </div>
      </div>
      {notesOpen ? (
        <Textarea
          aria-label={`Notes for ${label}`}
          placeholder="Anything whoever gets this task should know"
          maxLength={20000}
          value={item.notes ?? ""}
          onChange={(event) => onChange({ notes: event.target.value })}
          className="mt-1.5 min-h-16 text-sm"
        />
      ) : null}
    </li>
  );
}

/**
 * Days from the gig, signed: -30 is a month before, 2 is two days after.
 * Committed on blur rather than per keystroke, so the row doesn't jump to
 * its new place in the list while it's being typed.
 */
function DayInput({
  value,
  label,
  onCommit,
}: {
  value: number;
  label: string;
  onCommit: (offsetMinutes: number) => void;
}) {
  const days = Number((value / DAY).toFixed(2));
  const [text, setText] = useState(days > 0 ? `+${days}` : String(days));
  const commit = () => {
    const parsed = Number(text.trim());
    if (!text.trim() || !Number.isFinite(parsed)) {
      setText(days > 0 ? `+${days}` : String(days));
      return;
    }
    const minutes = Math.min(
      MAX_OFFSET,
      Math.max(MIN_OFFSET, Math.round(parsed * DAY)),
    );
    if (minutes === value) setText(days > 0 ? `+${days}` : String(days));
    else onCommit(minutes);
  };
  return (
    <Input
      aria-label={`Days from the gig for ${label}`}
      title={formatOffset(value)}
      inputMode="decimal"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="h-8 px-2 text-right tabular-nums"
    />
  );
}

/**
 * Turns a playbook into tasks for a gig. Pick the gig and who fills each role,
 * and every task is listed with its real date before anything is made, with
 * the ones already past their date called out.
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
    [roles, setRoles] = useState<Record<string, string>>({});
  const [now] = useState(() => Date.now());
  const book = options.data?.playbooks.find((b) => b.id === bookId);
  const gigRow = options.data?.gigs.find((g) => g.id === gig);
  const names = book ? playbookRoles(book.items) : [];
  const nameOf = (id: string | undefined) =>
    options.data?.people.find((person) => person.id === id)?.name;
  const preview =
    book && gigRow
      ? playbookPlan(book.items, gigRow.gigStartTime, new Date(now))
      : [];
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
        apply.mutate({ gigId: gig, playbookId: bookId, roles });
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
              setRoles({});
            }}
            options={[
              { value: "", label: "Choose playbook" },
              ...(options.data?.playbooks.map((b) => ({
                value: b.id,
                label: `${b.name} · ${b.items.length} tasks`,
              })) ?? []),
            ]}
          />
        </TaskField>
      ) : null}
      {names.length > 0 ? (
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
          {names.map((role) => (
            <label key={role} className="contents text-sm">
              <span className="truncate">{role}</span>
              <TaskSelect
                required
                aria-label={`Who is ${role}`}
                value={roles[role] ?? ""}
                onValueChange={(value) => setRoles({ ...roles, [role]: value })}
                options={[
                  { value: "", label: "Choose someone" },
                  ...(options.data?.people.map((p) => ({
                    value: p.id,
                    label: `${p.name} · ${p.load.count} due this week`,
                  })) ?? []),
                ]}
              />
            </label>
          ))}
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
                  {projectedAt.getTime() > dueAt.getTime() ? (
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
                  {nameOf(roles[item.role]) ?? item.role}
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
            names.some((role) => !roles[role])
          }
        >
          {apply.isPending
            ? "Creating…"
            : book
              ? `Create ${book.items.length} tasks`
              : "Apply playbook"}
        </Button>
      </div>
    </form>
  );
}
