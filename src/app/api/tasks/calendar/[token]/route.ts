import { db } from "~/server/db";
import { env } from "~/env";
import { taskCalendar } from "~/lib/tasks/calendar";
import { readTasks } from "~/server/tasks/data";
import { userHasPermission } from "~/server/utils/permissions";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params;
  const token = rawToken.replace(/\.ics$/, "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    return new Response("Not found", { status: 404 });
  const feed = await db.taskCalendarFeed.findUnique({
    where: { token },
    include: {
      user: { select: { permissions: { select: { permission: true } } } },
    },
  });
  if (!feed || !userHasPermission(feed.user, "ADMIN"))
    return new Response("Not found", { status: 404 });
  const tasks = (await readTasks()).filter(
    (task) =>
      task.assigneeId === feed.userId &&
      !["PROPOSED", "DONE", "CANCELLED"].includes(task.status),
  );
  const gigs = await db.gig.findMany({
    where: {
      OR: [
        {
          id: { in: tasks.flatMap((task) => (task.gigId ? [task.gigId] : [])) },
        },
        { notifyRecipients: { some: { userId: feed.userId } } },
        {
          ticketEvents: { some: { staff: { some: { userId: feed.userId } } } },
        },
      ],
      gigStartTime: { gte: new Date(Date.now() - 30 * 86400_000) },
    },
    select: {
      id: true,
      title: true,
      gigStartTime: true,
      gigEndTime: true,
      updatedAt: true,
    },
  });
  const origin = env.NEXT_PUBLIC_APP_URL;
  const entries = [
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      notes: task.notes,
      startsAt: task.projectedDueAt,
      updatedAt: task.updatedAt,
      url: `${origin}/admin/tasks?task=${task.id}`,
    })),
    ...gigs.map((gig) => ({
      id: `gig-${gig.id}`,
      title: gig.title,
      startsAt: gig.gigStartTime,
      endsAt: gig.gigEndTime,
      updatedAt: gig.updatedAt,
      url: `${origin}/admin/gigs/${gig.id}`,
    })),
  ];
  return new Response(taskCalendar(entries, new Date()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=atmos-tasks.ics",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
