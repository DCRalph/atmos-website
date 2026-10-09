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
export const playbookItemSchema = z.object({
  key: z.string().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(20_000).optional(),
  offsetMinutes: z.number().int().min(-525600).max(0),
  role: z.string().min(1).max(80),
  reviewerRole: z.string().max(80).optional(),
  critical: z.boolean().default(false),
  dependsOn: z.array(z.string()).max(50).default([]),
});
export const playbookSchema = z
  .array(playbookItemSchema)
  .min(1)
  .max(100)
  .superRefine((items, ctx) => {
    const keys = new Set(items.map((item) => item.key));
    if (keys.size !== items.length)
      ctx.addIssue({ code: "custom", message: "Playbook keys must be unique" });
    for (const item of items)
      for (const dep of item.dependsOn)
        if (!keys.has(dep))
          ctx.addIssue({
            code: "custom",
            message: `Unknown dependency ${dep}`,
          });
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (key: string): boolean => {
      if (visiting.has(key)) return false;
      if (visited.has(key)) return true;
      visiting.add(key);
      for (const dep of items.find((i) => i.key === key)?.dependsOn ?? [])
        if (!visit(dep)) return false;
      visiting.delete(key);
      visited.add(key);
      return true;
    };
    if (items.some((item) => !visit(item.key)))
      ctx.addIssue({
        code: "custom",
        message: "Playbook dependencies cannot form a cycle",
      });
  });
export const taskSettingsSchema = z.object({
  roundsEnabled: z.boolean().default(false),
  nagVoice: z.boolean().default(false),
});
