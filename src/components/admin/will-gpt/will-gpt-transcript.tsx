"use client";

import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Ban, Check, Clock, TriangleAlert, X } from "lucide-react";

import { cn } from "~/lib/utils";
import { AttachmentPreview } from "./will-gpt-attachment";
import {
  callArgsSchema,
  describeArgsSchema,
  parseToolArgs,
  type WillGptMessage,
  type WillGptToolCall,
} from "~/lib/will-gpt";

/**
 * A Will GPT conversation as the admin reads it. The rail renders it live and
 * the history page renders it after the fact, so a conversation looks the same
 * in both.
 */

type ToolResult = Extract<WillGptMessage, { role: "tool" }>;

export function Transcript({
  messages,
  awaiting,
  hideAwaiting = false,
}: {
  messages: WillGptMessage[];
  /** Tool call ids waiting for approval. */
  awaiting: string[];
  /** The rail shows waiting calls in its approval box instead. */
  hideAwaiting?: boolean;
}) {
  const results = new Map(
    messages.flatMap((message) =>
      message.role === "tool" ? [[message.callId, message] as const] : [],
    ),
  );

  return messages.map((message, index) => {
    if (message.role === "user") {
      return (
        <div
          key={index}
          className="bg-muted max-w-[88%] self-end rounded-lg px-3 py-2.5 leading-relaxed whitespace-pre-wrap"
        >
          {message.attachments?.length ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {message.attachments.map((file) => (
                <a
                  key={file.id}
                  href={`/api/media/${file.id}?download=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Download ${file.name}`}
                >
                  <AttachmentPreview {...file} />
                </a>
              ))}
            </div>
          ) : null}
          <p>{message.text}</p>
        </div>
      );
    }
    if (message.role === "tool") return null;
    const calls = hideAwaiting
      ? message.toolCalls.filter((call) => !awaiting.includes(call.id))
      : message.toolCalls;
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
                waiting={awaiting.includes(call.id)}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  });
}

/** A tool call as the admin reads it: the model's own summary, and the procedure. */
export function describeCall(call: WillGptToolCall): {
  summary: string;
  path: string;
  input?: unknown;
} {
  if (call.name === "describe") {
    const args = parseToolArgs(describeArgsSchema, call.arguments);
    return {
      summary: args.ok
        ? `Look up ${args.data.paths.join(", ")}`
        : "Look up procedures",
      path: "describe",
    };
  }
  const args = parseToolArgs(callArgsSchema, call.arguments);
  // Unreadable arguments are shown raw; the server reports what was wrong.
  return args.ok
    ? args.data
    : { summary: call.name, path: call.name, input: call.arguments };
}

export const asJson = (value: unknown) => JSON.stringify(value, null, 2);

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
  waiting,
}: {
  call: WillGptToolCall;
  result: ToolResult | undefined;
  waiting: boolean;
}) {
  const { summary, path, input } = describeCall(call);
  const isRead = call.name === "describe" || result?.risk === "read";

  return (
    <details className="group">
      <summary className="flex min-h-7 cursor-pointer list-none items-center gap-2 text-[13px] [&::-webkit-details-marker]:hidden">
        {waiting ? (
          <TriangleAlert className="text-destructive size-3.5 shrink-0" />
        ) : !result ? (
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
          {waiting ? (
            <span className="text-destructive"> · waiting for approval</span>
          ) : null}
        </span>
        <span className="text-muted-foreground max-w-[45%] truncate font-mono text-[11.5px]">
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

export function Code({
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

/** GitHub flavoured markdown, so the tables and task lists models write render. */
const MARKDOWN: Components = {
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  h1: ({ children }) => (
    <h3 className="mt-1 text-base font-semibold">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mt-1 text-base font-semibold">{children}</h3>
  ),
  h3: ({ children }) => <h4 className="mt-1 font-semibold">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-1 font-semibold">{children}</h4>,
  strong: ({ children }) => (
    <strong className="text-foreground font-semibold">{children}</strong>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5 leading-relaxed">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5 leading-relaxed">{children}</ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="text-muted-foreground flex flex-col gap-2 border-l-2 pl-3">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-1" />,
  code: ({ children }) => (
    <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-xs">
      {children}
    </code>
  ),
  // Fenced blocks drop the inline code chip.
  pre: ({ children }) => (
    <pre className="overflow-auto rounded-md border bg-white/[0.04] p-2.5 [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-[13px] tabular-nums">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="text-muted-foreground border-b bg-white/[0.03] text-xs">
      {children}
    </thead>
  ),
  tr: ({ children }) => (
    <tr className="border-b last:border-b-0">{children}</tr>
  ),
  th: ({ children, style }) => (
    <th style={style} className="px-2.5 py-1.5 font-medium whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="px-2.5 py-1.5">
      {children}
    </td>
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

export function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
