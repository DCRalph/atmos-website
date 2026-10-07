"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { z } from "zod";

import { api } from "~/trpc/react";
import {
  WILL_GPT_MODELS,
  type WillGptMessage,
  type WillGptModelId,
} from "~/lib/will-gpt";

/**
 * Will GPT's side of the browser: the conversation on screen, the run in
 * flight, and whether the rail is open. Mounted once in the admin layout, so a
 * chat carries on across admin pages.
 *
 * The conversation itself is the server's (see `~/lib/will-gpt`). The browser
 * remembers only which one is open, and shows a run's events as they arrive;
 * after a reload, a stop or an error it reads the conversation back rather than
 * trusting what it had.
 */

const STORAGE_KEY = "will-gpt";

const DEFAULT_MODEL: WillGptModelId = WILL_GPT_MODELS[0].id;

/** What is saved. Anything unreadable, from an older shape, falls back. */
const savedSchema = z.object({
  open: z.boolean().catch(false),
  model: z.enum(WILL_GPT_MODELS.map((model) => model.id)).catch(DEFAULT_MODEL),
  conversationId: z.uuid().nullable().catch(null),
});

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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WillGptMessage[]>([]);
  const [awaiting, setAwaiting] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  /** The open conversation, for async work that outlives a render. */
  const conversationRef = useRef<string | null>(null);

  /** Show the conversation as the server has it. */
  const readBack = async (id: string) => {
    const saved = await utils.client.willGpt.byId.query({ id });
    // A newer chat was started while this was loading.
    if (conversationRef.current !== id) return;
    setMessages(saved?.messages ?? []);
    setAwaiting(saved?.awaiting ?? []);
  };

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
    const id =
      (parsed.success ? parsed.data.conversationId : null) ??
      crypto.randomUUID();
    if (parsed.success) {
      setOpen(parsed.data.open);
      setModel(parsed.data.model);
    }
    conversationRef.current = id;
    setConversationId(id);
    setLoaded(true);
    void readBack(id);
    // Once, on mount; `readBack` only reads refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ open, model, conversationId }),
    );
  }, [loaded, open, model, conversationId]);

  const run = async (
    turn: { message: string } | { decisions: Record<string, boolean> },
  ) => {
    const id = conversationRef.current;
    if (!id) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setNotice(null);
    setAwaiting([]);
    setDraft("");

    let failed = false;
    let changed = false;
    try {
      const events = await utils.client.willGpt.run.mutate(
        { conversationId: id, model, page: pathname, ...turn },
        { signal: controller.signal },
      );
      for await (const event of events) {
        // Started over with "New chat" while this was still streaming.
        if (controllerRef.current !== controller) break;
        switch (event.type) {
          case "delta":
            setDraft((draft) => draft + event.text);
            break;
          case "message":
            setDraft("");
            setMessages((messages) => [...messages, event.message]);
            if (
              event.message.role === "tool" &&
              event.message.status === "ok" &&
              event.message.risk !== "read"
            ) {
              changed = true;
            }
            break;
          case "awaiting":
            setAwaiting(event.callIds);
            break;
          case "notice":
            setNotice(event.text);
            break;
        }
      }
    } catch (error) {
      failed = true;
      if (!controller.signal.aborted) {
        setNotice(error instanceof Error ? error.message : "Will GPT stopped.");
      }
    } finally {
      // A reset has already cleared this run's state; leave it cleared.
      if (controllerRef.current === controller) {
        setDraft("");
        setRunning(false);
        controllerRef.current = null;
        // What arrived before a stop or an error may not be all that ran.
        if (failed) void readBack(id);
      }
      // Whatever page is open may be showing what just changed. A stopped
      // run may have changed things too.
      if (changed || failed) {
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
      setMessages((messages) => [...messages, { role: "user", text: trimmed }]);
      void run({ message: trimmed });
    },
    decide: (approved) => {
      if (running || awaiting.length === 0) return;
      void run({
        decisions: Object.fromEntries(awaiting.map((id) => [id, approved])),
      });
    },
    stop: () => controllerRef.current?.abort(),
    reset: () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      const id = crypto.randomUUID();
      conversationRef.current = id;
      setConversationId(id);
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
