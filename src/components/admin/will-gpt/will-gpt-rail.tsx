"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  ArrowUp,
  Ban,
  Check,
  Clock,
  PanelRight,
  Plus,
  Square,
  TriangleAlert,
  X,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cabin } from "~/lib/fonts";
import { cn } from "~/lib/utils";
import {
  callArgsSchema,
  describeArgsSchema,
  WILL_GPT_MODELS,
  type WillGptMessage,
  type WillGptToolCall,
} from "~/lib/will-gpt";
import { useWillGpt } from "./will-gpt-provider";

type ToolResult = Extract<WillGptMessage, { role: "tool" }>;

/** The header button that opens and closes the rail. */
export function WillGptToggle() {
  const { open, setOpen } = useWillGpt();
  return (
    <Button
      variant={open ? "secondary" : "outline"}
      onClick={() => setOpen(!open)}
      aria-pressed={open}
      aria-label="Will GPT"
    >
      <PanelRight />
      <span className="max-sm:hidden">Will GPT</span>
    </Button>
  );
}

/**
 * Will GPT, docked beside the admin page. A column of its own on desktop, so
 * the page stays usable and visibly updates as changes land; the whole screen
 * on a phone.
 */
export function WillGptRail() {
  const { open, setOpen, model, setModel, reset } = useWillGpt();
  if (!open) return null;

  return (
    <aside
      aria-label="Will GPT"
      className="bg-sidebar flex flex-col max-lg:fixed max-lg:inset-0 max-lg:z-50 lg:mt-2 lg:w-100 lg:shrink-0 lg:border-l"
    >
      <header className="flex h-14 shrink-0 items-center gap-1.5 border-b pr-2.5 pl-4">
        <h2 className={cn(cabin.className, "flex-1 text-xl font-semibold")}>
          Will GPT
        </h2>
        <Select
          value={model}
          onValueChange={(value) => {
            const option = WILL_GPT_MODELS.find((model) => model.id === value);
            if (option) setModel(option.id);
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label="Model"
            className="border-transparent bg-transparent shadow-none dark:bg-transparent"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {WILL_GPT_MODELS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon-sm" onClick={reset} title="New chat">
          <Plus />
          <span className="sr-only">New chat</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(false)}
          title="Close"
        >
          <X />
          <span className="sr-only">Close Will GPT</span>
        </Button>
      </header>
      <Thread />
      <Composer />
    </aside>
  );
}

function Thread() {
  const { messages, awaiting, draft, running, notice } = useWillGpt();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, awaiting, draft, notice]);

  const results = new Map(
    messages.flatMap((message) =>
      message.role === "tool" ? [[message.callId, message] as const] : [],
    ),
  );
  const awaitingCalls = messages
    .flatMap((message) =>
      message.role === "assistant" ? message.toolCalls : [],
    )
    .filter((call) => awaiting.includes(call.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 text-sm">
      {messages.length === 0 && !running ? (
        <p className="text-muted-foreground m-auto max-w-64 text-center leading-relaxed">
          Ask for changes anywhere in the admin. Deletes, and anything that
          emails people, wait for your approval.
        </p>
      ) : null}

      {messages.map((message, index) => {
        if (message.role === "user") {
          return (
            <p
              key={index}
              className="bg-muted max-w-[88%] self-end rounded-lg px-3 py-2.5 leading-relaxed whitespace-pre-wrap"
            >
              {message.text}
            </p>
          );
        }
        if (message.role === "tool") return null;
        const calls = message.toolCalls.filter(
          (call) => !awaiting.includes(call.id),
        );
        return (
          <div key={index} className="flex flex-col gap-3">
            {message.text ? <Markdown text={message.text} /> : null}
            {calls.length > 0 ? (
              <div className="flex flex-col border-l pl-3">
                {calls.map((call) => (
                  <CallRow
                    key={call.id}
                    call={call}
                    result={results.get(call.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      {awaitingCalls.length > 0 ? <Approval calls={awaitingCalls} /> : null}
      {draft ? <Markdown text={draft} /> : null}
      {running && !draft ? (
        <p className="text-muted-foreground">Working…</p>
      ) : null}
      {notice ? (
        <p role="status" className="text-destructive leading-relaxed">
          {notice}
        </p>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}

/** A tool call as the admin reads it: the model's own summary, and the procedure. */
function describeCall(call: WillGptToolCall): {
  summary: string;
  path: string;
  input?: unknown;
} {
  let args: unknown = null;
  try {
    args = JSON.parse(call.arguments || "{}");
  } catch {
    // Shown by name alone; the server reports the bad arguments.
  }
  if (call.name === "describe") {
    const parsed = describeArgsSchema.safeParse(args);
    return {
      summary: parsed.success
        ? `Look up ${parsed.data.paths.join(", ")}`
        : "Look up procedures",
      path: "describe",
    };
  }
  const parsed = callArgsSchema.safeParse(args);
  return parsed.success
    ? parsed.data
    : { summary: call.name, path: call.name, input: args };
}

const asJson = (value: unknown) => JSON.stringify(value, null, 2);

/** Tool output is JSON when it worked and a sentence when it did not. */
function formatOutput(output: string): string {
  try {
    return asJson(JSON.parse(output));
  } catch {
    return output;
  }
}

function CallRow({
  call,
  result,
}: {
  call: WillGptToolCall;
  result: ToolResult | undefined;
}) {
  const { summary, path, input } = describeCall(call);
  const isRead = call.name === "describe" || result?.risk === "read";

  return (
    <details className="group">
      <summary className="flex min-h-7 cursor-pointer list-none items-center gap-2 text-[13px] [&::-webkit-details-marker]:hidden">
        {!result ? (
          <Clock className="text-muted-foreground size-3.5 shrink-0" />
        ) : result.status === "ok" ? (
          <Check className="size-3.5 shrink-0 text-emerald-400" />
        ) : result.status === "declined" ? (
          <Ban className="text-muted-foreground size-3.5 shrink-0" />
        ) : (
          <X className="text-destructive size-3.5 shrink-0" />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            (isRead || result?.status === "declined") &&
              "text-muted-foreground",
          )}
        >
          {summary}
        </span>
        <span className="text-muted-foreground shrink-0 font-mono text-[11.5px]">
          {path}
        </span>
      </summary>
      <div className="mt-1 mb-2 flex flex-col gap-1.5">
        {input !== undefined ? <Code>{asJson(input)}</Code> : null}
        {result ? (
          <Code className={cn(result.status === "error" && "text-destructive")}>
            {formatOutput(result.output)}
          </Code>
        ) : null}
      </div>
    </details>
  );
}

/** The calls the run stopped for, with the exact input each will run with. */
function Approval({ calls }: { calls: WillGptToolCall[] }) {
  const { decide, running } = useWillGpt();

  return (
    <div
      role="alert"
      className="border-destructive/45 bg-destructive/[0.07] flex flex-col gap-2.5 rounded-lg border p-3"
    >
      <p className="text-destructive flex items-center gap-2 text-[13px] font-semibold">
        <TriangleAlert className="size-3.5" />
        Needs your approval
      </p>
      {calls.map((call) => {
        const { summary, path, input } = describeCall(call);
        return (
          <div key={call.id} className="flex flex-col gap-1.5">
            <div>
              <p className="font-semibold">{summary}</p>
              <p className="text-muted-foreground font-mono text-[11.5px]">
                {path}
              </p>
            </div>
            {input !== undefined ? <Code>{asJson(input)}</Code> : null}
          </div>
        );
      })}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={running}
          onClick={() => decide(false)}
        >
          Decline
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={running}
          onClick={() => decide(true)}
        >
          {calls.length > 1 ? `Approve ${calls.length}` : "Approve"}
        </Button>
      </div>
    </div>
  );
}

function Code({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "max-h-60 overflow-auto rounded-md border bg-white/[0.04] px-2.5 py-2 font-mono text-xs leading-normal text-neutral-300",
        className,
      )}
    >
      {children}
    </pre>
  );
}

const MARKDOWN: Components = {
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5 leading-relaxed">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5 leading-relaxed">{children}</ol>
  ),
  code: ({ children }) => (
    <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-xs">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-auto rounded-md border bg-white/[0.04] p-2.5">
      {children}
    </pre>
  ),
  // Admin links stay in the app, so the chat and the rail stay open.
  a: ({ href = "", children }) => {
    const className =
      "underline decoration-white/35 underline-offset-3 hover:decoration-white";
    return href.startsWith("/") ? (
      <Link href={href} className={className}>
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  },
};

function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      <ReactMarkdown components={MARKDOWN}>{text}</ReactMarkdown>
    </div>
  );
}

function Composer() {
  const { send, stop, running, awaiting } = useWillGpt();
  const [text, setText] = useState("");
  const locked = awaiting.length > 0;

  const submit = () => {
    if (!text.trim() || running || locked) return;
    send(text);
    setText("");
  };

  return (
    <form
      className="shrink-0 border-t px-4 pt-3 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div
        className={cn(
          "border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 rounded-lg border px-3 pt-2.5 pb-2 focus-within:ring-[3px]",
          locked && "opacity-55",
        )}
      >
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          disabled={locked}
          rows={2}
          aria-label="Message Will GPT"
          placeholder={
            locked
              ? "Approve or decline above to carry on"
              : "Ask Will GPT to change something"
          }
          className="placeholder:text-muted-foreground field-sizing-content max-h-48 min-h-10 w-full resize-none bg-transparent text-sm leading-normal outline-none"
        />
        <div className="mt-1.5 flex justify-end">
          {running ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={stop}
              title="Stop"
            >
              <Square className="size-3.5" />
              <span className="sr-only">Stop</span>
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-sm"
              disabled={!text.trim() || locked}
              title="Send"
            >
              <ArrowUp />
              <span className="sr-only">Send</span>
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
