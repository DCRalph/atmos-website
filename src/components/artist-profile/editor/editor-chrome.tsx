"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleAlert,
  Loader2,
  Palette,
  Plus,
  Redo2,
  Share2,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { getBlockDef } from "~/lib/artist-blocks";
import { GRID } from "~/lib/artist-grid";
import { BLOCK_ICONS } from "./block-meta";
import {
  duplicate,
  nudge,
  remove,
  setHeight,
  setWidth,
  shift,
} from "./actions";
import { AddPanel, BlockPanel } from "./block-panels";
import { completeSocials } from "~/lib/artist-socials";
import { ProfilePanel, SocialsPanel, ThemePanel } from "./page-panels";
import {
  useEditor,
  type Changes,
  type EditorState,
  type EditorStore,
  type Panel,
} from "./store";

/**
 * Edit mode's controls, over the page: the dock along the bottom and the
 * panel for whatever is being changed. Also saves everything as it changes,
 * and stays mounted after "Done" until it has.
 */
export default function EditorChrome({ store }: { store: EditorStore }) {
  const editing = useEditor(store, (s) => s.editing);
  const save = useAutosave(store);
  useShortcuts(store, editing);
  useLeaveWarning(save.state !== "saved");

  if (!editing)
    return save.state === "saved" ? null : (
      <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
        <SaveStatus save={save} />
      </div>
    );

  return (
    <div className="dark">
      <EditorPanel store={store} />
      <Dock store={store} save={save} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saving

type Save = {
  state: "saved" | "saving" | "error";
  error: string | null;
  retry: () => void;
};

const PARTS: (keyof Changes)[] = ["blocks", "identity", "socials", "theme"];

const isDirty = (s: Pick<EditorState, "changes" | "saved">) =>
  PARTS.some((p) => s.changes[p] !== s.saved[p]);

type Utils = ReturnType<typeof api.useUtils>;

/** Save every part that has changed since it was last saved. Throws on failure. */
async function savePending(store: EditorStore, utils: Utils) {
  const s = store.getState();
  const at = s.changes;
  const { profileId } = s;
  const api = utils.client.artistProfiles;
  for (const part of PARTS) {
    if (at[part] === s.saved[part]) continue;
    if (part === "blocks") {
      const res = await api.saveLayout.mutate({
        profileId,
        blocks: s.blocks.map((b) => ({
          id: s.serverIds[b.id] ?? (b.isNew ? undefined : b.id),
          clientId: b.id,
          type: b.type,
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
          data: b.data,
        })),
      });
      store.getState().rememberIds(res.created);
    } else if (part === "identity") {
      const name = s.identity.displayName.trim();
      await api.updateProfile.mutate({
        profileId,
        data: {
          ...(name ? { displayName: name } : {}),
          tagline: s.identity.tagline?.trim() ?? null,
          bio: s.identity.bio?.trim() ?? null,
        },
      });
    } else if (part === "socials") {
      await api.setSocials.mutate({
        profileId,
        socials: completeSocials(s.socials).map((social, i) => ({
          ...social,
          sortOrder: i,
        })),
      });
    } else {
      const res = await api.customizeTheme.mutate({
        profileId,
        tokens: s.theme,
      });
      if (res.theme.id !== s.themeInfo?.id)
        void utils.artistThemes.listMine.invalidate();
      store.setState({ themeInfo: res.theme });
    }
    store.getState().markSaved(part, at[part]);
  }
}

/**
 * Saves each part of the profile a moment after it last changed. Saves run
 * one after another, and whatever is waiting is saved straight away if the
 * editor goes (a header link clicked mid-edit). A failed save waits for the
 * next change or a retry rather than hammering the server.
 */
function useAutosave(store: EditorStore): Save {
  const changes = useEditor(store, (s) => s.changes);
  const saved = useEditor(store, (s) => s.saved);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ at: Changes; message: string } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);
  const utils = api.useUtils();
  const queue = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(() => {
    queue.current = queue.current.then(async () => {
      if (!isDirty(store.getState())) return;
      const at = store.getState().changes;
      setBusy(true);
      try {
        await savePending(store, utils);
        setFailed(null);
      } catch (e) {
        setFailed({
          at,
          message: e instanceof Error ? e.message : "Couldn't save",
        });
      } finally {
        setBusy(false);
      }
    });
    return queue.current;
  }, [store, utils]);

  const dirty = isDirty({ changes, saved });
  const stuck = failed !== null && failed.at === changes;

  useEffect(() => {
    if (busy || !dirty || stuck) return;
    const timer = setTimeout(() => void flush(), 700);
    return () => clearTimeout(timer);
  }, [changes, saved, busy, dirty, stuck, attempt, flush]);

  useEffect(() => {
    store.setState({ flush });
    // Leaving the page mid-edit (a header link): save what's waiting.
    return () => void flush();
  }, [store, flush]);

  return {
    state: stuck ? "error" : busy || dirty ? "saving" : "saved",
    error: stuck ? (failed?.message ?? null) : null,
    retry: () => {
      setFailed(null);
      setAttempt((n) => n + 1);
    },
  };
}

function useLeaveWarning(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [on]);
}

// ---------------------------------------------------------------------------
// Keyboard

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) ||
    el.closest("[role=dialog],[role=listbox]") !== null);

/**
 * Undo and redo, Escape to step back out, and for the selected block: arrows
 * to move, shift and arrows to resize, Delete to remove, ⌘D to duplicate.
 */
function useShortcuts(store: EditorStore, editing: boolean) {
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || typing(e.target)) return;
      const s = store.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (e.key === "Escape") {
        if (s.selectedId) s.select(null);
        else if (s.panel) s.openPanel(null);
        return;
      }
      const block = s.blocks.find((b) => b.id === s.selectedId);
      if (!block) return;
      if (mod && key === "d") {
        e.preventDefault();
        duplicate(store, block.id);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove(store, block.id);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const fill = getBlockDef(block.type).sizing === "fill";
        if (e.shiftKey) {
          if (e.key === "ArrowLeft") setWidth(store, block.id, block.w - 1);
          if (e.key === "ArrowRight") setWidth(store, block.id, block.w + 1);
          if (fill && e.key === "ArrowUp")
            setHeight(store, block.id, block.h - 1);
          if (fill && e.key === "ArrowDown")
            setHeight(store, block.id, block.h + 1);
        } else {
          if (e.key === "ArrowLeft") shift(store, block.id, -1);
          if (e.key === "ArrowRight") shift(store, block.id, 1);
          if (e.key === "ArrowUp") nudge(store, block.id, -1);
          if (e.key === "ArrowDown") nudge(store, block.id, 1);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, editing]);
}

// ---------------------------------------------------------------------------
// Dock

function Dock({ store, save }: { store: EditorStore; save: Save }) {
  const router = useRouter();
  const panel = useEditor(store, (s) => s.panel);
  const canUndo = useEditor(store, (s) => s.past.length > 0);
  const canRedo = useEditor(store, (s) => s.future.length > 0);
  const isPublished = useEditor(store, (s) => s.isPublished);
  const profileId = useEditor(store, (s) => s.profileId);
  const dragging = useEditor(store, (s) => s.dragging);
  const publish = api.artistProfiles.publish.useMutation();
  const toggle = (p: Panel) =>
    store.getState().openPanel(panel === p ? null : p);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))] transition-opacity duration-200 md:pb-5",
        dragging && "pointer-events-none opacity-30",
      )}
    >
      <nav
        aria-label="Page editor"
        className="glass-dark glass-float flex max-w-full [scrollbar-width:none] items-center gap-1 overflow-x-auto rounded-full bg-[rgb(8_8_8/0.9)] p-1.5 text-white"
      >
        <DockButton
          onClick={() => toggle("add")}
          active={panel === "add"}
          accent
          icon={<Plus className="size-4" />}
        >
          Add
        </DockButton>
        <DockButton
          onClick={() => toggle("theme")}
          active={panel === "theme"}
          icon={<Palette className="size-4" />}
        >
          Theme
        </DockButton>
        <DockButton
          onClick={() => toggle("profile")}
          active={panel === "profile"}
          icon={<UserRound className="size-4" />}
        >
          Profile
        </DockButton>
        <DockButton
          onClick={() => toggle("socials")}
          active={panel === "socials"}
          icon={<Share2 className="size-4" />}
        >
          Socials
        </DockButton>
        <span
          aria-hidden
          className="mx-1 h-6 w-px shrink-0 bg-white/15 max-sm:hidden"
        />
        <RoundDockButton
          label="Undo"
          disabled={!canUndo}
          onClick={() => store.getState().undo()}
        >
          <Undo2 className="size-4" />
        </RoundDockButton>
        <RoundDockButton
          label="Redo"
          className="max-sm:hidden"
          disabled={!canRedo}
          onClick={() => store.getState().redo()}
        >
          <Redo2 className="size-4" />
        </RoundDockButton>
        <span
          aria-hidden
          className="mx-1 h-6 w-px shrink-0 bg-white/15 max-sm:hidden"
        />
        <SaveStatus save={save} compact />
        {isPublished ? null : (
          <button
            type="button"
            disabled={publish.isPending}
            onClick={async () => {
              await publish.mutateAsync({ profileId });
              store.getState().setPublished(true);
            }}
            className="t-label inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/25 px-4 text-[10px] text-white transition-colors hover:border-white max-sm:hidden"
          >
            {publish.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Publish
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            store.getState().setEditing(false);
            window.history.replaceState(null, "", window.location.pathname);
            router.refresh();
          }}
          className="t-label inline-flex h-10 shrink-0 items-center rounded-full bg-white px-4 text-[10px] text-black transition-opacity hover:opacity-85 sm:px-5"
        >
          Done
        </button>
      </nav>
    </div>
  );
}

function DockButton({
  onClick,
  active,
  accent,
  icon,
  children,
}: {
  onClick: () => void;
  active: boolean;
  accent?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "t-label inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-[10px] transition-colors sm:px-4",
        active
          ? "bg-white text-black"
          : accent
            ? "bg-[var(--ed)] text-black hover:opacity-90"
            : "text-white/80 hover:bg-white/10 hover:text-white",
      )}
    >
      {icon}
      <span className="max-sm:sr-only">{children}</span>
    </button>
  );
}

function RoundDockButton({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function SaveStatus({ save, compact }: { save: Save; compact?: boolean }) {
  if (save.state === "error")
    return (
      <button
        type="button"
        onClick={save.retry}
        title={save.error ?? undefined}
        className="t-label text-site-danger-text inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-black/70 px-3 text-[10px] hover:bg-white/10"
      >
        <CircleAlert className="size-4" /> Not saved · Retry
      </button>
    );
  return (
    <span
      role="status"
      className={cn(
        "t-label inline-flex h-10 shrink-0 items-center gap-2 px-2 text-[10px] text-white/60",
        !compact && "glass-dark rounded-full px-4 text-white",
      )}
    >
      {save.state === "saving" ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          <span className={compact ? "max-sm:sr-only" : undefined}>Saving</span>
        </>
      ) : (
        <>
          <Check className="size-3.5" />
          <span className={compact ? "max-sm:sr-only" : undefined}>Saved</span>
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Panel

const TITLES: Record<Exclude<Panel, "block">, string> = {
  add: "Add a block",
  theme: "Theme",
  profile: "Profile",
  socials: "Socials",
};

/**
 * The open panel. On wider screens it floats beside the page, on the side
 * away from the selected block so the block stays in view; on phones it's a
 * sheet. It steps aside while a block is dragged.
 */
function EditorPanel({ store }: { store: EditorStore }) {
  const panel = useEditor(store, (s) => s.panel);
  const blocks = useEditor(store, (s) => s.blocks);
  const selectedId = useEditor(store, (s) => s.selectedId);
  const profileId = useEditor(store, (s) => s.profileId);
  const dragging = useEditor(store, (s) => s.dragging);
  const block = blocks.find((b) => b.id === selectedId) ?? null;
  if (!panel || (panel === "block" && !block)) return null;

  const left = block !== null && block.x + block.w / 2 > GRID.cols / 2;
  const def = block ? getBlockDef(block.type) : null;
  const Icon = block ? BLOCK_ICONS[block.type] : null;

  return (
    <aside
      aria-label={
        panel === "block" && def
          ? def.label
          : TITLES[panel as Exclude<Panel, "block">]
      }
      className={cn(
        "glass-dark glass-float fixed z-40 flex flex-col overflow-hidden text-white transition-opacity duration-200",
        "inset-x-0 bottom-0 max-h-[58dvh] rounded-t-[var(--site-r-panel)] pb-20",
        "md:inset-x-auto md:top-24 md:bottom-24 md:max-h-none md:w-[380px] md:rounded-[var(--site-r-panel)] md:pb-0",
        left ? "md:left-5 md:rounded-tl-none" : "md:right-5 md:rounded-tr-none",
        "bg-[rgb(8_8_8/0.92)]",
        dragging && "pointer-events-none opacity-0",
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 py-3.5 pr-3 pl-5">
        <h2 className="t-label flex min-w-0 items-center gap-2 text-[12px]">
          {Icon ? <Icon className="size-4 shrink-0 text-[var(--ed)]" /> : null}
          <span className="truncate">
            {panel === "block" && def
              ? def.label
              : TITLES[panel as Exclude<Panel, "block">]}
          </span>
        </h2>
        <button
          type="button"
          aria-label="Close panel"
          onClick={() =>
            panel === "block"
              ? store.getState().select(null)
              : store.getState().openPanel(null)
          }
          className="inline-flex size-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
        {panel === "block" && block ? (
          <BlockPanel
            key={block.id}
            store={store}
            block={block}
            blocks={blocks}
            profileId={profileId}
          />
        ) : panel === "add" ? (
          <AddPanel store={store} />
        ) : panel === "theme" ? (
          <ThemePanel store={store} />
        ) : panel === "profile" ? (
          <ProfilePanel store={store} />
        ) : panel === "socials" ? (
          <SocialsPanel store={store} />
        ) : null}
      </div>
    </aside>
  );
}
