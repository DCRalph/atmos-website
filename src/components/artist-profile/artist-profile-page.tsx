"use client";

import "~/styles/artist-profile.css";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Pencil } from "lucide-react";
import { cn } from "~/lib/utils";
import { artistFontVariables } from "~/lib/artist-fonts";
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
import type { PublicProfile } from "./types";

const layouts = {
  headliner: HeadlinerLayout,
  wall: WallLayout,
  stage: StageLayout,
} satisfies Record<LayoutKey, unknown>;

/** Edit links for the profile's owner and admins, and the draft notice. */
export type OwnerTools = {
  draft: boolean;
  links: { label: string; href: string }[];
};

const noSubscribe = () => () => undefined;
const getEmbedded = () => window.self !== window.top;

/**
 * A public artist profile: the site shell themed to the artist, with their
 * theme's layout inside. Inside the theme editor's preview frame it takes
 * unsaved themes from the editor instead (see `theme-preview.ts`).
 */
export function ArtistProfilePage({
  profile,
  theme,
  accentOverride,
  claim = null,
  owner,
}: {
  profile: PublicProfile;
  theme: ArtistTheme;
  accentOverride?: string | null;
  claim?: ClaimState;
  owner?: OwnerTools | null;
}) {
  const embedded = useSyncExternalStore(noSubscribe, getEmbedded, () => false);
  const [previewTheme, setPreviewTheme] = useState<ArtistTheme | null>(null);

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

  // A previewed theme shows as designed: the profile's own accent would hide
  // the accent being edited.
  const resolved = previewTheme
    ? resolveTheme(previewTheme)
    : resolveTheme(theme, accentOverride);
  const Layout = layouts[resolved.layout];

  return (
    <SiteShell
      tone={resolved.tone}
      className={cn("cp", artistFontVariables)}
      style={themeVars(resolved)}
      {...themeAttributes(resolved)}
    >
      {owner && !embedded ? <OwnerBar owner={owner} /> : null}
      <Layout profile={profile} theme={resolved} claim={claim} />
    </SiteShell>
  );
}

function OwnerBar({ owner }: { owner: OwnerTools }) {
  return (
    <div className="fixed top-20 right-5 z-30 flex flex-wrap items-center justify-end gap-2 md:top-24 md:right-10">
      {owner.draft ? (
        <span className="t-label cp-glass rounded-full px-4 py-2.5 text-[10px] text-[var(--cp-ink)]">
          Draft · only you and admins can see this
        </span>
      ) : null}
      {owner.links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={pill({ variant: "glass", size: "sm" })}
        >
          <Pencil className="size-3.5" /> {l.label}
        </Link>
      ))}
    </div>
  );
}
