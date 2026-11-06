import { createStore, useStore, type StoreApi } from "zustand";
import { buildMediaUrl } from "~/lib/media-url";
import { GRID } from "~/lib/artist-grid";
import { toSections } from "~/lib/artist-sections";
import { completeSocials } from "~/lib/artist-socials";
import type { ClientBlock } from "~/lib/artist-blocks";
import {
  DEFAULT_THEME,
  NO_HISTORY,
  recordThemeChange,
  type ArtistTheme,
  type ThemeHistory,
} from "~/lib/artist-theme";
import type { EditableProfile, PublicProfile, PublicSocial } from "../types";

/**
 * The page editor's state: the profile as it's being edited, what's
 * selected, and which panel is open. Created by `ArtistProfilePage` for the
 * owner and admins, so the page can draw itself from it; the editor UI (loaded
 * when edit mode first opens) reads and changes it, and saves it.
 */
export type Panel = "add" | "block" | "theme" | "profile" | "socials";

export type Identity = Pick<
  EditableProfile,
  "handle" | "displayName" | "tagline" | "bio" | "avatarFileId" | "bannerFileId"
>;

/** Change counters per part: bumped by every change, copied to `saved` by every save. */
export type Changes = {
  blocks: number;
  identity: number;
  socials: number;
  theme: number;
};

export type EditorState = {
  profileId: string;
  editor: EditableProfile["editor"];
  /** The page is in edit mode. */
  editing: boolean;
  /** Edit mode has been opened: the editor stays loaded to finish saving. */
  opened: boolean;
  blocks: ClientBlock[];
  /** Undo and redo, blocks only. */
  past: ClientBlock[][];
  future: ClientBlock[][];
  selectedId: string | null;
  panel: Panel | null;
  /** A block is being dragged or resized: panels step aside. */
  dragging: boolean;
  identity: Identity;
  socials: PublicSocial[];
  theme: ArtistTheme;
  /** Undo for theme changes made in the Theme panel. */
  themeHistory: ThemeHistory;
  /** Their gig posters, for the Theme panel's palettes. Not edited here. */
  posters: { src: string; label: string }[];
  themeInfo: Omit<NonNullable<EditableProfile["theme"]>, "tokens"> | null;
  accentColor: string | null;
  isPublished: boolean;
  changes: Changes;
  saved: Changes;
  /**
   * Server ids for blocks the editor made, by their editor id. Blocks keep
   * the id they started with all session, so nothing remounts when one is
   * first saved (which would drop focus mid-typing).
   */
  serverIds: Record<string, string>;

  setEditing: (on: boolean) => void;
  /**
   * A change the artist made: undoable and saved. Changes with the same
   * `group` within a second (typing into one block) undo together.
   */
  commit: (
    next: (blocks: ClientBlock[]) => ClientBlock[],
    group?: string,
  ) => void;
  /**
   * A change the editor made (heights measured from content): saved, so the
   * public page cuts the grid where the editor shows it, but not undoable.
   */
  adjust: (next: (blocks: ClientBlock[]) => ClientBlock[]) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  openPanel: (panel: Panel | null) => void;
  patchIdentity: (patch: Partial<Identity>, opts?: { saved?: boolean }) => void;
  setSocials: (socials: PublicSocial[]) => void;
  /** A change to the theme; see `recordThemeChange` for `group`. */
  patchTheme: (patch: Partial<ArtistTheme>, group?: string) => void;
  undoTheme: () => void;
  /** A whole theme, already saved (picked from the list, or a copy made). */
  setTheme: (
    info: EditorState["themeInfo"],
    tokens: ArtistTheme,
    accentColor: string | null,
  ) => void;
  setPublished: (on: boolean) => void;
  /** Record that a part was saved as of change `at`. */
  markSaved: (part: keyof Changes, at: number) => void;
  /**
   * Save whatever is waiting, after any save already running. Set by the
   * editor's autosave; anything that must not race a save (a new handle, a
   * new theme) awaits it first.
   */
  flush: () => Promise<void>;
  /** Remember the ids the server gave blocks it created. */
  rememberIds: (created: Record<string, string>) => void;
};

export type EditorStore = StoreApi<EditorState>;

const HISTORY = 100;

/** A profile nobody has arranged shows its sets; the editor starts from those. */
const starterBlocks = (): ClientBlock[] => [
  {
    id: "tmp_sets",
    isNew: true,
    type: "GIG_LIST",
    x: 0,
    y: 0,
    w: GRID.cols,
    h: 1,
    data: { title: "Sets" },
  },
  {
    id: "tmp_past",
    isNew: true,
    type: "PAST_GIGS",
    x: 0,
    y: 1,
    w: GRID.cols,
    h: 1,
    data: { title: "Past sets", includeUpcoming: false, showRole: true },
  },
];

export function createEditorStore(
  profile: EditableProfile,
  startEditing: boolean,
  posters: EditorState["posters"] = [],
): EditorStore {
  const bump = (s: EditorState, key: keyof Changes) => ({
    ...s.changes,
    [key]: s.changes[key] + 1,
  });
  let lastGroup: { key: string; at: number } | null = null;

  return createStore<EditorState>()((set) => ({
    profileId: profile.id,
    editor: profile.editor,
    editing: startEditing,
    opened: startEditing,
    blocks: profile.blocks.length ? profile.blocks : starterBlocks(),
    past: [],
    future: [],
    selectedId: null,
    panel: null,
    dragging: false,
    identity: {
      handle: profile.handle,
      displayName: profile.displayName,
      tagline: profile.tagline,
      bio: profile.bio,
      avatarFileId: profile.avatarFileId,
      bannerFileId: profile.bannerFileId,
    },
    socials: profile.socials,
    theme: profile.theme?.tokens ?? DEFAULT_THEME,
    themeHistory: NO_HISTORY,
    posters,
    themeInfo: profile.theme
      ? {
          id: profile.theme.id,
          name: profile.theme.name,
          own: profile.theme.own,
        }
      : null,
    accentColor: profile.accentColor,
    isPublished: profile.isPublished,
    changes: { blocks: 0, identity: 0, socials: 0, theme: 0 },
    saved: { blocks: 0, identity: 0, socials: 0, theme: 0 },
    serverIds: {},

    setEditing: (on) =>
      set((s) =>
        on
          ? { editing: true, opened: true }
          : {
              editing: false,
              selectedId: null,
              panel: s.panel === "block" ? null : s.panel,
            },
      ),
    commit: (next, group) =>
      set((s) => {
        const blocks = next(s.blocks);
        if (blocks === s.blocks) return s;
        const now = Date.now();
        const joins =
          group !== undefined &&
          lastGroup?.key === group &&
          now - lastGroup.at < 1000 &&
          s.past.length > 0;
        lastGroup = group === undefined ? null : { key: group, at: now };
        return {
          blocks,
          past: joins ? s.past : [...s.past, s.blocks].slice(-HISTORY),
          future: [],
          changes: bump(s, "blocks"),
        };
      }),
    adjust: (next) =>
      set((s) => {
        const blocks = next(s.blocks);
        return blocks === s.blocks ? s : { blocks, changes: bump(s, "blocks") };
      }),
    undo: () =>
      set((s) => {
        const prev = s.past.at(-1);
        if (!prev) return s;
        return {
          blocks: prev,
          past: s.past.slice(0, -1),
          future: [s.blocks, ...s.future],
          selectedId: prev.some((b) => b.id === s.selectedId)
            ? s.selectedId
            : null,
          changes: bump(s, "blocks"),
        };
      }),
    redo: () =>
      set((s) => {
        const next = s.future[0];
        if (!next) return s;
        return {
          blocks: next,
          past: [...s.past, s.blocks],
          future: s.future.slice(1),
          selectedId: next.some((b) => b.id === s.selectedId)
            ? s.selectedId
            : null,
          changes: bump(s, "blocks"),
        };
      }),
    select: (id) =>
      set((s) => ({
        selectedId: id,
        panel: id ? "block" : s.panel === "block" ? null : s.panel,
      })),
    openPanel: (panel) =>
      set((s) => ({
        panel,
        selectedId: panel === "block" ? s.selectedId : null,
      })),
    patchIdentity: (patch, opts) =>
      set((s) => ({
        identity: { ...s.identity, ...patch },
        changes: opts?.saved ? s.changes : bump(s, "identity"),
      })),
    setSocials: (socials) =>
      set((s) => ({ socials, changes: bump(s, "socials") })),
    patchTheme: (patch, group) =>
      set((s) => ({
        theme: { ...s.theme, ...patch },
        themeHistory: recordThemeChange(s.themeHistory, s.theme, group),
        accentColor: null,
        changes: bump(s, "theme"),
      })),
    undoTheme: () =>
      set((s) => {
        const prev = s.themeHistory.past.at(-1);
        if (!prev) return s;
        return {
          theme: prev,
          themeHistory: {
            ...NO_HISTORY,
            past: s.themeHistory.past.slice(0, -1),
          },
          changes: bump(s, "theme"),
        };
      }),
    // Whatever theme change was waiting to save is replaced by this one, and
    // undo starts over from it.
    setTheme: (themeInfo, theme, accentColor) =>
      set((s) => ({
        themeInfo,
        theme,
        themeHistory: NO_HISTORY,
        accentColor,
        saved: { ...s.saved, theme: s.changes.theme },
      })),
    setPublished: (isPublished) => set({ isPublished }),
    flush: () => Promise.resolve(),
    markSaved: (part, at) =>
      set((s) => ({
        saved: { ...s.saved, [part]: Math.max(s.saved[part], at) },
      })),
    rememberIds: (created) =>
      set((s) =>
        Object.keys(created).length
          ? { serverIds: { ...s.serverIds, ...created } }
          : s,
      ),
  }));
}

export const useEditor = <T>(
  store: EditorStore,
  select: (s: EditorState) => T,
) => useStore(store, select);

/** Trimmed text, or null when there's nothing left. */
const text = (value: string | null) => value?.trim() || null; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing -- an empty string should become null too

/** The public profile with the editor's changes, for drawing the page. */
export function applyEdits(
  base: PublicProfile,
  s: Pick<EditorState, "blocks" | "identity" | "socials">,
): PublicProfile {
  const { identity } = s;
  const socials = completeSocials(s.socials);
  return {
    ...base,
    handle: identity.handle,
    name: identity.displayName.trim() || base.name,
    tagline: text(identity.tagline),
    bio: text(identity.bio),
    portrait: identity.avatarFileId
      ? buildMediaUrl(identity.avatarFileId)
      : null,
    banner: identity.bannerFileId ? buildMediaUrl(identity.bannerFileId) : null,
    socials,
    sections: toSections(s.blocks, {
      socials: socials.length,
      upcoming: base.upcoming.length,
      past: base.past.length,
      mediaUrl: buildMediaUrl,
    }),
  };
}
