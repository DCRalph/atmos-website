"use client";

import { useEffect, useState } from "react";
import { Disc3, Search } from "lucide-react";
import { FaSoundcloud, FaSpotify, FaYoutube } from "react-icons/fa6";
import { cn } from "~/lib/utils";
import { Button } from "../primitives";

// Shared data and parts for the /content drafts. The three real items mirror
// what's live on the site; the archive items only show how the page scales.

export type ContentKind = "mix" | "playlist" | "video";
export type ContentPlatform = "SoundCloud" | "Spotify" | "YouTube";

export type ContentEntry = {
  id: string;
  kind: ContentKind;
  title: string;
  dj?: string;
  platform: ContentPlatform;
  date: Date;
  blurb: string;
  image: string;
  /** Seconds. Only playable items (mixes, videos) have one; lengths are illustrative. */
  duration?: number;
};

export const liveContent: ContentEntry[] = [
  {
    id: "radio-1",
    kind: "mix",
    title: "Atmos Radio Vol.1 Ep.1",
    dj: "Sunday",
    platform: "SoundCloud",
    date: new Date("2026-03-10T12:00:00+13:00"),
    blurb:
      "Sunday takes over Atmos Radio for a journey through UK sound and sound system culture, 130 to 140 BPM.",
    image: "/home/atmos-10.jpg",
    duration: 3540,
  },
  {
    id: "selects-sc",
    kind: "playlist",
    title: "Atmos Selects",
    platform: "SoundCloud",
    date: new Date("2026-01-13T12:00:00+13:00"),
    blurb: "The bootlegs and dubs you've heard at our gigs. Updated weekly.",
    image: "/home/atmos-6.jpg",
  },
  {
    id: "selects-sp",
    kind: "playlist",
    title: "Atmos Selects",
    platform: "Spotify",
    date: new Date("2026-01-13T12:00:00+13:00"),
    blurb: "What we're playing right now. Updated weekly.",
    image: "/home/atmos-8.jpg",
  },
];

/** Illustrative only: what a year of drops might look like. Not real releases. */
const archiveExtras: ContentEntry[] = [
  {
    id: "daffodil-recap",
    kind: "video",
    title: "Daffodil Dancefloor recap",
    platform: "YouTube",
    date: new Date("2026-09-04T12:00:00+12:00"),
    blurb: "Three minutes from San Fran. Placeholder copy for a video item.",
    image: "/home/atmos-46.jpg",
    duration: 196,
  },
  {
    id: "radio-2",
    kind: "mix",
    title: "Atmos Radio Vol.1 Ep.2",
    dj: "Taiji",
    platform: "SoundCloud",
    date: new Date("2026-06-02T12:00:00+12:00"),
    blurb: "Placeholder copy for a second Atmos Radio episode.",
    image: "/home/atmos-17.jpg",
    duration: 3720,
  },
  {
    id: "caged-live",
    kind: "video",
    title: "Caged V2 live",
    dj: "broderbeats",
    platform: "YouTube",
    date: new Date("2025-11-20T12:00:00+13:00"),
    blurb: "Placeholder copy for a full live set video.",
    image: "/home/CAGED 2-95.jpg",
    duration: 2880,
  },
  {
    id: "radio-0",
    kind: "mix",
    title: "Warm-up mix",
    dj: "Special K",
    platform: "SoundCloud",
    date: new Date("2025-08-14T12:00:00+12:00"),
    blurb: "Placeholder copy for an older mix.",
    image: "/home/atmos-9.jpg",
    duration: 2700,
  },
];

export const archiveContent = [...liveContent, ...archiveExtras].sort(
  (a, b) => b.date.getTime() - a.date.getTime(),
);

export const contentStates = [
  { id: "loaded", label: "Loaded", hint: "The three items live today" },
  {
    id: "archive",
    label: "Archive",
    hint: "Padded with illustrative items to show scale",
  },
  { id: "loading", label: "Loading", hint: "Static skeleton" },
  { id: "empty", label: "Empty", hint: "Nothing published yet" },
  {
    id: "no-results",
    label: "No results",
    hint: "A filter with nothing in it",
  },
] as const;

/** Items a draft renders for a page state; null while loading. */
export function itemsFor(state: string): ContentEntry[] | null {
  if (state === "loading") return null;
  if (state === "empty") return [];
  if (state === "archive") return archiveContent;
  return liveContent;
}

export const kindLabel: Record<ContentKind, string> = {
  mix: "Mix",
  playlist: "Playlist",
  video: "Video",
};
export const kindPlural: Record<ContentKind, string> = {
  mix: "Mixes",
  playlist: "Playlists",
  video: "Videos",
};
export const kinds = [
  "mix",
  "playlist",
  "video",
] as const satisfies readonly ContentKind[];

export const platformIcon = {
  SoundCloud: FaSoundcloud,
  Spotify: FaSpotify,
  YouTube: FaYoutube,
} satisfies Record<ContentPlatform, unknown>;

/** Channel homes, from the real socials page. */
export const platformHome: Record<ContentPlatform, string> = {
  SoundCloud: "https://soundcloud.com/atmosmedia",
  Spotify: "https://open.spotify.com/user/31zgkcouzyfpwhb3pfixdpvlfaom",
  YouTube: "https://www.youtube.com/@Atmosmediatv",
};

export const contentDate = new Intl.DateTimeFormat("en-NZ", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Pacific/Auckland",
});
export const contentYear = (d: Date) =>
  d.toLocaleDateString("en-NZ", {
    year: "numeric",
    timeZone: "Pacific/Auckland",
  });

export const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

/**
 * One shared transport per page. Playback is simulated at 30x so the scrubber
 * visibly moves; the real one wraps the SoundCloud or YouTube embed.
 */
export function usePlayer() {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [wantsPlay, setWantsPlay] = useState(false);
  const [position, setPosition] = useState(0);
  const playing = wantsPlay && position < duration;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => setPosition((p) => Math.min(p + 30, duration)),
      1000,
    );
    return () => clearInterval(id);
  }, [playing, duration]);

  const toggle = (item: ContentEntry) => {
    if (item.id !== currentId) {
      setCurrentId(item.id);
      setDuration(item.duration ?? 0);
      setPosition(0);
      setWantsPlay(true);
      return;
    }
    if (position >= duration) setPosition(0);
    setWantsPlay(!playing);
  };

  return {
    currentId,
    playing,
    isPlaying: (id: string) => playing && id === currentId,
    positionOf: (id: string) => (id === currentId ? position : 0),
    seek: setPosition,
    toggle,
  };
}
export type Player = ReturnType<typeof usePlayer>;

/** Accent range input for a playable item. */
export function Scrubber({
  item,
  player,
  className,
}: {
  item: ContentEntry;
  player: Player;
  className?: string;
}) {
  const duration = item.duration ?? 0;
  const position = player.positionOf(item.id);
  const pct = duration ? (position / duration) * 100 : 0;
  const active = player.currentId === item.id;
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={`scrub-${item.id}`} className="sr-only">
        Position in {item.title}
      </label>
      <input
        id={`scrub-${item.id}`}
        type="range"
        min={0}
        max={duration}
        step={1}
        value={position}
        disabled={!active}
        onChange={(e) => player.seek(Number(e.target.value))}
        aria-valuetext={`${clock(position)} of ${clock(duration)}`}
        style={{
          background: `linear-gradient(to right, var(--mx-accent) ${pct}%, rgb(255 255 255 / 0.18) ${pct}%)`,
        }}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:cursor-default [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
      />
      <div className="mx-num mt-2 flex justify-between text-[12px] text-white/60">
        <span>{clock(position)}</span>
        <span>
          {active ? `-${clock(duration - position)}` : clock(duration)}
        </span>
      </div>
    </div>
  );
}

/** Type filter as pill segments, with counts. Zero-count types stay pressable so the empty result is honest. */
export function KindFilter({
  items,
  value,
  onChange,
  className,
}: {
  items: readonly ContentEntry[];
  value: ContentKind | "all";
  onChange: (v: ContentKind | "all") => void;
  className?: string;
}) {
  const options = [
    { key: "all", label: "All", count: items.length },
    ...kinds.map((k) => ({
      key: k,
      label: kindPlural[k],
      count: items.filter((i) => i.kind === k).length,
    })),
  ] as const;
  return (
    <div
      role="group"
      aria-label="Type"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "mx-label flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[11px] transition-colors",
            value === o.key
              ? "border-white bg-white text-black"
              : "border-white/15 text-white/70 hover:border-white/40 hover:text-white",
          )}
        >
          {o.label}
          <span
            className={cn(
              "mx-num text-[10px]",
              value === o.key ? "text-black/55" : "text-white/45",
            )}
          >
            {o.count}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Nothing published at all. Real copy from the live page. */
export function ContentEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 border border-white/10 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-white/15">
        <Disc3 className="size-5 text-white/60" />
      </span>
      <p className="mx-display text-2xl">No content</p>
      <p className="max-w-[34ch] text-[14px] text-white/60">
        Check back soon for new drops. Until then, Atmos Selects lives on
        SoundCloud and Spotify.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {(["SoundCloud", "Spotify"] as const).map((p) => {
          const Icon = platformIcon[p];
          return (
            <a
              key={p}
              href={platformHome[p]}
              target="_blank"
              rel="noreferrer"
              className="mx-label inline-flex h-10 items-center gap-2 rounded-full border border-white/40 px-5 text-[11px] hover:border-white hover:bg-white/5"
            >
              <Icon className="size-4" /> {p}
            </a>
          );
        })}
      </div>
    </div>
  );
}

/** A filter or search with nothing in it. */
export function ContentNoResults({
  body,
  onClear,
}: {
  body: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 border border-white/10 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-white/15">
        <Search className="size-5 text-white/60" />
      </span>
      <p className="mx-display text-2xl">No matches</p>
      <p className="max-w-[34ch] text-[14px] text-white/60">{body}</p>
      <Button variant="outline" onClick={onClear}>
        Show everything
      </Button>
    </div>
  );
}

/** Static skeleton bar. No shimmer. */
export function Bar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("rounded-full bg-white/[0.08]", className)}
    />
  );
}
