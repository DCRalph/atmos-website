"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { automationSchema } from "~/lib/tasks/input";
import { formatTaskDate } from "~/lib/tasks/time";
import { TaskDatePicker, TaskField, TaskSelect, type TaskRow } from "./shared";
export function TaskImpact({ id, dueAt }: { id: string; dueAt: Date }) {
  const query = api.tasks.impact.useQuery({ id, dueAt });
  if (query.error)
    return <p className="text-destructive text-sm">{query.error.message}</p>;
  return (
    <div className="rounded border p-3 text-sm" aria-live="polite">
      {query.isPending ? (
        "Checking downstream tasks…"
      ) : query.data?.length ? (
        <>
          <p className="mb-2 font-medium">{query.data.length} tasks affected</p>
          {query.data.map((change) => (
            <p key={change.taskId}>
              {change.title} · {formatTaskDate(change.projectedDueAt)}
              {change.atRisk ? " · Hard deadline at risk" : ""}
            </p>
          ))}
        </>
      ) : (
        "No downstream dates move."
      )}
    </div>
  );
}
export function TaskForm({
  task,
  due,
  gigId,
  onSaved,
}: {
  task?: TaskRow;
  due?: Date;
  gigId?: string;
  onSaved: (id: string) => void;
}) {
  const options = api.tasks.options.useQuery();
  const utils = api.useUtils();
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [owner, setOwner] = useState(
    task?.assigneeId ?? options.data?.userId ?? "",
  );
  const [reviewer, setReviewer] = useState(task?.reviewerId ?? "");
  const [gig, setGig] = useState(task?.gigId ?? gigId ?? "");
  const [date, setDate] = useState(
    () => task?.dueAt ?? due ?? new Date(Date.now() + 86400_000),
  );
  const [hard, setHard] = useState<Date | undefined>(
    task?.hardDeadlineAt ?? undefined,
  );
  const [critical, setCritical] = useState(task?.critical ?? false);
  const [proof, setProof] = useState(task?.proofRequired ?? false);
  const originalAutomation = automationSchema.safeParse(task?.automation);
  const [automation, setAutomation] = useState(
    originalAutomation.success ? originalAutomation.data.kind : "",
  );
  const [sales, setSales] = useState(
    originalAutomation.success &&
      originalAutomation.data.kind === "TICKETS_SOLD"
      ? originalAutomation.data.count
      : 100,
  );
  const success = (result: { id: string }) => {
    void utils.tasks.invalidate();
    toast.success(task ? "Task saved" : "Task created");
    onSaved(result.id);
  };
  const onError = (error: { message: string }) => toast.error(error.message);
  const create = api.tasks.create.useMutation({ onSuccess: success, onError });
  const update = api.tasks.update.useMutation({ onSuccess: success, onError });
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!date) return;
        const parsed = automationSchema.safeParse(
          automation
            ? {
                kind: automation,
                ...(automation === "TICKETS_SOLD" ? { count: sales } : {}),
              }
            : null,
        );
        if (automation && !parsed.success) {
          toast.error("Choose a valid ticket sales target");
          return;
        }
        const data = {
          title,
          notes: notes || null,
          assigneeId: owner || null,
          reviewerId: reviewer || null,
          gigId: gig || null,
          dueAt: date,
          hardDeadlineAt: hard ?? (task ? null : undefined),
          critical,
          proofRequired: proof,
          automation: parsed.success ? parsed.data : null,
        };
        if (task) update.mutate({ id: task.id, ...data });
        else create.mutate(data);
      }}
    >
      <TaskField label="Title">
        <Input
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </TaskField>
      <TaskField label="Notes">
        <Textarea
          value={notes}
          maxLength={20000}
          onChange={(e) => setNotes(e.target.value)}
        />
      </TaskField>
      <div className="grid gap-4 sm:grid-cols-2">
        <TaskField label="Owner">
          <TaskSelect value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Unassigned</option>
            {options.data?.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.load.count} due this week ·{" "}
                {p._count.deviceTokens} devices
              </option>
            ))}
          </TaskSelect>
        </TaskField>
        <TaskField label="Reviewer">
          <TaskSelect
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
          >
            <option value="">No sign-off</option>
            {options.data?.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </TaskSelect>
        </TaskField>
      </div>
      <TaskField label="Gig">
        <TaskSelect
          value={gig}
          onChange={(e) => {
            setGig(e.target.value);
            const selected = options.data?.gigs.find(
              (g) => g.id === e.target.value,
            );
            if (selected) setHard(selected.gigStartTime);
          }}
        >
          <option value="">No gig</option>
          {options.data?.gigs.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </TaskSelect>
      </TaskField>
      <TaskField label="Due · Auckland time">
        <TaskDatePicker
          date={date}
          onChange={(d) => {
            if (d) setDate(d);
          }}
        />
      </TaskField>
      <TaskField label="Hard deadline · Auckland time">
        <TaskDatePicker date={hard} onChange={setHard} clearable />
      </TaskField>
      {task && date.getTime() !== task.dueAt.getTime() ? (
        <TaskImpact id={task.id} dueAt={date} />
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={critical}
          onChange={(e) => setCritical(e.target.checked)}
        />
        Critical · faster escalation
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={proof}
          onChange={(e) => setProof(e.target.checked)}
        />
        Photo required before finishing
      </label>
      <TaskField label="Complete automatically">
        <TaskSelect
          value={automation}
          disabled={!gig || proof}
          onChange={(e) => setAutomation(e.target.value)}
        >
          <option value="">Manual completion</option>
          <option value="POSTER">Gig poster uploaded</option>
          <option value="TICKETS_PUBLISHED">Tickets published</option>
          <option value="TICKETS_SOLD">Ticket sales target</option>
        </TaskSelect>
      </TaskField>
      {automation === "TICKETS_SOLD" ? (
        <TaskField label="Tickets sold">
          <Input
            type="number"
            min={1}
            max={1000000}
            value={sales}
            onChange={(e) => setSales(Number(e.target.value))}
          />
        </TaskField>
      ) : null}
      <Button
        type="submit"
        disabled={
          create.isPending || update.isPending || !title.trim() || !owner
        }
      >
        {create.isPending || update.isPending
          ? "Saving…"
          : task
            ? "Save changes"
            : "Create task"}
      </Button>
    </form>
  );
}
