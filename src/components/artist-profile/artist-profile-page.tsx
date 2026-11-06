"use client";

import "~/styles/artist-profile.css";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Pencil, Shield } from "lucide-react";
import { cn } from "~/lib/utils";
import { artistFontVariables } from "~/lib/artist-fonts";
import { SITE_ACCENT } from "~/lib/site-constants";
import {
  resolveTheme,
  themeAttributes,
  themeVars,
  type ArtistTheme,
  type LayoutKey,
} from "~/lib/artist-theme";
import { SiteShell } from "~/components/site/site-shell";
import { HeadlinerLayout } from "./layouts/headliner";
import { StageLayout } from "./layouts/stage";
import { WallLayout } from "./layouts/wall";
import { pill, type ClaimState } from "./parts";
import { postPreviewMessage, readPreviewMessage } from "./theme-preview";
import {
  ProfileEditorContext,
  type ProfileEditorHooks,
} from "./editor/context";
import {
  applyEdits,
  createEditorStore,
  useEditor,
  type EditorStore,
} from "./editor/store";
import type { EditableProfile, PublicProfile } from "./types";

const layouts = {
  headliner: HeadlinerLayout,
  wall: WallLayout,
  stage: StageLayout,
} satisfies Record<LayoutKey, unknown>;

// The editor's UI, loaded the first time edit mode opens.
const EditorGrid = dynamic(() => import("./editor/editor-grid"));
const EditorChrome = dynamic(() => import("./editor/editor-chrome"));

const noSubscribe = () => () => undefined;
const getEmbedded = () => window.self !== window.top;

/**
 * A public artist profile: the site shell themed to the artist, with their
 * theme's layout inside. Inside the theme editor's preview frame it takes
 * unsaved themes from the editor instead (see `theme-preview.ts`).
 *
 * For its owner and admins (`editable`) the page is also its own editor: "Edit
 * page" turns it into edit mode in place, where the grid can be rearranged
 * and everything else changed, and the page redraws as it changes.
 */
export function ArtistProfilePage({
  profile,
  theme,
  accentOverride,
  claim = null,
  editable,
  startEditing = false,
}: {
  profile: PublicProfile;
  theme: ArtistTheme;
  accentOverride?: string | null;
  claim?: ClaimState;
  editable?: EditableProfile | null;
  startEditing?: boolean;
}) {
  const embedded = useSyncExternalStore(noSubscribe, getEmbedded, () => false);
  const [previewTheme, setPreviewTheme] = useState<ArtistTheme | null>(null);
  const [store] = useState(() =>
    editable ? createEditorStore(editable, startEditing) : null,
  );

  useEffect(() => {
    if (!embedded) return;
    const onMessage = (e: MessageEvent<unknown>) => {
      const message = readPreviewMessage(e);
      if (message?.type === "artist-theme-preview:theme")
        setPreviewTheme(message.theme);
    };
    window.addEventListener("message", onMessage);
    postPreviewMessage(window.parent, { type: "artist-theme-preview:ready" });
    return () => window.removeEventListener("message", onMessage);
  }, [embedded]);

  if (store && !embedded)
    return <EditablePage store={store} profile={profile} claim={claim} />;

  // A previewed theme shows as designed: the profile's own accent would hide
  // the accent being edited.
  return (
    <ThemedPage
      profile={profile}
      theme={previewTheme ?? theme}
      accentOverride={previewTheme ? null : accentOverride}
      claim={claim}
    />
  );
}

/** The page for its owner and admins, drawn from the editor's state. */
function EditablePage({
  store,
  profile,
  claim,
}: {
  store: EditorStore;
  profile: PublicProfile;
  claim: ClaimState;
}) {
  const editing = useEditor(store, (s) => s.editing);
  const opened = useEditor(store, (s) => s.opened);
  const blocks = useEditor(store, (s) => s.blocks);
  const identity = useEditor(store, (s) => s.identity);
  const socials = useEditor(store, (s) => s.socials);
  const theme = useEditor(store, (s) => s.theme);
  const accentColor = useEditor(store, (s) => s.accentColor);
  const isPublished = useEditor(store, (s) => s.isPublished);
  const admin = useEditor(store, (s) => s.editor === "admin");

  const live = useMemo(
    () => applyEdits(profile, { blocks, identity, socials }),
    [profile, blocks, identity, socials],
  );
  const hooks = useMemo<ProfileEditorHooks>(
    () => ({
      editing,
      renderGrid: (props) => <EditorGrid store={store} {...props} />,
      editProfile: () => store.getState().openPanel("profile"),
    }),
    [editing, store],
  );

  return (
    <ProfileEditorContext.Provider value={hooks}>
      <ThemedPage
        profile={live}
        theme={theme}
        accentOverride={accentColor}
        claim={claim}
        editing={editing}
      >
        {editing ? null : (
          <OwnerBar
            draft={!isPublished}
            adminHref={admin ? `/admin/artist-profiles/${profile.id}` : null}
            onEdit={() => {
              store.getState().setEditing(true);
              // So a refresh comes back to edit mode.
              window.history.replaceState(null, "", "?edit");
            }}
          />
        )}
        {opened ? <EditorChrome store={store} /> : null}
      </ThemedPage>
    </ProfileEditorContext.Provider>
  );
}

function ThemedPage({
  profile,
  theme,
  accentOverride,
  claim,
  editing,
  children,
}: {
  profile: PublicProfile;
  theme: ArtistTheme;
  accentOverride?: string | null;
  claim: ClaimState;
  editing?: boolean;
  children?: ReactNode;
}) {
  const resolved = resolveTheme(theme, accentOverride);
  const Layout = layouts[resolved.layout];
  return (
    <SiteShell
      tone={resolved.tone}
      // Room under the footer so the editor's dock never covers it.
      className={cn("cp", artistFontVariables, editing && "pb-24")}
      style={
        {
          ...themeVars(resolved),
          // The editor's own colours: the Atmos accent for its controls, and
          // for outlines whatever reads on this ground.
          "--ed": SITE_ACCENT,
          "--ed-line": resolved.tone === "light" ? "#0a0a0a" : SITE_ACCENT,
        } as CSSProperties
      }
      data-editing={editing ? "" : undefined}
      {...themeAttributes(resolved)}
    >
      {children}
      <Layout profile={profile} theme={resolved} claim={claim} />
    </SiteShell>
  );
}

/** Edit and admin links for the profile's owner and admins, and the draft notice. */
function OwnerBar({
  draft,
  adminHref,
  onEdit,
}: {
  draft: boolean;
  adminHref: string | null;
  onEdit: () => void;
}) {
  return (
    <div className="fixed right-5 bottom-[max(20px,env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center justify-end gap-2 md:right-10 md:bottom-8">
      {draft ? (
        <span className="t-label cp-glass rounded-full px-4 py-2.5 text-[10px] text-[var(--cp-ink)]">
          Draft · only you and admins can see this
        </span>
      ) : null}
      {adminHref ? (
        <Link
          href={adminHref}
          className={pill({ variant: "glass", size: "sm" })}
        >
          <Shield className="size-3.5" /> Admin
        </Link>
      ) : null}
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          pill({ size: "sm" }),
          "bg-[var(--ed)] text-black hover:opacity-90",
        )}
      >
        <Pencil className="size-3.5" /> Edit page
      </button>
    </div>
  );
}
