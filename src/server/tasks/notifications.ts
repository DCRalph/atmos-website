import "server-only";
import { readTasks, taskPeople } from "./data";
import { sendPush, sendSilentPush } from "~/server/push";
import { taskDayActivity } from "~/lib/tasks/live-activity";
import { taskPushBody } from "~/lib/tasks/push-copy";
export type TaskNotice = {
  taskId: string;
  title: string;
  body: string;
  userIds: (string | null | undefined)[];
  allAdmins?: boolean;
};
/** Post-commit effects cannot undo work that has already been saved. Only current admins are reached. */
export async function notifyTasks(
  notices: readonly TaskNotice[],
  liveUserIds: readonly (string | null | undefined)[] = [],
) {
  try {
    const people = await taskPeople();
    const admins = new Set(people.map((person) => person.id));
    for (const notice of notices) {
      const ids = notice.allAdmins
        ? [...admins]
        : [
            ...new Set(
              notice.userIds.filter(
                (id): id is string => !!id && admins.has(id),
              ),
            ),
          ];
      if (ids.length)
        await sendPush({
          audience: { kind: "users", userIds: ids },
          title: notice.title,
          body: taskPushBody(notice.body),
          data: { url: `/tasks/${notice.taskId}`, taskId: notice.taskId },
          categoryId: "TASK_ACTIONS",
        });
    }
    const ids = [
      ...new Set(
        liveUserIds.filter((id): id is string => !!id && admins.has(id)),
      ),
    ];
    if (!ids.length) return;
    const tasks = await readTasks();
    const now = new Date();
    for (const userId of ids) {
      const state = taskDayActivity(
        userId,
        tasks
          .filter((task) => task.assigneeId === userId)
          .map((task) => ({ ...task, dueAt: task.projectedDueAt })),
        now,
      );
      await sendSilentPush({
        audience: { kind: "users", userIds: [userId] },
        data: { taskDayActivity: JSON.stringify(state) },
      });
    }
  } catch (error) {
    console.error("[tasks] notifications failed", error);
  }
}
