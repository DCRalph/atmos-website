import { z } from "zod";

/**
 * Will GPT, the admin's assistant: the shapes the panel and the server share.
 *
 * Conversations are kept on the server (`WillGptConversation`), which is what
 * makes the history page a record rather than a recollection: the panel only
 * ever sends the next message or its answer to an approval, never the
 * transcript itself.
 */

/** Models offered in the panel, all through OpenRouter. The first is the default. */
export const WILL_GPT_MODELS = [
  { id: "z-ai/glm-5.3-flash", label: "GLM 5.3 Flash" },
  { id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol" },
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna" },
  { id: "openai/gpt-5.6-terra", label: "GPT-5.6 Terra" },
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
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "The procedure's input as a JSON object (not a string), matching the schema from describe. Leave out when it takes none.",
    ),
});

/**
 * A tool call's arguments, read from the JSON text the model wrote, with the
 * reason in words when they do not fit. Some models send `input` as a string
 * holding the JSON object instead of the object itself; that is unwrapped here
 * rather than failed, because a model told "expected object, received string"
 * tends to send the same string again.
 */
export function parseToolArgs<T>(
  schema: z.ZodType<T>,
  text: string,
): { ok: true; data: T } | { ok: false; error: string } {
  let args: unknown;
  try {
    args = JSON.parse(text || "{}");
  } catch {
    return {
      ok: false,
      error: `The arguments are not valid JSON: ${text.slice(0, 200)}`,
    };
  }
  if (
    typeof args === "object" &&
    args !== null &&
    "input" in args &&
    typeof args.input === "string"
  ) {
    try {
      args = { ...args, input: JSON.parse(args.input) as unknown };
    } catch {
      // Not JSON either; the schema says what was wrong with it.
    }
  }
  const parsed = schema.safeParse(args);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, error: z.prettifyError(parsed.error) };
}

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

const INTERRUPTED =
  "Interrupted before a result came back. It may have run; check before trying again.";

/**
 * Close off calls a run left without a result, other than the ones waiting
 * for approval. A call is only ever run once its turn is resumed, so this is
 * what stops an interrupted call, which may already have run, being repeated.
 */
export function closeOff(
  messages: WillGptMessage[],
  awaiting: string[],
): WillGptMessage[] {
  const answered = new Set(
    messages.flatMap((message) =>
      message.role === "tool" ? [message.callId] : [],
    ),
  );
  const loose = messages
    .flatMap((message) =>
      message.role === "assistant" ? message.toolCalls : [],
    )
    .filter((call) => !answered.has(call.id) && !awaiting.includes(call.id));
  return [
    ...messages,
    ...loose.map((call): WillGptMessage => ({
      role: "tool",
      callId: call.id,
      status: "error",
      output: INTERRUPTED,
    })),
  ];
}

/** A call that ran and changed something, as the admin reads it. */
export type WillGptChange = {
  callId: string;
  summary: string;
  path: string;
  risk: Exclude<Risk, "read">;
};

/**
 * What a conversation changed, in order: the writes and approved destructive
 * calls that ran. Reads, failures and declined calls are not changes.
 */
export function changesIn(messages: WillGptMessage[]): WillGptChange[] {
  const calls = new Map(
    messages.flatMap((message) =>
      message.role === "assistant"
        ? message.toolCalls.map((call) => [call.id, call] as const)
        : [],
    ),
  );
  return messages.flatMap((message): WillGptChange[] => {
    if (message.role !== "tool" || message.status !== "ok") return [];
    if (message.risk !== "write" && message.risk !== "destructive") return [];
    const call = calls.get(message.callId);
    if (!call) return [];
    const args = parseToolArgs(callArgsSchema, call.arguments);
    return [
      {
        callId: call.id,
        summary: args.ok ? args.data.summary : call.name,
        path: args.ok ? args.data.path : call.name,
        risk: message.risk,
      },
    ];
  });
}

/**
 * One run of the assistant on a conversation: either the admin's next
 * message, or their answer to the calls waiting for approval.
 */
export const willGptRunInputSchema = z.object({
  /** Chosen by the panel when the chat starts. */
  conversationId: z.uuid(),
  model: z.enum(WILL_GPT_MODELS.map((model) => model.id)),
  message: z.string().trim().min(1).max(20_000).optional(),
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
