"use client";

import { ArrowUpRight } from "lucide-react";
import { FaInstagram, FaSoundcloud } from "react-icons/fa6";
import { cn } from "~/lib/utils";
import { crew } from "../fixtures";
import { Media } from "../primitives";

// Shared data and parts for the /crew drafts. Names, roles and photos are the
// live crew; Instagram/SoundCloud links come from the seed where we have them.
// Which members have a published creator profile is illustrative.

export type CrewEntry = {
  name: string;
  role: string;
  image: string | null;
  instagram: string | null;
  soundcloud: string | null;
  /** Published creator profile handle, linked as /@handle. */
  profileHandle: string | null;
};

const links: Record<
  string,
  Pick<CrewEntry, "instagram" | "soundcloud" | "profileHandle">
> = {
  broderbeats: {
    instagram: "https://www.instagram.com/broderbeats/",
    soundcloud: "https://soundcloud.com/broderbeats",
    profileHandle: "broderbeats",
  },
  Sunday: {
    instagram: "https://www.instagram.com/probablysunday/",
    soundcloud: "https://soundcloud.com/djsundaymusic",
    profileHandle: "sunday",
  },
  "Special K": {
    instagram: "https://www.instagram.com/specialknz_/",
    soundcloud: "https://soundcloud.com/devilmcrx292",
    profileHandle: null,
  },
  Taiji: {
    instagram: "https://www.instagram.com/taiji.nz/",
    soundcloud: "https://soundcloud.com/taiji-730606296",
    profileHandle: null,
  },
};

const roster: CrewEntry[] = crew.map((c) => ({
  ...c,
  instagram: null,
  soundcloud: null,
  profileHandle: null,
  ...links[c.name],
}));

export const crewStates = [
  { id: "loaded", label: "Loaded" },
  { id: "loading", label: "Loading", hint: "Static skeleton" },
  {
    id: "no-photo",
    label: "Missing photo",
    hint: "Cos has no photo: falls back to an initial",
  },
] as const;

/** The roster for a page state; null while loading. */
export function crewFor(state: string): CrewEntry[] | null {
  if (state === "loading") return null;
  if (state === "no-photo")
    return roster.map((m) => (m.name === "Cos" ? { ...m, image: null } : m));
  return roster;
}

export const crewIntro =
  "DJs, producers and creatives powering Atmos in Pōneke.";

/** Member photo with hard edges, or their initial when there's no photo. */
export function Portrait({
  member,
  className,
  sizes,
  priority,
}: {
  member: CrewEntry;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (member.image)
    return (
      <Media
        src={member.image}
        alt={member.name}
        sizes={sizes}
        className={className}
        priority={priority}
      />
    );
  return (
    <div
      role="img"
      aria-label={member.name}
      className={cn(
        "@container flex items-center justify-center overflow-hidden bg-white/[0.06]",
        className,
      )}
    >
      <span className="mx-display text-[40cqw] text-white/45">
        {member.name.slice(0, 1)}
      </span>
    </div>
  );
}

/** Instagram, SoundCloud and profile links. `glass` when sitting over a photo. */
export function MemberLinks({
  member,
  glass = false,
  className,
}: {
  member: CrewEntry;
  glass?: boolean;
  className?: string;
}) {
  const icon = cn(
    "flex size-10 shrink-0 items-center justify-center rounded-full text-white transition-colors",
    glass
      ? "mx-glass hover:bg-white/15"
      : "border border-white/20 text-white/80 hover:border-white hover:text-white",
  );
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {member.instagram ? (
        <a
          href={member.instagram}
          target="_blank"
          rel="noreferrer"
          aria-label={`${member.name} on Instagram`}
          className={icon}
        >
          <FaInstagram className="size-4" />
        </a>
      ) : null}
      {member.soundcloud ? (
        <a
          href={member.soundcloud}
          target="_blank"
          rel="noreferrer"
          aria-label={`${member.name} on SoundCloud`}
          className={icon}
        >
          <FaSoundcloud className="size-4" />
        </a>
      ) : null}
      {member.profileHandle ? (
        <a
          href="#"
          className="mx-label inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[10px] text-black transition-colors hover:bg-[var(--mx-accent)] hover:text-[var(--mx-accent-ink)]"
        >
          View profile <ArrowUpRight className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}

/** "Join the crew" call to action on black. Copy tightened from the live page. */
export function JoinCrew() {
  return (
    <section className="mx-5 grid gap-6 border-t border-white/10 pt-10 md:mx-10 md:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-end">
      <h2 className="mx-display text-[clamp(2.25rem,6vw,5rem)]">
        Join the crew
      </h2>
      <div className="space-y-5">
        <p className="max-w-[44ch] text-[16px] text-white/70">
          Want to collaborate or be part of Atmos? We&apos;re always looking for
          artists who share the vision.
        </p>
        <a
          href="#"
          className="mx-label inline-flex h-14 items-center gap-2 rounded-full bg-white px-9 text-[15px] text-black transition-colors hover:bg-white/85"
        >
          Get in touch <ArrowUpRight className="size-4" />
        </a>
      </div>
    </section>
  );
}
