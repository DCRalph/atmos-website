import "server-only";

import {
  getTRPCErrorFromUnknown,
  TRPCError,
  type AnyTRPCProcedure,
  type AnyTRPCRouter,
} from "@trpc/server";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { z } from "zod";

import { env } from "~/env";
import { RUN_SHEET_TIMEZONE } from "~/lib/run-sheet/schedule";
import {
  callArgsSchema,
  describeArgsSchema,
  type Risk,
  type WillGptEvent,
  type WillGptMessage,
  type WillGptModelId,
  type WillGptToolCall,
} from "~/lib/will-gpt";
import type { createTRPCContext, ProcedureMeta } from "~/server/api/trpc";
import { inputSchemaOf, prepareInput } from "./input";
import { isOffered, riskOf } from "./policy";

/**
 * Will GPT's agent loop.
 *
 * It has two tools, and they are a bridge rather than a feature list: `describe`
 * returns a procedure's input schema and `call` runs it, both over the admin
 * tRPC API. So the assistant can do whatever the admin UI can, through the
 * same validation, permission checks and activity logging, and learns about a
 * new procedure the moment one is added. What it may call and which calls wait
 * for approval is `./policy`.
 *
 * A run streams until the model stops calling tools, or until it asks for
 * something destructive. Then the run ends with an `awaiting` event and none of
 * that turn's calls have run; the next run carries the admin's decisions and
 * picks up from there.
 */

type Context = Awaited<ReturnType<typeof createTRPCContext>>;
type ToolResult = Extract<WillGptMessage, { role: "tool" }>;
type Entry = { procedure: AnyTRPCProcedure; risk: Risk };

/** A run stops starting new model turns after this, to finish inside the route's 300s limit. */
const RUN_BUDGET_MS = 240_000;

/** Roughly 5k tokens. A list that comes back longer is cut, and the model is told so. */
const MAX_OUTPUT_CHARS = 20_000;

/** A tool's arguments as JSON Schema, minus the `$schema` tag some providers refuse. */
function toolParameters(schema: z.ZodType) {
  const parameters: Record<string, unknown> = z.toJSONSchema(schema);
  delete parameters.$schema;
  return parameters;
}

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "describe",
      description:
        "Get the input JSON schema of one or more procedures. Do this before calling a procedure for the first time.",
      parameters: toolParameters(describeArgsSchema),
    },
  },
  {
    type: "function",
    function: {
      name: "call",
      description:
        "Run one admin API procedure as the signed-in admin. Procedures marked confirm wait for the admin to approve them. Several calls may be made in one turn.",
      parameters: toolParameters(callArgsSchema),
    },
  },
];

/** The procedures Will GPT is offered, by dotted path. */
function catalogOf(router: AnyTRPCRouter): Map<string, Entry> {
  // Typed as the nested record, but flat at runtime and keyed by dotted path.
  const procedures = router._def.procedures as Record<string, AnyTRPCProcedure>;
  const catalog = new Map<string, Entry>();
  for (const [path, procedure] of Object.entries(procedures)) {
    const { type, meta } = procedure._def;
    // Set by `permissionProcedure`; see `ProcedureMeta`.
    if (!isOffered(path, type, meta as ProcedureMeta | undefined)) continue;
    catalog.set(path, { procedure, risk: riskOf(path, type) });
  }
  return catalog;
}

/** The catalog as the system prompt lists it, one router per block. */
function catalogText(catalog: Map<string, Entry>): string {
  const routers = new Map<string, Record<Risk, string[]>>();
  for (const [path, { risk }] of catalog) {
    const [router = path, name = path] = path.split(".");
    const group = routers.get(router) ?? {
      read: [],
      write: [],
      destructive: [],
    };
    group[risk].push(name);
    routers.set(router, group);
  }
  return [...routers]
    .map(([router, group]) =>
      [
        router,
        group.read.length ? `  read: ${group.read.join(", ")}` : null,
        group.write.length ? `  write: ${group.write.join(", ")}` : null,
        group.destructive.length
          ? `  confirm: ${group.destructive.join(", ")}`
          : null,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    )
    .join("\n");
}

function systemPrompt(catalog: Map<string, Entry>, page: string): string {
  const now = new Intl.DateTimeFormat("en-NZ", {
    timeZone: RUN_SHEET_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "longOffset",
  }).format(new Date());

  return `You are Will GPT, the assistant in the Atmos admin. Atmos is a New Zealand music promoter: gigs, a public website, ticketing, crew, creator profiles, merch and gear rentals.

You work through the site's admin API, as the signed-in admin and with their permissions. What you change is live on the public website straight away.

How to work:
- Look before you change. Read records, or search with pickers.*, to get ids. Never guess an id.
- Call describe for a procedure before calling it the first time. Inputs are validated and a wrong shape is rejected with the reason.
- For many records ("add these 12 gigs"), make one call per record. You may make several calls in one turn.
- Every call needs a summary naming the record it touches. The admin reads it, and approves destructive calls from it.
- Procedures under confirm (deletes, sends, access changes, replace-everything saves) wait for the admin's approval. Before making one, say in a sentence what will happen and what cannot be undone. If the admin declines, do not retry unless they ask.
- Use the narrowest procedure: gigs.update to change a field, not gigs.saveAll, which replaces a gig's tags and run sheet wholesale.
- Never invent details such as dates, venues, prices or line-ups. Ask when something you need is missing.
- Dates are ISO 8601 instants. Atmos runs on ${RUN_SHEET_TIMEZONE} time: +13:00 from the last Sunday of September to the first Sunday of April, +12:00 otherwise. Give the admin's local times the offset in force on that date.
- Fields whose name ends in "Lexical" take plain text. Separate paragraphs with a blank line.
- Keep replies short. After changing things, list what changed with links to admin pages: /admin/gigs/<id>, /admin/events/<id>, /admin/content/<id>, /admin/users/<id>, /admin/links/<id>, /admin/creator-profiles/<id>.

It is ${now}.
The admin has the panel open over ${page}.

Procedures. read runs freely, write runs straight away, confirm waits for approval:
${catalogText(catalog)}`;
}

function asToolOutput(value: unknown): string {
  const json =
    JSON.stringify(value ?? null, (_key, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    ) ?? "null";
  if (json.length <= MAX_OUTPUT_CHARS) return json;
  return `${json.slice(0, MAX_OUTPUT_CHARS)}… [cut at ${MAX_OUTPUT_CHARS} of ${json.length} characters; ask for less, such as one record or a filtered list]`;
}

function parseArgs<T>(schema: z.ZodType<T>, text: string) {
  try {
    return schema.safeParse(JSON.parse(text || "{}"));
  } catch {
    return schema.safeParse(undefined);
  }
}

/**
 * Run one tool call. Destructive calls run only when `approved`; everything
 * else the admin has already allowed by asking.
 */
async function runTool(
  call: WillGptToolCall,
  opts: {
    catalog: Map<string, Entry>;
    ctx: Context;
    approved: boolean;
    signal: AbortSignal | undefined;
  },
): Promise<ToolResult> {
  const result = (
    status: ToolResult["status"],
    output: string,
    risk?: Risk,
  ): ToolResult => ({ role: "tool", callId: call.id, status, output, risk });

  if (call.name === "describe") {
    const args = parseArgs(describeArgsSchema, call.arguments);
    if (!args.success) return result("error", z.prettifyError(args.error));
    const described = args.data.paths.map((path) => {
      const entry = opts.catalog.get(path);
      if (!entry) return { path, error: "No such procedure in the list." };
      return {
        path,
        type: entry.procedure._def.type,
        risk: entry.risk,
        input: inputSchemaOf(entry.procedure._def.inputs[0]),
      };
    });
    return result("ok", asToolOutput(described), "read");
  }

  if (call.name !== "call") {
    return result("error", `There is no tool called "${call.name}".`);
  }

  const args = parseArgs(callArgsSchema, call.arguments);
  if (!args.success) return result("error", z.prettifyError(args.error));
  const entry = opts.catalog.get(args.data.path);
  if (!entry) {
    return result(
      "error",
      `There is no procedure "${args.data.path}" in the list.`,
    );
  }
  if (entry.risk === "destructive" && !opts.approved) {
    return result(
      "declined",
      "The admin declined this. Do not retry it unless they ask.",
      entry.risk,
    );
  }

  try {
    const output: unknown = await entry.procedure({
      ctx: opts.ctx,
      path: args.data.path,
      type: entry.procedure._def.type,
      getRawInput: async () =>
        prepareInput(entry.procedure._def.inputs[0], args.data.input),
      signal: opts.signal,
      batchIndex: 0,
    });
    return result("ok", asToolOutput(output), entry.risk);
  } catch (cause) {
    const error = getTRPCErrorFromUnknown(cause);
    return result("error", `${error.code}: ${error.message}`, entry.risk);
  }
}

/** The transcript in OpenAI's shape, each call followed by its result. */
function toOpenAI(transcript: WillGptMessage[]): ChatCompletionMessageParam[] {
  const results = new Map(
    transcript.flatMap((message) =>
      message.role === "tool"
        ? [[message.callId, message.output] as const]
        : [],
    ),
  );
  return transcript.flatMap((message): ChatCompletionMessageParam[] => {
    switch (message.role) {
      case "user":
        return [{ role: "user", content: message.text }];
      // Placed after the call it answers, below.
      case "tool":
        return [];
      case "assistant":
        if (message.toolCalls.length === 0) {
          return [{ role: "assistant", content: message.text }];
        }
        return [
          {
            role: "assistant",
            content: message.text || null,
            tool_calls: message.toolCalls.map((call) => ({
              id: call.id,
              type: "function",
              function: { name: call.name, arguments: call.arguments },
            })),
          },
          ...message.toolCalls.map((call): ChatCompletionMessageParam => ({
            role: "tool",
            tool_call_id: call.id,
            content: results.get(call.id) ?? "Not run.",
          })),
        ];
    }
  });
}

/** One model turn, streamed. Yields text as it arrives and returns the message. */
async function* modelTurn(
  client: OpenAI,
  opts: {
    model: WillGptModelId;
    system: string;
    transcript: WillGptMessage[];
    signal: AbortSignal | undefined;
  },
): AsyncGenerator<
  WillGptEvent,
  Extract<WillGptMessage, { role: "assistant" }>
> {
  const stream = await client.chat.completions.create(
    {
      model: opts.model,
      stream: true,
      tools: TOOLS,
      messages: [
        { role: "system", content: opts.system },
        ...toOpenAI(opts.transcript),
      ],
    },
    { signal: opts.signal },
  );

  let text = "";
  const toolCalls: WillGptToolCall[] = [];
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (delta?.content) {
      text += delta.content;
      yield { type: "delta", text: delta.content };
    }
    // Calls arrive in fragments, keyed by their position in the message.
    for (const fragment of delta?.tool_calls ?? []) {
      const call = (toolCalls[fragment.index] ??= {
        id: "",
        name: "",
        arguments: "",
      });
      call.id ||= fragment.id ?? "";
      call.name += fragment.function?.name ?? "";
      call.arguments += fragment.function?.arguments ?? "";
    }
  }

  return { role: "assistant", text, toolCalls: toolCalls.filter(Boolean) };
}

export async function* runWillGpt(opts: {
  router: AnyTRPCRouter;
  ctx: Context;
  model: WillGptModelId;
  messages: WillGptMessage[];
  decisions: Record<string, boolean>;
  page: string;
  signal: AbortSignal | undefined;
}): AsyncGenerator<WillGptEvent> {
  if (!env.OPENROUTER_API_KEY) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Will GPT is not set up: OPENROUTER_API_KEY is unset.",
    });
  }

  const client = new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    // OpenRouter attributes requests to an app by these, which is how its
    // dashboard tells Will GPT's spend from the gig import's.
    defaultHeaders: {
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "Atmos Admin / Will GPT",
    },
  });
  const catalog = catalogOf(opts.router);
  const system = systemPrompt(catalog, opts.page);
  const transcript = [...opts.messages];
  const startedAt = Date.now();

  // Run the calls, in order, and add their results to the transcript.
  async function* settle(calls: WillGptToolCall[]) {
    for (const call of calls) {
      const result = await runTool(call, {
        catalog,
        ctx: opts.ctx,
        approved: opts.decisions[call.id] === true,
        signal: opts.signal,
      });
      transcript.push(result);
      yield { type: "message", message: result } satisfies WillGptEvent;
    }
  }

  // Resuming after an `awaiting` event: finish the turn the admin answered.
  // Calls left behind by an earlier, interrupted run are never picked up,
  // because they may already have run.
  const last = transcript.filter((message) => message.role !== "tool").at(-1);
  if (last?.role === "assistant") {
    const answered = new Set(
      transcript.flatMap((message) =>
        message.role === "tool" ? [message.callId] : [],
      ),
    );
    yield* settle(last.toolCalls.filter((call) => !answered.has(call.id)));
  }

  while (Date.now() - startedAt < RUN_BUDGET_MS) {
    const message = yield* modelTurn(client, {
      model: opts.model,
      system,
      transcript,
      signal: opts.signal,
    });
    transcript.push(message);
    yield { type: "message", message };
    if (message.toolCalls.length === 0) return;

    // Approval is asked for the whole turn before any of it runs, so the
    // calls still happen in the order the model wrote them.
    const needsApproval = message.toolCalls.filter((call) => {
      const args = parseArgs(callArgsSchema, call.arguments);
      return (
        call.name === "call" &&
        args.success &&
        catalog.get(args.data.path)?.risk === "destructive"
      );
    });
    if (needsApproval.length > 0) {
      yield { type: "awaiting", callIds: needsApproval.map((call) => call.id) };
      return;
    }
    yield* settle(message.toolCalls);
  }

  yield {
    type: "notice",
    text: "Paused to stay inside the time limit. Say “continue” to carry on.",
  };
}
