"use client";

import type { CSSProperties } from "react";
import { cn } from "~/lib/utils";
import { fmtYear } from "~/components/site/gigs/gig-parts";
import { Photo } from "../parts";
import { sectionAnchor } from "../sections";
import type { PublicProfile } from "../types";

/** `--len` for sizing a name to fill its container (see `--cp-display-em`). */
export const nameLength = (name: string) =>
  ({ "--len": Math.max(name.length, 5) }) as CSSProperties;

/** `14 sets with Atmos since 2024`, from the artist's lineups. */
export function pastSetsLine(profile: PublicProfile) {
  const total = profile.past.length + profile.upcoming.length;
  const first = profile.past.at(-1)?.start;
  const sets = `${total} ${total === 1 ? "set" : "sets"} with Atmos`;
  return first ? `${sets} since ${fmtYear(first)}` : sets;
}

const MUSIC = new Set([
  "SOUNDCLOUD_TRACK",
  "SOUNDCLOUD_PLAYLIST",
  "SPOTIFY_EMBED",
]);

/** Anchor of the first music section, for a "Listen" button. */
export function firstMusicAnchor(profile: PublicProfile) {
  const i = profile.sections.findIndex((s) => MUSIC.has(s.type));
  if (i < 0) return null;
  // Jump to the heading above the player when there is one.
  const before = profile.sections[i - 1];
  return sectionAnchor(
    before?.type === "HEADING" ? before : profile.sections[i]!,
  );
}

/** The bio as paragraphs: blank lines split them, single breaks are kept. */
export function BioText({
  bio,
  className,
}: {
  bio: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-[60ch] space-y-5 text-[17px] leading-relaxed text-[var(--cp-muted)]",
        className,
      )}
    >
      {bio
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
    </div>
  );
}

/** The bio, closing the page. The portrait sits beside it where the layout hasn't used it. */
export function About({
  profile,
  withPortrait,
  className,
}: {
  profile: PublicProfile;
  withPortrait?: boolean;
  className?: string;
}) {
  if (!profile.bio) return null;
  const portrait = withPortrait ? profile.portrait : null;
  return (
    <section
      id="about"
      className={cn(
        "grid scroll-mt-36 gap-10 px-5 py-16 md:px-10 md:py-24",
        portrait && "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16",
        className,
      )}
    >
      {portrait ? (
        <Photo
          src={portrait}
          alt={profile.name}
          sizes="(min-width: 1024px) 40vw, 100vw"
          className="aspect-[4/5] rounded-[var(--cp-r-media)]"
        />
      ) : null}
      <div className={portrait ? "lg:pt-4" : undefined}>
        <h2 className="cp-display text-[clamp(2.25rem,6vw,4.75rem)]">About</h2>
        <BioText bio={profile.bio} className="mt-8" />
      </div>
    </section>
  );
}
