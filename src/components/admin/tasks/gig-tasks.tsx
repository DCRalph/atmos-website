"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { criticalPathOwners } from "~/lib/tasks/critical-path";
import { formatTaskDate } from "~/lib/tasks/time";
import { taskFlag } from "./shared";
import { ApplyPlaybook } from "./task-tools";
import { TaskDrawer } from "./task-drawer";
export function GigTasks({ gigId }: { gigId: string }) {
  const query = api.tasks.list.useQuery({ gigId });
  const utils = api.useUtils();
  const [apply, setApply] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const plan = api.tasks.planGig.useMutation({
      onSuccess: (tasks) => {
        toast.success(`${tasks.length} proposals ready`);
        void utils.tasks.invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
    premortem = api.tasks.preMortem.useMutation({
      onError: (e) => toast.error(e.message),
    });
  const tasks = query.data ?? [];
  const edges = tasks
    .flatMap((t) => t.dependencies)
    .filter((d) => tasks.some((t) => t.id === d.dependsOnId));
  const owners = criticalPathOwners(tasks, edges);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setApply(!apply)}>
          Apply playbook
        </Button>
        <Button
          variant="outline"
          disabled={plan.isPending}
          onClick={() => plan.mutate({ gigId })}
        >
          {plan.isPending ? "Planning…" : "Plan this gig"}
        </Button>
        <Button
          variant="outline"
          disabled={premortem.isPending}
          onClick={() => premortem.mutate({ gigId })}
        >
          Pre-mortem
        </Button>
        <Button variant="ghost" asChild>
          <Link href={`/admin/tasks?gig=${gigId}`}>Open calendar</Link>
        </Button>
      </div>
      {owners.map((owner) => (
        <p
          key={owner.userId}
          className="border-destructive/30 rounded border p-3 text-sm"
        >
          {tasks.find((t) => t.assigneeId === owner.userId)?.assignee?.name}{" "}
          owns {owner.count} of {owner.total} tasks on the longest dependency
          path. Share the load before the gig.
        </p>
      ))}
      {apply ? (
        <div className="max-w-lg rounded border p-4">
          <ApplyPlaybook gigId={gigId} onDone={() => setApply(false)} />
        </div>
      ) : null}
      {premortem.data ? (
        <div className="rounded border p-4 text-sm">
          <p className="font-medium">{premortem.data.summary}</p>
          {premortem.data.suggestions.map((s, i) => (
            <p className="mt-2" key={i}>
              {s.reason}
            </p>
          ))}
        </div>
      ) : null}
      {query.error ? <p role="alert">{query.error.message}</p> : null}
      {query.isPending ? (
        <p>Loading tasks…</p>
      ) : tasks.length ? (
        tasks.map((t) => (
          <button
            key={t.id}
            type="button"
            className="flex w-full flex-wrap justify-between gap-2 border-b py-3 text-left text-sm"
            onClick={() => setSelected(t.id)}
          >
            <span>
              {t.critical ? "! " : ""}
              {t.title} · {t.assignee?.name ?? "Unassigned"}
            </span>
            <span className="text-muted-foreground">
              {formatTaskDate(t.projectedDueAt)} · {taskFlag(t)}
            </span>
          </button>
        ))
      ) : (
        <p className="text-muted-foreground text-sm">
          No tasks for this gig. Apply a playbook or let AI draft proposals.
        </p>
      )}
      <TaskDrawer
        id={selected}
        onClose={() => setSelected(null)}
        onOpen={setSelected}
      />
    </section>
  );
}
