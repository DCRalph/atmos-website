"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { z } from "zod";

import { api } from "~/trpc/react";
import {
  WILL_GPT_MODELS,
  willGptMessageSchema,
  type WillGptMessage,
  type WillGptModelId,
} from "~/lib/will-gpt";

/**
 * Will GPT's side of the browser: the conversation, the run in flight, and
 * whether the rail is open. Mounted once in the admin layout, so a chat
 * carries on across admin pages, and saved to localStorage so it survives a
 * reload until the admin starts a new one.
 */

const STORAGE_KEY = "will-gpt";

const DEFAULT_MODEL: WillGptModelId = WILL_GPT_MODELS[0].id;

/** What is saved. Anything unreadable, from an older shape, falls back to empty. */
const savedSchema = z.object({
  open: z.boolean().catch(false),
  model: z.enum(WILL_GPT_MODELS.map((model) => model.id)).catch(DEFAULT_MODEL),
  messages: z.array(willGptMessageSchema).catch([]),
  awaiting: z.array(z.string()).catch([]),
});

const INTERRUPTED =
  "Interrupted before a result came back. It may have run; check before trying again.";

/**
 * Close off calls a run left without a result, other than the ones waiting
 * for approval. The server never runs a call twice that has a result, so this
 * is what stops an interrupted call being repeated by the next run.
 */
function closeOff(
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

type WillGptContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  model: WillGptModelId;
  setModel: (model: WillGptModelId) => void;
  messages: WillGptMessage[];
  /** Tool call ids waiting for the admin's approval. */
  awaiting: string[];
  /** The assistant message being written, as it streams in. */
  draft: string;
  running: boolean;
  /** Why the last run stopped short, when it did. */
  notice: string | null;
  send: (text: string) => void;
  /** Answer every call in `awaiting` at once. */
  decide: (approved: boolean) => void;
  stop: () => void;
  reset: () => void;
};

const WillGptContext = createContext<WillGptContextValue | null>(null);

export function WillGptProvider({ children }: { children: React.ReactNode }) {
  const utils = api.useUtils();
  const router = useRouter();
  const pathname = usePathname();

  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState<WillGptModelId>(DEFAULT_MODEL);
  const [messages, setMessages] = useState<WillGptMessage[]>([]);
  const [awaiting, setAwaiting] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Read after mount rather than during render, so the server render and the
  // first client render agree.
  useEffect(() => {
    let saved: unknown = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    } catch {
      // Unreadable is the same as nothing saved.
    }
    const parsed = savedSchema.safeParse(saved ?? {});
    if (parsed.success) {
      setOpen(parsed.data.open);
      setModel(parsed.data.model);
      setMessages(closeOff(parsed.data.messages, parsed.data.awaiting));
      setAwaiting(parsed.data.awaiting);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ open, model, messages, awaiting }),
    );
  }, [loaded, open, model, messages, awaiting]);

  const run = async (
    start: WillGptMessage[],
    decisions: Record<string, boolean> = {},
  ) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setNotice(null);
    setAwaiting([]);
    setDraft("");

    let transcript = start;
    let text = "";
    let waitingOn: string[] = [];
    let changed = false;
    try {
      const events = await utils.client.willGpt.run.mutate(
        { model, messages: start, decisions, page: pathname },
        { signal: controller.signal },
      );
      for await (const event of events) {
        // Started over with "New chat" while this was still streaming.
        if (controllerRef.current !== controller) break;
        switch (event.type) {
          case "delta":
            text += event.text;
            setDraft(text);
            break;
          case "message":
            text = "";
            setDraft("");
            transcript = [...transcript, event.message];
            setMessages(transcript);
            if (
              event.message.role === "tool" &&
              event.message.status === "ok" &&
              event.message.risk !== "read"
            ) {
              changed = true;
            }
            break;
          case "awaiting":
            waitingOn = event.callIds;
            setAwaiting(event.callIds);
            break;
          case "notice":
            setNotice(event.text);
            break;
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setNotice(error instanceof Error ? error.message : "Will GPT stopped.");
      }
    } finally {
      // A reset has already cleared this run's state; leave it cleared.
      if (controllerRef.current === controller) {
        // Keep what was said before a stop, and close off what was left open.
        if (text) {
          transcript = [
            ...transcript,
            { role: "assistant", text, toolCalls: [] },
          ];
        }
        setMessages(closeOff(transcript, waitingOn));
        setDraft("");
        setRunning(false);
        controllerRef.current = null;
      }
      // Whatever page is open may be showing what just changed.
      if (changed) {
        void utils.invalidate();
        router.refresh();
      }
    }
  };

  const value: WillGptContextValue = {
    open,
    setOpen,
    model,
    setModel,
    messages,
    awaiting,
    draft,
    running,
    notice,
    send: (text) => {
      const trimmed = text.trim();
      if (!trimmed || running || awaiting.length > 0) return;
      const next: WillGptMessage[] = [
        ...messages,
        { role: "user", text: trimmed },
      ];
      setMessages(next);
      void run(next);
    },
    decide: (approved) => {
      if (running || awaiting.length === 0) return;
      void run(
        messages,
        Object.fromEntries(awaiting.map((id) => [id, approved])),
      );
    },
    stop: () => controllerRef.current?.abort(),
    reset: () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setRunning(false);
      setMessages([]);
      setAwaiting([]);
      setNotice(null);
      setDraft("");
    },
  };

  return (
    <WillGptContext.Provider value={value}>{children}</WillGptContext.Provider>
  );
}

export function useWillGpt(): WillGptContextValue {
  const ctx = useContext(WillGptContext);
  if (!ctx) throw new Error("useWillGpt must be used within a WillGptProvider");
  return ctx;
}
