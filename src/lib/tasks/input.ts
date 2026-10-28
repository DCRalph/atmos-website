import { z } from "zod";
import { TASK_STATUSES } from "./status";
export const taskStatusSchema = z.enum(TASK_STATUSES);
export const automationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("POSTER") }),
  z.object({ kind: z.literal("TICKETS_PUBLISHED") }),
  z.object({
    kind: z.literal("TICKETS_SOLD"),
    count: z.number().int().min(1).max(1_000_000),
  }),
]);
export const taskFields = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(20_000).nullable().optional(),
  gigId: z.string().min(1).nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  reviewerId: z.string().min(1).nullable().optional(),
  dueAt: z.date(),
  hardDeadlineAt: z.date().nullable().optional(),
  critical: z.boolean().default(false),
  proofRequired: z.boolean().default(false),
  automation: automationSchema.nullable().optional(),
});
/** A wall clock in NZ time, like `17:00`. */
export const clockSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 17:00");
export const WEEKDAY_KEYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
/**
 * When a playbook task falls due, counted from the gig:
 * - `days`: whole days from the gig's date. With `weekdays`, a date that
 *   lands on a weekend moves to the Friday before (the Monday after, for
 *   wrap-up).
 * - `weekday`: the first such weekday before or after the gig, never the gig
 *   day itself, then `weeks` further out. "The Monday 3 weeks before".
 * - `hours`: from the gig's start, its doors or its end, for gig-day work.
 */
export const playbookWhenSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("days"),
    days: z.number().int().min(-365).max(30),
    weekdays: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("weekday"),
    day: z.enum(WEEKDAY_KEYS),
    side: z.enum(["before", "after"]),
    weeks: z.number().int().min(0).max(52),
  }),
  z.object({
    kind: z.literal("hours"),
    hours: z.number().min(-8760).max(720),
    from: z.enum(["start", "doors", "end"]),
  }),
]);
export const playbookItemSchema = z.object({
  key: z.string().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(20_000).optional(),
  when: playbookWhenSchema,
  /** Its own due time, for days and weekday rules. Absent uses the playbook's. */
  time: clockSchema.optional(),
  role: z.string().min(1).max(80),
  reviewerRole: z.string().max(80).optional(),
  critical: z.boolean().default(false),
  dependsOn: z.array(z.string()).max(50).default([]),
});
/** Who owns playbook work. Applying a playbook is one pick per role. */
export const playbookRoleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Who usually fills it. The apply dialog starts with them picked. */
  userId: z.string().min(1).nullable().default(null),
  /** What it covers, shown when picking someone for it. */
  note: z.string().trim().max(160).optional(),
});
const playbookFields = z.object({
  /** When its tasks are due unless they set their own time. Null keeps the gig's start time. */
  dueTime: clockSchema.nullable().default(null),
  roles: z.array(playbookRoleSchema).max(20),
  tasks: z.array(playbookItemSchema).min(1).max(100),
});
function checkPlaybook(
  { roles, tasks }: z.output<typeof playbookFields>,
  ctx: z.RefinementCtx,
) {
  const keys = new Set(tasks.map((task) => task.key));
  if (keys.size !== tasks.length)
    ctx.addIssue({ code: "custom", message: "Playbook keys must be unique" });
  for (const task of tasks)
    for (const dep of task.dependsOn)
      if (!keys.has(dep))
        ctx.addIssue({ code: "custom", message: `Unknown dependency ${dep}` });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (key: string): boolean => {
    if (visiting.has(key)) return false;
    if (visited.has(key)) return true;
    visiting.add(key);
    for (const dep of tasks.find((task) => task.key === key)?.dependsOn ?? [])
      if (!visit(dep)) return false;
    visiting.delete(key);
    visited.add(key);
    return true;
  };
  if (tasks.some((task) => !visit(task.key)))
    ctx.addIssue({
      code: "custom",
      message: "Playbook dependencies cannot form a cycle",
    });
  const names = new Set(roles.map((role) => role.name));
  if (names.size !== roles.length)
    ctx.addIssue({ code: "custom", message: "Role names must be unique" });
  for (const task of tasks)
    for (const role of [task.role, task.reviewerRole])
      if (role && !names.has(role))
        ctx.addIssue({
          code: "custom",
          message: `${task.title} needs a role called ${role}`,
        });
}
export const playbookSchema = playbookFields.superRefine(checkPlaybook);
export const playbookInputSchema = playbookFields
  .extend({ name: z.string().trim().min(1).max(100) })
  .superRefine(checkPlaybook);
/**
 * A playbook as stored in `task_playbook.items`. Ones saved before date rules
 * are a bare array of tasks counted in minutes from the gig's start. They read
 * as day counts (or hours) due at the gig's start time, so they land on the
 * same days as before. Across a daylight saving change that's now the gig's
 * own time of day, where minute counts drifted by an hour.
 */
export const storedPlaybookSchema = z.preprocess(
  (value) => (Array.isArray(value) ? upgradePlaybook(value) : value),
  playbookSchema,
);
function upgradePlaybook(items: unknown[]) {
  // Untrusted JSON: the schema checks every field once it's reshaped.
  const rows = items.map((item) => ({ ...(item as Record<string, unknown>) }));
  const names = rows.flatMap((row) => [row.role, row.reviewerRole]);
  return {
    dueTime: null,
    roles: [
      ...new Set(names.filter((name) => typeof name === "string" && name)),
    ].map((name) => ({ name, userId: null })),
    tasks: rows.map(({ offsetMinutes, ...task }) => {
      const minutes = Number(offsetMinutes);
      return {
        ...task,
        when:
          minutes % 1440 === 0
            ? { kind: "days", days: minutes / 1440 }
            : { kind: "hours", hours: minutes / 60, from: "start" },
      };
    }),
  };
}
export const taskSettingsSchema = z.object({
  roundsEnabled: z.boolean().default(false),
  nagVoice: z.boolean().default(false),
});
