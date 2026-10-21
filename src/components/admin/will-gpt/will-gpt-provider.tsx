"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { useUpload } from "~/hooks/use-upload";
import {
  WILL_GPT_MODELS,
  type WillGptMessage,
  type WillGptModelId,
  type WillGptRunInput,
} from "~/lib/will-gpt";
import {
  CHAT_WIDTH,
  readChatSession,
  recoverChatSession,
  writeChatSession,
  type WillGptSession,
} from "~/lib/will-gpt-session";

export { CHAT_WIDTH };

type WillGptContextValue = {
  conversationId: string | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  model: WillGptModelId;
  setModel: (model: WillGptModelId) => void;
  width: number;
  setWidth: (width: number) => void;
  messages: WillGptMessage[];
  awaiting: string[];
  /** The assistant text being streamed. The composer has its own saved input. */
  draft: string;
  input: string;
  setInput: (text: string) => void;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  uploadProgress: number | null;
  ready: boolean;
  running: boolean;
  notice: string | null;
  send: () => void;
  decide: (approved: boolean) => void;
  stop: () => void;
  reset: () => void;
  reload: () => void;
};

const WillGptContext = createContext<WillGptContextValue | null>(null);

/** Mounted in the admin layout so navigation and closing the rail keep a run alive. */
export function WillGptProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) {
  const utils = api.useUtils();
  const client = utils.client;
  const router = useRouter();
  const pathname = usePathname();
  // Do not share a previous admin's conversation or unsent text after switching accounts.
  const storageKey = `will-gpt:${userId}`;
  const [session, setSession] = useState<WillGptSession | null>(null);
  const sessionRef = useRef<WillGptSession | null>(null);
  const [messages, setMessages] = useState<WillGptMessage[]>([]);
  const [awaiting, setAwaiting] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [files, setFilesState] = useState<File[]>([]);
  const filesRef = useRef<File[]>([]);
  const pendingFiles = useRef<File[]>([]);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const loadVersion = useRef(0);
  const uploader = useUpload("willGptAttachment", {
    onError: (message) => toast.error(message),
  });

  // Write synchronously with user actions, including clearing the input before any await.
  const updateSession = useCallback(
    (patch: Partial<WillGptSession>) => {
      if (!sessionRef.current) return;
      const next = { ...sessionRef.current, ...patch };
      sessionRef.current = next;
      setSession(next);
      try {
        writeChatSession(localStorage, storageKey, next);
      } catch {
        /* Storage may be disabled. */
      }
    },
    [storageKey],
  );

  const setFiles = useCallback<React.Dispatch<React.SetStateAction<File[]>>>(
    (next) => {
      const selected =
        typeof next === "function" ? next(filesRef.current) : next;
      filesRef.current = selected;
      setFilesState(selected);
      updateSession({ fileNames: selected.map((file) => file.name) });
    },
    [updateSession],
  );

  /** Reads are versioned so stale loads cannot overwrite a new chat or an active run. */
  const readBack = useCallback(
    async (reason?: string) => {
      const id = sessionRef.current?.conversationId;
      if (!id) return;
      const version = ++loadVersion.current;
      readyRef.current = false;
      setReady(false);
      try {
        let saved = await client.willGpt.byId.query({ id });
        if (
          version !== loadVersion.current ||
          sessionRef.current?.conversationId !== id
        )
          return;
        if (saved && saved.user?.id !== userId) {
          // Legacy storage was shared between admins. Keep another admin's chat out of this panel.
          updateSession({
            conversationId: crypto.randomUUID(),
            input: "",
            pending: null,
            responding: false,
            fileNames: [],
          });
          saved = null;
        }
        const hadPending = !!sessionRef.current.pending;
        const wasResponding = sessionRef.current.responding;
        const haveFiles =
          pendingFiles.current.length > 0 || filesRef.current.length > 0;
        const recovered = recoverChatSession(
          sessionRef.current,
          saved?.messages ?? [],
        );
        updateSession(recovered.session);
        if (hadPending) {
          if (!recovered.received && pendingFiles.current.length)
            setFiles(pendingFiles.current);
          pendingFiles.current = [];
        }
        setMessages(saved?.messages ?? []);
        setAwaiting(saved?.awaiting ?? []);
        setNotice(
          [
            reason ??
              (hadPending || wasResponding
                ? recovered.received || !hadPending
                  ? "Reply interrupted. Saved messages are restored. Check any changes before trying again."
                  : "Your message was not received. It has been restored below."
                : null),
            (recovered.missingFiles ||
              recovered.session.fileNames.length > 0) &&
            !haveFiles
              ? "Reattach your files before sending again."
              : null,
          ]
            .filter(Boolean)
            .join(" ") || null,
        );
        readyRef.current = true;
        setReady(true);
        return recovered;
      } catch (error) {
        if (
          version !== loadVersion.current ||
          sessionRef.current?.conversationId !== id
        )
          return;
        setNotice(
          error instanceof Error
            ? error.message
            : "Could not load the conversation. Reload it before sending.",
        );
      }
    },
    [client, setFiles, updateSession, userId],
  );

  useEffect(() => {
    let saved: WillGptSession;
    // Accessing localStorage itself can throw, before getItem is even called.
    try {
      const key =
        localStorage.getItem(storageKey) === null ? "will-gpt" : storageKey;
      saved = readChatSession(localStorage, key);
    } catch {
      saved = readChatSession({ getItem: () => null }, storageKey);
    }
    sessionRef.current = saved;
    updateSession(saved);
    void readBack();
    const interrupt = () => controllerRef.current?.abort();
    const reconnect = () => {
      if (!controllerRef.current) void readBack();
    };
    const visible = () => {
      if (document.visibilityState === "visible") reconnect();
    };
    window.addEventListener("pagehide", interrupt);
    window.addEventListener("focus", reconnect);
    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", visible);
    const invalidateLoads = () => {
      ++loadVersion.current;
    };
    return () => {
      invalidateLoads();
      readyRef.current = false;
      sessionRef.current = null;
      controllerRef.current?.abort();
      controllerRef.current = null;
      window.removeEventListener("pagehide", interrupt);
      window.removeEventListener("focus", reconnect);
      window.removeEventListener("online", reconnect);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [readBack, storageKey, updateSession]);

  const run = async (
    turn: Pick<WillGptRunInput, "message" | "messageId" | "decisions">,
    selected: File[] = [],
  ) => {
    const current = sessionRef.current;
    // The ref locks synchronously, before React renders a disabled submit/approval button.
    if (!current || !readyRef.current || controllerRef.current) return;
    const id = current.conversationId;
    const controller = new AbortController();
    controllerRef.current = controller;
    ++loadVersion.current;
    setRunning(true);
    setNotice(null);
    updateSession({ responding: true });
    if (turn.message && turn.messageId) {
      updateSession({
        input: "",
        pending: {
          id: turn.messageId,
          text: turn.message,
          fileNames: selected.map((file) => file.name),
        },
      });
      pendingFiles.current = selected;
      setFiles([]);
    }
    const isCurrent = () =>
      controllerRef.current === controller &&
      sessionRef.current?.conversationId === id;
    let failed = false;
    let changed = false;
    try {
      const work = async () => {
        uploader.reset();
        setUploading(selected.length > 0);
        const uploaded = await uploader.upload(selected, {
          context: { conversationId: id },
          signal: controller.signal,
        });
        controller.signal.throwIfAborted();
        if (!isCurrent()) return;
        setUploading(false);
        if (uploaded.length !== selected.length)
          throw new Error(
            "Upload failed. Your message and files are ready to retry.",
          );
        const message = turn.message;
        if (message)
          setMessages((messages) => [
            ...messages,
            {
              role: "user",
              id: turn.messageId,
              text: message,
              ...(uploaded.length ? { attachments: uploaded } : {}),
            },
          ]);
        setAwaiting([]);
        const events = await client.willGpt.run.mutate(
          {
            conversationId: id,
            model: current.model,
            page: pathname,
            attachmentIds: uploaded.map((file) => file.id),
            ...turn,
          },
          { signal: controller.signal },
        );
        for await (const event of events) {
          if (!isCurrent()) break;
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
              )
                changed = true;
              break;
            case "awaiting":
              setAwaiting(event.callIds);
              break;
            case "notice":
              setNotice(event.text);
              break;
          }
        }
      };
      // Prevent two browser tabs from submitting or approving the same conversation together.
      if (navigator.locks)
        await navigator.locks.request(
          `will-gpt:${id}`,
          { ifAvailable: true },
          async (lock) => {
            if (!lock)
              throw new Error(
                "This chat is running in another tab. Wait for it to finish, then reload the conversation.",
              );
            await work();
          },
        );
      else await work();
    } catch (error) {
      failed = true;
      if (isCurrent()) {
        const reason = controller.signal.aborted
          ? "Stopped. Check any changes before trying again."
          : error instanceof Error
            ? error.message
            : "Will GPT stopped.";
        await readBack(reason);
      }
    } finally {
      if (isCurrent()) {
        if (!failed) {
          updateSession({ pending: null, responding: false });
          pendingFiles.current = [];
        }
        setDraft("");
        setRunning(false);
        setUploading(false);
        controllerRef.current = null;
        uploader.reset();
      }
      // A stopped tool may already have changed something, even without a result event.
      if (sessionRef.current && (changed || failed)) {
        void utils.invalidate();
        router.refresh();
      }
    }
  };

  const value: WillGptContextValue = {
    conversationId: session?.conversationId ?? null,
    open: session?.open ?? false,
    setOpen: (open) => updateSession({ open }),
    model: session?.model ?? WILL_GPT_MODELS[0].id,
    setModel: (model) => updateSession({ model }),
    width: session?.width ?? CHAT_WIDTH.initial,
    setWidth: (width) => updateSession({ width }),
    messages,
    awaiting,
    draft,
    running,
    ready,
    notice,
    files,
    setFiles,
    input: session?.input ?? "",
    setInput: (input) => updateSession({ input }),
    uploadProgress:
      uploading && uploader.isUploading
        ? Math.round(
            uploader.items.reduce((sum, item) => sum + item.progress, 0) /
              Math.max(1, uploader.items.length),
          )
        : null,
    send: () => {
      const text = sessionRef.current?.input.trim();
      if (!text || text.length > 20_000 || awaiting.length) return;
      void run({ message: text, messageId: crypto.randomUUID() }, files);
    },
    decide: (approved) => {
      if (!awaiting.length) return;
      void run({
        decisions: Object.fromEntries(awaiting.map((id) => [id, approved])),
      });
    },
    stop: () => controllerRef.current?.abort(),
    reload: () => {
      if (!controllerRef.current) void readBack();
    },
    reset: () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      ++loadVersion.current;
      updateSession({
        conversationId: crypto.randomUUID(),
        responding: false,
        input: "",
        pending: null,
      });
      readyRef.current = true;
      setReady(true);
      setRunning(false);
      setUploading(false);
      setMessages([]);
      setAwaiting([]);
      setNotice(null);
      setDraft("");
      setFiles([]);
      pendingFiles.current = [];
      uploader.reset();
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
