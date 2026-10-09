"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { playbookSchema } from "~/lib/tasks/input";
import { useUpload } from "~/hooks/use-upload";
import { TaskField, TaskSelect } from "./shared";
export function PasteChat() {
  const [text, setText] = useState(""),
    [images, setImages] = useState<string[]>([]);
  const utils = api.useUtils();
  const extract = api.tasks.extract.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.length} proposals ready`);
      setText("");
      setImages([]);
      void utils.tasks.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const upload = useUpload("mediaLibrary", {
    onComplete: (files) =>
      setImages((prev) =>
        [...prev, ...files.map((file) => file.id)].slice(0, 5),
      ),
    onError: (message) => toast.error(message),
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        extract.mutate({
          text:
            text.trim() || "Extract commitments from the attached screenshots.",
          imageUploadIds: images,
        });
      }}
    >
      <TaskField label="Paste chat or a brain dump">
        <Textarea
          value={text}
          maxLength={30000}
          onChange={(e) => setText(e.target.value)}
          placeholder="Who said they would do what, and by when?"
          rows={6}
        />
      </TaskField>
      <input
        aria-label="Chat screenshots"
        type="file"
        multiple
        accept={upload.accept}
        disabled={upload.isUploading || images.length >= 5}
        onChange={(e) => {
          if (e.target.files)
            void upload.upload(
              Array.from(e.target.files).slice(0, 5 - images.length),
            );
        }}
      />
      <p className="text-muted-foreground text-xs">
        Text and {images.length} screenshots will be read by AI through
        OpenRouter. Results need acceptance.
      </p>
      <Button
        disabled={
          extract.isPending ||
          upload.isUploading ||
          (!text.trim() && !images.length)
        }
      >
        {extract.isPending ? "Extracting…" : "Propose tasks"}
      </Button>
    </form>
  );
}
export function TaskSettings() {
  const options = api.tasks.options.useQuery();
  const utils = api.useUtils();
  const [feed, setFeed] = useState("");
  const settings = api.tasks.setSettings.useMutation({
    onSuccess: () => {
      void utils.tasks.options.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const calendar = api.tasks.calendarFeed.useMutation({
    onSuccess: (value) =>
      setFeed(
        `${window.location.origin}/api/tasks/calendar/${value.token}.ics`,
      ),
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {options.data ? (
          <>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.data.settings.roundsEnabled}
                disabled={settings.isPending}
                onChange={(e) =>
                  settings.mutate({
                    ...options.data.settings,
                    roundsEnabled: e.target.checked,
                  })
                }
              />
              Rounds ledger (team-wide, opt-in)
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.data.settings.nagVoice}
                disabled={settings.isPending}
                onChange={(e) =>
                  settings.mutate({
                    ...options.data.settings,
                    nagVoice: e.target.checked,
                  })
                }
              />
              Atmos reminder voice
            </label>
          </>
        ) : null}
      </div>
      <div className="space-y-3">
        <Button
          variant="outline"
          disabled={calendar.isPending}
          onClick={() => calendar.mutate()}
        >
          Get my private calendar link
        </Button>
        {feed ? (
          <>
            <Input
              readOnly
              value={feed}
              aria-label="Private calendar subscription"
              onFocus={(e) => e.target.select()}
            />
            <p className="text-muted-foreground text-xs">
              Subscribe in Apple or Google Calendar. Anyone with this link can
              read your tasks and gigs.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={calendar.isPending}
              onClick={() => calendar.mutate({ rotate: true })}
            >
              Replace link
            </Button>
          </>
        ) : null}
      </div>
      <PlaybookEditor />
    </div>
  );
}
type PlaybookItem =
  RouterOutputs["tasks"]["options"]["playbooks"][number]["items"][number];
const blankPlaybookItem = (): PlaybookItem => ({
  key: crypto.randomUUID(),
  title: "",
  role: "promo",
  offsetMinutes: -14 * 1440,
  critical: false,
  dependsOn: [],
});
export function PlaybookEditor() {
  const options = api.tasks.options.useQuery(),
    utils = api.useUtils();
  const [id, setId] = useState(""),
    [name, setName] = useState(""),
    [items, setItems] = useState<PlaybookItem[]>(() => [blankPlaybookItem()]);
  const onSuccess = () => {
    toast.success("Playbook saved");
    void utils.tasks.options.invalidate();
  };
  const onError = (e: { message: string }) => toast.error(e.message);
  const create = api.tasks.createPlaybook.useMutation({ onSuccess, onError }),
    update = api.tasks.updatePlaybook.useMutation({ onSuccess, onError }),
    remove = api.tasks.deletePlaybook.useMutation({
      onSuccess: () => {
        onSuccess();
        setId("");
        setName("");
        setItems([blankPlaybookItem()]);
      },
      onError,
    });
  const change = (key: string, fields: Partial<PlaybookItem>) =>
    setItems((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...fields } : row)),
    );
  return (
    <form
      className="space-y-3 border-t pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = playbookSchema.safeParse(items);
        if (!parsed.success) {
          toast.error(
            parsed.error.issues[0]?.message ?? "Check the playbook tasks",
          );
          return;
        }
        if (id) update.mutate({ id, name, items: parsed.data });
        else create.mutate({ name, items: parsed.data });
      }}
    >
      <h3 className="font-medium">Playbooks</h3>
      <TaskSelect
        aria-label="Edit playbook"
        value={id}
        onValueChange={(value) => {
          setId(value);
          const book = options.data?.playbooks.find((b) => b.id === value);
          setName(book?.name ?? "");
          setItems(book?.items ?? [blankPlaybookItem()]);
        }}
        options={[
          { value: "", label: "New playbook" },
          ...(options.data?.playbooks.map((book) => ({
            value: book.id,
            label: book.name,
          })) ?? []),
        ]}
      />
      <TaskField label="Name">
        <Input
          required
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
      </TaskField>
      <p className="text-muted-foreground text-xs">
        Dates count back from gig start. Assign a person to each role when
        applying the playbook.
      </p>
      {items.map((item, index) => (
        <fieldset key={item.key} className="space-y-3 rounded border p-3">
          <legend className="px-1 text-sm font-medium">Task {index + 1}</legend>
          <TaskField label="Task title">
            <Input
              required
              maxLength={200}
              value={item.title}
              onChange={(e) => change(item.key, { title: e.target.value })}
            />
          </TaskField>
          <div className="grid gap-3 sm:grid-cols-2">
            <TaskField label="Owner role">
              <Input
                required
                maxLength={80}
                placeholder="promo"
                value={item.role}
                onChange={(e) => change(item.key, { role: e.target.value })}
              />
            </TaskField>
            <TaskField label="Reviewer role (optional)">
              <Input
                maxLength={80}
                placeholder="design"
                value={item.reviewerRole ?? ""}
                onChange={(e) =>
                  change(item.key, {
                    reviewerRole: e.target.value || undefined,
                  })
                }
              />
            </TaskField>
            <TaskField label="Days before gig">
              <Input
                type="number"
                required
                min={0}
                max={365}
                step={1 / 1440}
                value={-item.offsetMinutes / 1440}
                onChange={(e) =>
                  change(item.key, {
                    offsetMinutes: -Math.round(Number(e.target.value) * 1440),
                  })
                }
              />
            </TaskField>
          </div>
          <TaskField label="Notes">
            <Textarea
              value={item.notes ?? ""}
              maxLength={20000}
              onChange={(e) => change(item.key, { notes: e.target.value })}
            />
          </TaskField>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.critical}
              onChange={(e) => change(item.key, { critical: e.target.checked })}
            />
            Critical
          </label>
          {items.length > 1 ? (
            <div className="space-y-2">
              <p className="text-sm">Waits for</p>
              {items
                .filter((parent) => parent.key !== item.key)
                .map((parent) => (
                  <label
                    key={parent.key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={item.dependsOn.includes(parent.key)}
                      onChange={(e) =>
                        change(item.key, {
                          dependsOn: e.target.checked
                            ? [...item.dependsOn, parent.key]
                            : item.dependsOn.filter(
                                (key) => key !== parent.key,
                              ),
                        })
                      }
                    />
                    {parent.title || "Untitled task"}
                  </label>
                ))}
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={items.length === 1}
            onClick={() =>
              setItems((rows) =>
                rows
                  .filter((row) => row.key !== item.key)
                  .map((row) => ({
                    ...row,
                    dependsOn: row.dependsOn.filter((key) => key !== item.key),
                  })),
              )
            }
          >
            Remove task
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={items.length >= 100}
        onClick={() => setItems((rows) => [...rows, blankPlaybookItem()])}
      >
        Add playbook task
      </Button>
      <div className="flex gap-2">
        <Button disabled={create.isPending || update.isPending}>
          Save playbook
        </Button>
        {id ? (
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm("Delete this playbook? Existing tasks stay."))
                remove.mutate({ id });
            }}
          >
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}
export function ApplyPlaybook({
  gigId,
  onDone,
}: {
  gigId?: string;
  onDone?: () => void;
}) {
  const options = api.tasks.options.useQuery(),
    utils = api.useUtils();
  const [gig, setGig] = useState(gigId ?? ""),
    [book, setBook] = useState(""),
    [roles, setRoles] = useState<Record<string, string>>({});
  const selected = options.data?.playbooks.find((b) => b.id === book);
  const names = [
    ...new Set(
      selected?.items.flatMap((item) => [
        item.role,
        ...(item.reviewerRole ? [item.reviewerRole] : []),
      ]) ?? [],
    ),
  ];
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
        apply.mutate({ gigId: gig, playbookId: book, roles });
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
                label: g.title,
              })) ?? []),
            ]}
          />
        </TaskField>
      ) : null}
      <TaskField label="Playbook">
        <TaskSelect
          required
          value={book}
          onValueChange={(value) => {
            setBook(value);
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
      {names.map((role) => (
        <TaskField key={role} label={role}>
          <TaskSelect
            required
            value={roles[role] ?? ""}
            onValueChange={(value) => setRoles({ ...roles, [role]: value })}
            options={[
              { value: "", label: "Assign role" },
              ...(options.data?.people.map((p) => ({
                value: p.id,
                label: `${p.name} · ${p.load.count} due this week`,
              })) ?? []),
            ]}
          />
        </TaskField>
      ))}
      <Button
        disabled={
          apply.isPending || !book || !gig || names.some((role) => !roles[role])
        }
      >
        {apply.isPending ? "Creating…" : "Apply playbook"}
      </Button>
    </form>
  );
}
export function TaskStandings({ onOpen }: { onOpen: (id: string) => void }) {
  const query = api.tasks.standings.useQuery();
  const rounds = api.tasks.rounds.useQuery();
  const utils = api.useUtils();
  const settle = api.tasks.settleRound.useMutation({
    onSuccess: () => {
      void utils.tasks.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  type Row = NonNullable<typeof query.data>[number];
  const columns: DataTableColumn<Row>[] = [
    { id: "name", header: "Person" },
    { id: "open", header: "Open" },
    { id: "overdue", header: "Overdue" },
    { id: "onTime", header: "On time" },
    { id: "lateFlagged", header: "Late, flagged" },
    { id: "silentMisses", header: "Silent misses" },
    { id: "rescues", header: "Rescues" },
    { id: "earlyDelays", header: "Early delays" },
    { id: "roundsOwed", header: "Rounds owed" },
  ];
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Last 90 days · Alphabetical · Completion uses the agreed date and stops
        at submission.
      </p>
      <DataTable
        data={query.data ?? []}
        columns={columns}
        getRowId={(row) => row.id}
        isLoading={query.isPending}
        enableSearch={false}
      />
      {rounds.data?.length ? (
        <section>
          <h3 className="mb-2 font-medium">Rounds ledger</h3>
          {rounds.data.map((round) => (
            <div
              key={round.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm"
            >
              <button
                type="button"
                onClick={() => onOpen(round.task.id)}
                className="text-left underline"
              >
                {round.owedBy.name} owes {round.owedTo?.name ?? "the team"} ·{" "}
                {round.task.title}
              </button>
              {round.settledAt || round.waivedAt ? (
                <span className="text-muted-foreground">
                  {round.waivedAt ? "Waived" : "Settled"}
                </span>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={settle.isPending}
                    onClick={() => settle.mutate({ id: round.id })}
                  >
                    Settle
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={settle.isPending}
                    onClick={() => {
                      const body = window.prompt("Why waive this round?");
                      if (body?.trim())
                        settle.mutate({ id: round.id, waive: true, body });
                    }}
                  >
                    Waive
                  </Button>
                </div>
              )}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
