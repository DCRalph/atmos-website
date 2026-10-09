"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  statusActions,
  statusLabels,
  type TaskStatus,
  isOpen,
} from "~/lib/tasks/status";
import { formatTaskDate } from "~/lib/tasks/time";
import { useUpload } from "~/hooks/use-upload";
import { TaskForm, TaskImpact } from "./task-form";
import { TaskDatePicker, TaskField, TaskSelect, taskFlag } from "./shared";
export function TaskDrawer({
  id,
  onClose,
  onOpen,
}: {
  id: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <Sheet
      open={!!id}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Task</SheetTitle>
          <SheetDescription>
            Ownership, dates and the record of what changed.
          </SheetDescription>
        </SheetHeader>
        {id ? (
          <TaskDetail key={id} id={id} onOpen={onOpen} onClose={onClose} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
function TaskDetail({
  id,
  onOpen,
  onClose,
}: {
  id: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const task = api.tasks.get.useQuery({ id });
  const options = api.tasks.options.useQuery();
  const all = api.tasks.list.useQuery({ includeClosed: true });
  const utils = api.useUtils();
  const [editing, setEditing] = useState(false),
    [onBehalf, setOnBehalf] = useState(false),
    [mode, setMode] = useState<"delay" | "blocked" | "offer" | "return" | null>(
      null,
    ),
    [body, setBody] = useState(""),
    [date, setDate] = useState<Date>(() => new Date(Date.now() + 86400_000)),
    [comment, setComment] = useState(""),
    [dependency, setDependency] = useState(""),
    [gap, setGap] = useState(""),
    [acceptOwner, setAcceptOwner] = useState("");
  const onSuccess = () => {
    void utils.tasks.invalidate();
    setMode(null);
    setBody("");
  };
  const onError = (e: { message: string }) => toast.error(e.message);
  const callbacks = { onSuccess, onError };
  const status = api.tasks.setStatus.useMutation(callbacks),
    delay = api.tasks.reportDelay.useMutation(callbacks),
    offer = api.tasks.offer.useMutation(callbacks),
    take = api.tasks.take.useMutation(callbacks),
    nudge = api.tasks.nudge.useMutation({
      ...callbacks,
      onSuccess: () => toast.success("Reminder sent"),
    }),
    remove = api.tasks.removeDependency.useMutation(callbacks),
    add = api.tasks.addDependency.useMutation({
      ...callbacks,
      onSuccess: () => {
        onSuccess();
        setDependency("");
        setGap("");
      },
    }),
    accept = api.tasks.accept.useMutation(callbacks),
    dismiss = api.tasks.dismiss.useMutation(callbacks),
    post = api.tasks.comment.useMutation({
      ...callbacks,
      onSuccess: () => {
        onSuccess();
        setComment("");
      },
    }),
    del = api.tasks.delete.useMutation({
      ...callbacks,
      onSuccess: () => {
        onSuccess();
        onClose();
      },
    }),
    proof = api.tasks.attachProof.useMutation(callbacks),
    assess = api.tasks.assessProof.useMutation(callbacks),
    triage = api.tasks.triage.useMutation({ onError });
  const [acceptDate, setAcceptDate] = useState<Date>();
  const suggested = api.tasks.suggestGap.useQuery(
    { id, dependsOnId: dependency },
    { enabled: !!dependency },
  );
  const upload = useUpload("taskProof", {
    context: { taskId: id },
    onComplete: (files) => {
      if (files[0]) proof.mutate({ id, uploadId: files[0].id });
    },
    onError: (message) => toast.error(message),
  });
  const t = task.data;
  if (task.error)
    return (
      <p role="alert" className="text-destructive p-4">
        {task.error.message}
      </p>
    );
  if (!t) return <p className="p-4 text-sm">Loading task…</p>;
  const busy =
    status.isPending ||
    delay.isPending ||
    offer.isPending ||
    take.isPending ||
    accept.isPending ||
    dismiss.isPending;
  const action = (
    to: TaskStatus,
    requiresReason: boolean | undefined,
    now: Date,
  ) => {
    if (to === "BLOCKED") {
      setBody(t.blockedReason ?? "");
      setDate(
        t.checkBackAt && t.checkBackAt > now
          ? t.checkBackAt
          : new Date(now.getTime() + 86400_000),
      );
      setMode("blocked");
    } else if (requiresReason) setMode("return");
    else status.mutate({ id, status: to });
  };
  return (
    <div className="space-y-5 px-4 pb-8">
      <div>
        <h2 className="text-xl font-semibold">{t.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {taskFlag(t)}
          {t.critical ? " · Critical" : ""} · {t.assignee?.name ?? "Unassigned"}
        </p>
      </div>
      {editing ? (
        <>
          <TaskForm task={t} onSaved={() => setEditing(false)} />
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Close editor
          </Button>
        </>
      ) : (
        <>
          {t.notes ? (
            <p className="text-sm whitespace-pre-wrap">{t.notes}</p>
          ) : null}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Due</dt>
            <dd>{formatTaskDate(t.dueAt)}</dd>
            <dt className="text-muted-foreground">Agreed</dt>
            <dd>{formatTaskDate(t.plannedDueAt)}</dd>
            {t.projectedDueAt.getTime() !== t.dueAt.getTime() ? (
              <>
                <dt className="text-muted-foreground">Projected</dt>
                <dd>{formatTaskDate(t.projectedDueAt)}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Reviewer</dt>
            <dd>{t.reviewer?.name ?? "None"}</dd>
            <dt className="text-muted-foreground">Gig</dt>
            <dd>{t.gig?.title ?? "None"}</dd>
            {t.hardDeadlineAt ? (
              <>
                <dt className="text-muted-foreground">Hard deadline</dt>
                <dd>{formatTaskDate(t.hardDeadlineAt)}</dd>
              </>
            ) : null}
          </dl>
          {t.blockedReason ? (
            <p className="rounded border p-3 text-sm">
              Blocked: {t.blockedReason}. Check back{" "}
              {t.checkBackAt ? formatTaskDate(t.checkBackAt) : "not set"}.
            </p>
          ) : null}
          {t.sourceQuote ? (
            <blockquote className="border-l-2 pl-3 text-sm">
              <p className="text-muted-foreground mb-1 text-xs">
                {t.source} · {t.sourceSubject ?? "Source quote"}
              </p>
              {t.sourceQuote}
            </blockquote>
          ) : null}
          {t.status === "PROPOSED" ? (
            <div className="space-y-3 rounded border p-3">
              <TaskField label="Accept for">
                <TaskSelect
                  value={acceptOwner || (t.assigneeId ?? "")}
                  onChange={(e) => setAcceptOwner(e.target.value)}
                >
                  <option value="">Choose owner</option>
                  {options.data?.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.load.count} due this week
                    </option>
                  ))}
                </TaskSelect>
              </TaskField>
              <TaskDatePicker
                date={acceptDate ?? t.dueAt}
                onChange={setAcceptDate}
              />
              <div className="flex gap-2">
                <Button
                  disabled={busy || !(acceptOwner || t.assigneeId)}
                  onClick={() =>
                    accept.mutate({
                      id,
                      assigneeId: acceptOwner || t.assigneeId!,
                      dueAt: acceptDate ?? t.dueAt,
                    })
                  }
                >
                  Accept proposal
                </Button>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => dismiss.mutate({ id })}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ) : (
            <>
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={onBehalf}
                  onChange={(e) => setOnBehalf(e.target.checked)}
                />
                Act on someone’s behalf (recorded)
              </label>
              <div className="flex flex-wrap gap-2">
                {statusActions(t, options.data?.userId ?? "", onBehalf)
                  .filter((rule) => rule.to !== "TODO")
                  .map((rule) => (
                    <Button
                      key={rule.to}
                      size="sm"
                      variant={
                        rule.to === "DONE" || rule.to === "IN_REVIEW"
                          ? "default"
                          : "outline"
                      }
                      disabled={
                        busy ||
                        ((rule.to === "DONE" || rule.to === "IN_REVIEW") &&
                          t.waiting)
                      }
                      onClick={() => action(rule.to, rule.reason, new Date())}
                    >
                      {rule.to === "IN_REVIEW"
                        ? "Send for review"
                        : rule.to === "DONE"
                          ? t.status === "IN_REVIEW"
                            ? "Approve"
                            : "Done"
                          : rule.to === "IN_PROGRESS"
                            ? t.status === "IN_REVIEW"
                              ? "Send back"
                              : t.status === "DONE"
                                ? "Reopen"
                                : "Start"
                            : rule.to === "BLOCKED" && t.status === "BLOCKED"
                              ? "Update block"
                              : statusLabels[rule.to]}
                    </Button>
                  ))}
                {isOpen(t.status) && t.status !== "IN_REVIEW" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setDate(
                          new Date(
                            Math.max(Date.now(), t.dueAt.getTime()) + 86400_000,
                          ),
                        );
                        setMode("delay");
                      }}
                    >
                      Need more time
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || t.upForGrabs}
                      onClick={() => setMode("offer")}
                    >
                      Pass it on
                    </Button>
                  </>
                ) : null}
                {(t.overdue || t.upForGrabs || t.unassigned) &&
                t.assigneeId !== options.data?.userId &&
                !t.waiting &&
                t.status !== "IN_REVIEW" ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => take.mutate({ id })}
                  >
                    Take it
                  </Button>
                ) : null}
                {isOpen(t.status) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={nudge.isPending}
                    onClick={() => nudge.mutate({ id })}
                  >
                    Nudge now
                  </Button>
                ) : null}
              </div>
            </>
          )}
          {mode ? (
            <form
              className="space-y-3 rounded border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (mode === "delay") delay.mutate({ id, dueAt: date, body });
                else if (mode === "offer") offer.mutate({ id, body });
                else
                  status.mutate({
                    id,
                    status: mode === "blocked" ? "BLOCKED" : "IN_PROGRESS",
                    body,
                    ...(mode === "blocked" ? { checkBackAt: date } : {}),
                  });
              }}
            >
              <h3 className="font-medium">
                {mode === "delay"
                  ? "Need more time"
                  : mode === "blocked"
                    ? "Blocked"
                    : mode === "return"
                      ? "Send back"
                      : "Pass it on"}
              </h3>
              <TaskField label="Reason">
                <Textarea
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={4000}
                />
              </TaskField>
              {mode === "delay" || mode === "blocked" ? (
                <TaskField
                  label={
                    mode === "delay"
                      ? "New due · Auckland time"
                      : "Check back · Auckland time"
                  }
                >
                  <TaskDatePicker
                    date={date}
                    onChange={(d) => {
                      if (d) setDate(d);
                    }}
                  />
                </TaskField>
              ) : null}
              {mode === "delay" ? (
                <>
                  <TaskImpact id={id} dueAt={date} />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={triage.isPending}
                    onClick={() => triage.mutate({ id, dueAt: date })}
                  >
                    {triage.isPending ? "Thinking…" : "Suggest a fix"}
                  </Button>
                  {triage.data ? (
                    <div className="text-sm">
                      <p>{triage.data.summary}</p>
                      {triage.data.suggestions.map((s, i) => (
                        <p key={i}>{s.reason}</p>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
              <div className="flex gap-2">
                <Button disabled={busy}>Send</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMode(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit task
          </Button>
        </>
      )}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Dependencies</h3>
        {t.dependencies.map((dep) => {
          const linked = t.linked.find((row) => row.id === dep.dependsOnId);
          return (
            <div
              className="flex items-center justify-between gap-2 text-sm"
              key={dep.dependsOnId}
            >
              <button
                type="button"
                className="text-left underline underline-offset-4"
                onClick={() => onOpen(dep.dependsOnId)}
              >
                Waits on {linked?.title} ·{" "}
                {linked?.assignee?.name ?? "Unassigned"} · {dep.gapMinutes} min
              </button>
              <Button
                variant="ghost"
                size="sm"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate({ id, dependsOnId: dep.dependsOnId })
                }
              >
                Remove
              </Button>
            </div>
          );
        })}
        {t.dependents.map((dep) => (
          <button
            type="button"
            key={dep.taskId}
            className="block text-left text-sm underline underline-offset-4"
            onClick={() => onOpen(dep.taskId)}
          >
            Waiting on this:{" "}
            {t.linked.find((row) => row.id === dep.taskId)?.title}
          </button>
        ))}
        <TaskSelect
          aria-label="Dependency"
          value={dependency}
          onChange={(e) => setDependency(e.target.value)}
        >
          <option value="">Add a dependency</option>
          {all.data
            ?.filter(
              (row) =>
                row.id !== id &&
                !t.dependencies.some((dep) => dep.dependsOnId === row.id),
            )
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
              </option>
            ))}
        </TaskSelect>
        {dependency ? (
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-36"
              aria-label="Gap in minutes"
              type="number"
              min={0}
              max={525600}
              value={gap}
              placeholder="Planned gap"
              onChange={(e) => setGap(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!suggested.data}
              onClick={() => setGap(String(suggested.data?.gapMinutes ?? 0))}
            >
              Use {suggested.data?.gapMinutes ?? "…"} min (
              {suggested.data?.samples ?? 0} samples)
            </Button>
            <Button
              disabled={add.isPending}
              onClick={() =>
                add.mutate({
                  id,
                  dependsOnId: dependency,
                  ...(gap ? { gapMinutes: Number(gap) } : {}),
                })
              }
            >
              Link
            </Button>
          </div>
        ) : null}
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          Proof {t.proofRequired ? "· required" : ""}
        </h3>
        {t.proof ? (
          <a
            href={t.proof.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline"
          >
            View {t.proof.name}
          </a>
        ) : null}
        <input
          type="file"
          aria-label="Upload proof photo"
          accept={upload.accept}
          disabled={upload.isUploading || proof.isPending}
          onChange={(e) => {
            if (e.target.files) void upload.upload(Array.from(e.target.files));
          }}
          className="block w-full text-sm"
        />
        {upload.isUploading ? (
          <p className="text-sm" aria-live="polite">
            Uploading proof…
          </p>
        ) : null}
        {t.proof ? (
          <Button
            size="sm"
            variant="outline"
            disabled={assess.isPending}
            onClick={() => assess.mutate({ id })}
          >
            Check photo with AI
          </Button>
        ) : null}
        {t.proofAssessment ? (
          <p className="text-sm">{t.proofAssessment}</p>
        ) : null}
      </section>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          post.mutate({ id, body: comment });
        }}
      >
        <Input
          aria-label="Comment"
          placeholder="Add a comment…"
          maxLength={4000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <Button disabled={!comment.trim() || post.isPending}>Post</Button>
      </form>
      <section>
        <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
        <ol className="space-y-3">
          {t.timeline.map((event) => (
            <li className="border-l pl-3 text-sm" key={event.id}>
              <p>
                {event.actor?.name ?? "System"} ·{" "}
                {event.kind.replaceAll("_", " ").toLowerCase()}
                {event.onBehalf ? " · on behalf" : ""}
              </p>
              {event.body ? (
                <p className="whitespace-pre-wrap">{event.body}</p>
              ) : null}
              {event.toDueAt ? (
                <p>Due {formatTaskDate(event.toDueAt)}</p>
              ) : null}
              <p className="text-muted-foreground text-xs">
                {formatTaskDate(event.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      </section>
      <Button
        variant="destructive"
        size="sm"
        disabled={del.isPending}
        onClick={() => {
          if (window.confirm(`Delete “${t.title}” and its history?`))
            del.mutate({ id });
        }}
      >
        Delete task
      </Button>
    </div>
  );
}
