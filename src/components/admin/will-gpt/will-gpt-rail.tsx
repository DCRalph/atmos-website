"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, History, Plus, Square, TriangleAlert, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useIsMobile } from "~/hooks/use-mobile";
import { cabin } from "~/lib/fonts";
import { cn } from "~/lib/utils";
import { WILL_GPT_MODELS, type WillGptToolCall } from "~/lib/will-gpt";
import { useWillGpt } from "./will-gpt-provider";
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
      aria-pressed={open}
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

/** Desktop opens the column from the edge; a phone slides the sheet up. */
const RAIL_MOTION = {
  desktop: { closed: { width: 0 }, open: { width: "25rem" } },
  mobile: { closed: { y: "100%" }, open: { y: 0 } },
} as const;

/**
 * Will GPT, docked beside the admin page. A column of its own on desktop, so
 * the page stays usable and visibly updates as changes land; the whole screen
 * on a phone.
 */
export function WillGptRail() {
  const { open } = useWillGpt();
  const device = useIsMobile() ? "mobile" : "desktop";
  const { closed, open: opened } = RAIL_MOTION[device];

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key={device}
          aria-label="Will GPT"
          initial={closed}
          animate={opened}
          exit={closed}
          transition={{ type: "spring", stiffness: 400, damping: 40 }}
          className="bg-sidebar flex flex-col overflow-hidden max-lg:fixed max-lg:inset-0 max-lg:z-50 lg:mt-2 lg:shrink-0 lg:border-l"
        >
          {/* Fixed width so the content doesn't reflow while the column grows. */}
          <div className="flex min-h-0 flex-1 flex-col lg:w-100">
            <RailHeader />
            <Thread />
            <Composer />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function RailHeader() {
  const { setOpen, model, setModel, reset } = useWillGpt();
  return (
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
  const { messages, awaiting, draft, running, notice } = useWillGpt();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, awaiting, draft, notice]);

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

      <Transcript messages={messages} awaiting={awaiting} hideAwaiting />

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
