import { z } from "zod";

/**
 * Will GPT, the admin's assistant: the shapes the panel and the server share.
 *
 * The conversation lives in the browser and is sent whole on every run, so the
 * server keeps no chat state. That is safe because every action runs as the
 * signed-in admin through the same procedures the admin UI calls: a forged
 * transcript can only do what its sender could already do by hand.
 */

/** Models offered in the panel, all through OpenRouter. The first is the default. */
export const WILL_GPT_MODELS = [
  { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5" },
  { id: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5" },
  { id: "openai/gpt-5.5", label: "GPT-5.5" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash" },
] as const;

export type WillGptModelId = (typeof WILL_GPT_MODELS)[number]["id"];

/**
 * How much a procedure can hurt.
 *
 * - `read` runs freely.
 * - `write` creates or edits and runs straight away.
 * - `destructive` deletes, replaces, sends something to people, or changes who
 *   can do what. It waits for the admin to approve it.
 */
export type Risk = "read" | "write" | "destructive";

/** Arguments of the `describe` tool: which procedures' input schemas to fetch. */
export const describeArgsSchema = z.object({
  paths: z
    .array(z.string())
    .min(1)
    .describe('Procedure paths, e.g. ["gigs.create", "gigTags.getAll"]'),
});

/** Arguments of the `call` tool: one procedure call. */
export const callArgsSchema = z.object({
  path: z.string().describe('Procedure path, e.g. "gigs.create"'),
  summary: z
    .string()
    .describe(
      'One short line for the admin naming what this does and to which record, e.g. "Delete gig Atmos 004 (Fri 12 Dec)"',
    ),
  input: z
    .unknown()
    .optional()
    .describe("The procedure's input, matching the schema from describe"),
});

export type CallArgs = z.infer<typeof callArgsSchema>;

const toolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The model's arguments, as the JSON text it wrote. */
  arguments: z.string(),
});

export type WillGptToolCall = z.infer<typeof toolCallSchema>;

export const willGptMessageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), text: z.string() }),
  z.object({
    role: z.literal("assistant"),
    text: z.string(),
    toolCalls: z.array(toolCallSchema),
  }),
  z.object({
    role: z.literal("tool"),
    callId: z.string(),
    status: z.enum(["ok", "error", "declined"]),
    /** What the model is shown: the procedure's output as JSON, or why not. */
    output: z.string(),
    /** For the panel only; the server classifies afresh every time. */
    risk: z.enum(["read", "write", "destructive"]).optional(),
  }),
]);

export type WillGptMessage = z.infer<typeof willGptMessageSchema>;

export const willGptRunInputSchema = z.object({
  model: z.enum(WILL_GPT_MODELS.map((model) => model.id)),
  messages: z.array(willGptMessageSchema).min(1),
  /**
   * The admin's answers to the last `awaiting` event, by tool call id. A
   * destructive call runs only on an explicit `true`.
   */
  decisions: z.record(z.string(), z.boolean()).default({}),
  /** The admin page the panel was opened over, so "this gig" means something. */
  page: z.string().max(500),
});

export type WillGptRunInput = z.input<typeof willGptRunInputSchema>;

/** What a run streams back to the panel, in order. */
export type WillGptEvent =
  /** Text of the assistant message being written. */
  | { type: "delta"; text: string }
  /** A finished message to append to the transcript. */
  | { type: "message"; message: WillGptMessage }
  /**
   * The run stopped before any of the last message's calls ran, because these
   * ones need the admin's approval. Answer with `decisions` on the next run.
   */
  | { type: "awaiting"; callIds: string[] }
  /** The run stopped early, for a reason the admin should read. */
  | { type: "notice"; text: string };
