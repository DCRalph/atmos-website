"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import {
  ArrowUp,
  History,
  Paperclip,
  Plus,
  Square,
  TriangleAlert,
  X,
} from "lucide-react";

import { toast } from "sonner";

import { presetConstraints } from "~/lib/uploads/presets";
import {
  acceptAttribute,
  resolveMimeType,
  validateBatch,
} from "~/lib/uploads/validate";
import { AttachmentPreview } from "./will-gpt-attachment";
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
import { WILL_GPT_MODELS, type WillGptToolCall } from "~/lib/will-gpt";
import { CHAT_WIDTH, useWillGpt } from "./will-gpt-provider";
import {
  asJson,
  Code,
  describeCall,
  Markdown,
  Transcript,
} from "./will-gpt-transcript";

/**
 * The header button that opens and closes the rail. An outline button with a
 * gradient four point star and a soft glow behind it that grows on hover;
 * open tints the button pink to purple. Styled as `.will-gpt-toggle` in
 * globals.css.
 */
export function WillGptToggle() {
  const { open, setOpen } = useWillGpt();
  return (
    <Button
      variant="outline"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-controls="will-gpt-panel"
      aria-label="Will GPT"
      className="will-gpt-toggle hover:text-foreground"
    >
      <span aria-hidden className="will-gpt-halo" />
      <Star />
      <span className="relative max-sm:hidden">Will GPT</span>
    </Button>
  );
}

/** The four point star, filled orange to pink to purple. */
function Star() {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" fill={`url(#${id})`} className="relative">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a3d" />
          <stop offset="0.5" stopColor="#ff4fd8" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <path d="M12 1C12.5 7 17 11.5 23 12 17 12.5 12.5 17 12 23 11.5 17 7 12.5 1 12 7 11.5 11.5 7 12 1Z" />
    </svg>
  );
}

/**
 * Wraps the admin shell. On desktop, opening Will GPT zooms the whole admin out
 * into a lit card on the left and the chat fills the black beside it; on a
 * phone the chat slides up over the page. Both are CSS only (`.will-gpt-stage`
 * in globals.css), so the first paint matches the server render.
 *
 * The chat stays mounted while closed, inert, so a run in flight keeps
 * streaming into it.
 */
export function WillGptStage({ children }: { children: React.ReactNode }) {
  const { open, setOpen, width, conversationId } = useWillGpt();
  const panelRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      (
        panelRef.current?.querySelector<HTMLElement>(
          "textarea:not(:disabled)",
        ) ??
        panelRef.current?.querySelector<HTMLElement>("button:not(:disabled)")
      )?.focus();
    } else if (
      document.activeElement === document.body ||
      panelRef.current?.contains(document.activeElement)
    ) {
      returnFocus.current?.focus();
    }
  }, [open]);
  const stageRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={stageRef}
      // A saved width gives way on a smaller screen, so the page keeps its room.
      style={
        {
          "--will-gpt-width": `min(${width}px, max(${CHAT_WIDTH.min}px, 100vw - ${MIN_PAGE_WIDTH}px))`,
        } as React.CSSProperties
      }
      className="group/stage fixed inset-0 overflow-hidden bg-black data-resizing:cursor-col-resize data-resizing:select-none"
    >
      <div data-open={open || undefined} className="will-gpt-stage">
        {children}
      </div>
      <aside
        id="will-gpt-panel"
        ref={panelRef}
        aria-label="Will GPT"
        inert={!open}
        onKeyDown={(event) => {
          if (event.defaultPrevented) return;
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
          if (event.key !== "Tab" || window.innerWidth >= 1024) return;
          const controls = Array.from(
            panelRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), a[href], textarea:not(:disabled), [tabindex="0"]',
            ) ?? [],
          ).filter((element) => element.getClientRects().length > 0);
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        className={cn(
          "flex flex-col transition-[opacity,translate] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
          "max-lg:bg-sidebar max-lg:fixed max-lg:inset-0 max-lg:z-50",
          "lg:absolute lg:inset-y-0 lg:right-0 lg:w-(--will-gpt-width) lg:pl-3",
          open
            ? "lg:opacity-100 lg:delay-150"
            : "max-lg:translate-y-full lg:translate-x-6 lg:opacity-0",
        )}
      >
        <ResizeHandle stageRef={stageRef} />
        <RailHeader />
        <Thread key={`thread:${conversationId}`} />
        <Composer key={`composer:${conversationId}`} />
      </aside>
    </div>
  );
}

/** The page always keeps at least this much of the screen. */
const MIN_PAGE_WIDTH = 640;

const clampWidth = (width: number) =>
  Math.round(
    Math.max(
      CHAT_WIDTH.min,
      Math.min(width, CHAT_WIDTH.max, window.innerWidth - MIN_PAGE_WIDTH),
    ),
  );

/**
 * Drags the gap between the page and the chat to resize the chat, desktop
 * only. While dragging it writes the width straight onto the stage, with the
 * zoom transitions off, and saves it once on release. Arrow keys nudge it and
 * a double click puts it back.
 */
function ResizeHandle({
  stageRef,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { width, setWidth } = useWillGpt();
  /** The width being dragged to; null until the edge actually moves. */
  const live = useRef<number | null>(null);

  const release = () => {
    stageRef.current?.removeAttribute("data-resizing");
    if (live.current !== null) setWidth(live.current);
    live.current = null;
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize Will GPT"
      aria-valuemin={CHAT_WIDTH.min}
      aria-valuemax={CHAT_WIDTH.max}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        stageRef.current?.setAttribute("data-resizing", "");
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        live.current = clampWidth(window.innerWidth - event.clientX);
        stageRef.current?.style.setProperty(
          "--will-gpt-width",
          `${live.current}px`,
        );
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onDoubleClick={() => setWidth(CHAT_WIDTH.initial)}
      onKeyDown={(event) => {
        const step = { ArrowLeft: 24, ArrowRight: -24 }[event.key];
        if (!step) return;
        event.preventDefault();
        setWidth(clampWidth(width + step));
      }}
      className="absolute inset-y-0 left-0 z-10 w-3 cursor-col-resize outline-none after:absolute after:inset-y-3 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded-full after:bg-[rgb(255_79_216/0.7)] after:opacity-0 after:transition-opacity group-data-resizing/stage:after:opacity-100 hover:after:opacity-100 focus-visible:after:opacity-100 max-lg:hidden"
    />
  );
}

function RailHeader() {
  const { setOpen, model, setModel, reset, running } = useWillGpt();
  return (
    <header className="flex h-14 shrink-0 items-center gap-1.5 pr-2.5 pl-4 max-lg:border-b">
      <span aria-hidden className="flex size-4.5 [&_svg]:size-full">
        <Star />
      </span>
      <h2
        className={cn(
          cabin.className,
          "flex-1 text-xl font-semibold whitespace-nowrap",
        )}
      >
        Will GPT
      </h2>
      <Select
        disabled={running}
        value={model}
        onValueChange={(value) => {
          const option = WILL_GPT_MODELS.find((model) => model.id === value);
          if (option) setModel(option.id);
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label="Model"
          className="min-w-0 border-transparent bg-transparent shadow-none dark:bg-transparent"
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
      <Button variant="ghost" size="icon-sm" asChild title="History">
        <Link href="/admin/will-gpt">
          <History />
          <span className="sr-only">Will GPT history</span>
        </Link>
      </Button>
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
  );
}

function Thread() {
  const { messages, awaiting, draft, running, notice, ready, reload } =
    useWillGpt();
  const threadRef = useRef<HTMLDivElement>(null);

  const pinned = useRef(true);
  const previousUserCount = useRef(0);

  // Scrolls the thread itself: scrollIntoView would also scroll the stage's
  // clipped ancestors to reveal the chat while it is closed.
  useEffect(() => {
    const thread = threadRef.current;
    const userCount = messages.filter(
      (message) => message.role === "user",
    ).length;
    if (thread && (pinned.current || userCount > previousUserCount.current)) {
      thread.scrollTop = thread.scrollHeight;
      pinned.current = true;
    }
    previousUserCount.current = userCount;
  }, [messages, awaiting, draft, notice, running, ready]);

  const awaitingCalls = messages
    .flatMap((message) =>
      message.role === "assistant" ? message.toolCalls : [],
    )
    .filter((call) => awaiting.includes(call.id));

  return (
    <div
      ref={threadRef}
      role="log"
      aria-label="Conversation"
      aria-busy={running || !ready}
      onScroll={(event) => {
        const thread = event.currentTarget;
        pinned.current =
          thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
      }}
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 text-sm"
    >
      {messages.length === 0 && !running && ready ? (
        <p className="text-muted-foreground m-auto max-w-64 text-center leading-relaxed">
          Ask for changes anywhere in the admin. Deletes, and anything that
          emails people, wait for your approval.
        </p>
      ) : null}

      <Transcript messages={messages} awaiting={awaiting} hideAwaiting />

      {awaitingCalls.length > 0 ? <Approval calls={awaitingCalls} /> : null}
      {draft ? <Markdown text={draft} /> : null}
      {running && !draft ? (
        <p className="text-muted-foreground">Working…</p>
      ) : null}
      {!ready && !running && !notice ? (
        <p className="text-muted-foreground">Loading conversation…</p>
      ) : null}
      {notice ? (
        <p role="status" className="text-destructive leading-relaxed">
          {notice}
        </p>
      ) : null}
      {!ready && notice && !running ? (
        <Button variant="outline" size="sm" onClick={reload}>
          Reload conversation
        </Button>
      ) : null}
    </div>
  );
}

/** The calls the run stopped for, with the exact input each will run with. */
function Approval({ calls }: { calls: WillGptToolCall[] }) {
  const { decide, running, ready } = useWillGpt();

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
          disabled={running || !ready}
          onClick={() => decide(false)}
        >
          Decline
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={running || !ready}
          onClick={() => decide(true)}
        >
          {calls.length > 1 ? `Approve ${calls.length}` : "Approve"}
        </Button>
      </div>
    </div>
  );
}

function Composer() {
  const {
    send,
    stop,
    running,
    awaiting,
    conversationId,
    ready,
    input: text,
    setInput: setText,
    files,
    setFiles,
    uploadProgress,
  } = useWillGpt();
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const constraints = presetConstraints("willGptAttachment");
  const locked = awaiting.length > 0;
  const busy = running;

  const addFiles = (incoming: File[]) => {
    if (busy || locked || !ready) return;
    const { accepted, rejected } = validateBatch(incoming, constraints, {
      count: files.length,
      size: files.reduce((size, file) => size + file.size, 0),
    });
    for (const { reason } of rejected) toast.error(reason);
    setFiles((files) => [...files, ...accepted]);
  };

  const submit = () => {
    if (!text.trim() || busy || locked || !conversationId || !ready) return;
    send();
    textareaRef.current?.focus();
  };

  return (
    <form
      className="relative isolate shrink-0 px-4 pt-3 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        addFiles(Array.from(event.dataTransfer.files));
      }}
      onPaste={(event) => {
        if (!event.clipboardData.files.length) return;
        event.preventDefault();
        addFiles(Array.from(event.clipboardData.files));
      }}
    >
      <span aria-hidden className="will-gpt-prompt-glow" />
      <div
        className={cn(
          "will-gpt-prompt rounded-lg border px-3 pt-2.5 pb-2",
          locked && "opacity-55",
        )}
      >
        {files.length > 0 ? (
          <div className="mb-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto pt-1 pr-1">
            {files.map((file, index) => (
              <div key={index} className="relative">
                <AttachmentPreview
                  file={file}
                  name={file.name}
                  mimeType={resolveMimeType(file.name, file.type)}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setFiles((files) => files.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove ${file.name}`}
                  className="bg-muted absolute -top-1 -right-1 grid size-5 place-items-center rounded-full border disabled:opacity-50"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          value={text}
          maxLength={20_000}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void submit();
            }
          }}
          disabled={locked || !ready}
          rows={2}
          aria-label="Message Will GPT"
          placeholder={
            locked
              ? "Approve or decline above to carry on"
              : "Ask Will GPT to change something"
          }
          className="placeholder:text-muted-foreground field-sizing-content max-h-48 min-h-10 w-full resize-none bg-transparent text-sm leading-normal outline-none"
        />
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={`${acceptAttribute(constraints.accept)},.txt,.md,.markdown,.csv,.tsv,.json,.xml,.yaml,.yml,.log`}
          disabled={busy || locked || !ready || !conversationId}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <div className="mt-1.5 flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => inputRef.current?.click()}
            disabled={
              busy ||
              locked ||
              !conversationId ||
              !ready ||
              files.length >= constraints.maxFiles
            }
            title="Attach images, PDFs or text files (25 MB each, 8 files max)"
            aria-label="Attach files"
          >
            <Paperclip />
          </Button>
          <span role="status" className="text-muted-foreground flex-1 text-xs">
            {text.length > 20_000
              ? "Message is too long (20,000 characters max)"
              : uploadProgress !== null
                ? `Uploading ${uploadProgress}%`
                : files.length
                  ? `${files.length} file${files.length === 1 ? "" : "s"} attached`
                  : "Images, PDFs, text"}
          </span>
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
              disabled={
                !text.trim() || locked || busy || !ready || !conversationId
              }
              title="Send"
              className="bg-linear-120 from-[#ff8a3d] via-[#ff4fd8] to-[#a855f7] text-white"
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
