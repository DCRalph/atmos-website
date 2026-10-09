import { Suspense } from "react";
import { TasksWorkspace } from "~/components/admin/tasks/tasks-workspace";
export default function TasksPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading tasks…</p>}>
      <TasksWorkspace />
    </Suspense>
  );
}
