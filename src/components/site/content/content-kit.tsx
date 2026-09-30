"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, Disc3, Play, Search } from "lucide-react";
import { FaSoundcloud, FaSpotify, FaYoutube } from "react-icons/fa6";
import type { IconType } from "react-icons";
import { SoundCloudPlayer } from "~/components/soundcloud-player";
import { YouTubePlayer } from "~/components/youtube-player";
import { SOCIALS } from "~/lib/site-constants";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/react";
import { SiteDialog } from "../overlays";
import { Button, buttonVariants, IconButton, Media } from "../ui";

type ContentItem = RouterOutputs["content"]["getAll"][number];

/** Platforms we brand, in the order the channel links show under the page title. */
export const channels = [
  {
    key: "soundcloud",
    label: "SoundCloud",
    Icon: FaSoundcloud,
    href: SOCIALS.soundcloud.href,
  },
  {
    key: "spotify",
    label: "Spotify",
    Icon: FaSpotify,
    href: SOCIALS.spotify.href,
  },
  {
    key: "youtube",
    label: "YouTube",
    Icon: FaYoutube,
    href: SOCIALS.youtube.href,
  },
] as const;

/** Keyed lowercase because stored casing varies ("soundcloud", "Soundcloud"). */
const platforms = new Map<string, { label: string; Icon: IconType }>(
  channels.map((c) => [c.key, c]),
);

/**
 * Items have no artwork of their own yet, so each gets a stable gig photo as
 * its cover, picked by id so it doesn't move when new drops land.
 */
const covers = [
  "/home/atmos-10.jpg",
  "/home/atmos-6.jpg",
  "/home/atmos-8.jpg",
  "/home/atmos-46.jpg",
  "/home/atmos-17.jpg",
  "/home/atmos-9.jpg",
  "/home/atmos-15.jpg",
  "/home/atmos-1.jpg",
] as const;

const coverFor = (id: string) => {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return covers[hash % covers.length] ?? covers[0];
};

const typeLabels: Record<string, { one: string; many: string }> = {
  mix: { one: "Mix", many: "Mixes" },
  playlist: { one: "Playlist", many: "Playlists" },
  video: { one: "Video", many: "Videos" },
};

/** Types always offered as filters, even at zero, so an empty result reads as honest. */
export const baseKinds = ["mix", "playlist", "video"] as const;

export function kindLabel(kind: string, plural = false) {
  const known = typeLabels[kind];
  if (known) return plural ? known.many : known.one;
  const word = kind.charAt(0).toUpperCase() + kind.slice(1);
  return plural ? `${word}s` : word;
}

export const contentDate = new Intl.DateTimeFormat("en-NZ", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Pacific/Auckland",
});

/** A content row plus what the page derives from it: type key, platform branding, cover and embed. */
export function toEntry(item: ContentItem) {
  const rawPlatform = item.platform?.trim() ?? "";
  const platformKey = rawPlatform === "" ? null : rawPlatform.toLowerCase();
  const known = platformKey ? platforms.get(platformKey) : undefined;
  const embed =
    item.embedUrl &&
    (item.linkType === "SOUNDCLOUD_TRACK" ||
      item.linkType === "SOUNDCLOUD_PLAYLIST")
      ? ({ kind: "soundcloud", url: item.embedUrl } as const)
      : item.embedUrl && item.linkType === "YOUTUBE_VIDEO"
        ? ({ kind: "youtube", id: item.embedUrl } as const)
        : null;
  return {
    ...item,
    kind: item.type.trim().toLowerCase(),
    platformKey,
    platformLabel: known?.label ?? (rawPlatform === "" ? null : rawPlatform),
    PlatformIcon: known?.Icon ?? null,
    cover: coverFor(item.id),
    embed,
  };
}
export type ContentEntry = ReturnType<typeof toEntry>;

const metaLine = (e: ContentEntry) =>
  [e.dj, kindLabel(e.kind), e.platformLabel, contentDate.format(e.date)]
    .filter(Boolean)
    .join(" · ");

/** Type filter as pill segments with counts. */
export function KindFilter({
  entries,
  kinds,
  value,
  onChange,
  className,
}: {
  entries: readonly ContentEntry[];
  kinds: readonly string[];
  value: string;
  onChange: (kind: string) => void;
  className?: string;
}) {
  const options = [
    { key: "all", label: "All", count: entries.length },
    ...kinds.map((k) => ({
      key: k,
      label: kindLabel(k, true),
      count: entries.filter((e) => e.kind === k).length,
    })),
  ];
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
            "t-label flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[11px] transition-colors",
            value === o.key
              ? "border-white bg-white text-black"
              : "border-white/15 text-white/70 hover:border-white/40 hover:text-white",
          )}
        >
          {o.label}
          <span
            className={cn(
              "text-[10px] tabular-nums",
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

/** Record-shop cover: square art, type tag, play affordance for embeddable items. Opens the detail dialog. */
export function CoverCard({
  entry,
  featured,
  onOpen,
}: {
  entry: ContentEntry;
  featured: boolean;
  onOpen: () => void;
}) {
  return (
    <article
      className={cn("group min-w-0", featured && "col-span-2 lg:row-span-2")}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${entry.title}${entry.dj ? ` with ${entry.dj}` : ""}`}
          className="block w-full"
        >
          <Media
            src={entry.cover}
            alt=""
            sizes={
              featured
                ? "(min-width: 1024px) 50vw, 100vw"
                : "(min-width: 1024px) 25vw, 50vw"
            }
            className="aspect-square transition-opacity group-hover:opacity-85"
            priority={featured}
          />
        </button>
        <span className="t-label pointer-events-none absolute top-0 left-0 bg-black px-2.5 py-2 text-[9px] text-white">
          {kindLabel(entry.kind)}
        </span>
        {entry.embed ? (
          <IconButton
            label={`${entry.embed.kind === "youtube" ? "Watch" : "Play"} ${entry.title}`}
            onClick={onOpen}
            className={cn("absolute right-3 bottom-3", featured && "size-14")}
          >
            <Play className="ml-0.5 size-5" fill="currentColor" />
          </IconButton>
        ) : null}
      </div>
      <h3
        className={cn(
          "t-display mt-4 break-words",
          featured
            ? "text-[clamp(1.75rem,3.2vw,2.75rem)]"
            : "line-clamp-2 text-base sm:text-xl",
        )}
      >
        {entry.title}
      </h3>
      <p className="t-label mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/60">
        {entry.dj ? <span className="text-white/85">{entry.dj}</span> : null}
        {entry.platformLabel ? <span>{entry.platformLabel}</span> : null}
        <span className="tabular-nums">{contentDate.format(entry.date)}</span>
      </p>
      {featured ? (
        <p className="mt-3 max-w-[52ch] text-[15px] text-white/70">
          {entry.description}
        </p>
      ) : null}
    </article>
  );
}

/** Detail for a cover: the real SoundCloud or YouTube embed when there is one, otherwise the off-site link. */
export function CoverDialog({
  entry,
  onClose,
}: {
  entry: ContentEntry | undefined;
  onClose: () => void;
}) {
  const openLabel = `Open on ${entry?.platformLabel ?? "site"}`;
  return (
    <SiteDialog
      open={entry !== undefined}
      onOpenChange={(open) => !open && onClose()}
      title={entry?.title ?? ""}
      description={entry ? metaLine(entry) : undefined}
      className="max-w-[560px] overflow-y-auto"
    >
      {entry ? (
        <div className="space-y-5 p-5">
          {entry.embed?.kind === "youtube" ? (
            <YouTubePlayer videoId={entry.embed.id} title={entry.title} />
          ) : (
            <Media
              src={entry.cover}
              alt=""
              sizes="560px"
              className="aspect-[16/9]"
            />
          )}
          {entry.embed?.kind === "soundcloud" ? (
            <SoundCloudPlayer
              url={entry.embed.url}
              title={entry.title}
              params={{
                auto_play: false,
                color: "#c6ff33",
                buying: false,
                sharing: false,
                download: false,
                show_playcount: false,
              }}
            />
          ) : null}
          <p className="text-[15px] text-white/75">{entry.description}</p>
          <a
            href={entry.link}
            target="_blank"
            rel="noopener noreferrer"
            className={
              entry.embed
                ? "t-label inline-flex items-center gap-1 text-[11px] text-white/70 hover:text-white"
                : buttonVariants()
            }
          >
            {openLabel} <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      ) : null}
    </SiteDialog>
  );
}

function Notice({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 border border-white/10 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-white/15">
        {icon}
      </span>
      <p className="t-display text-2xl">{title}</p>
      {children}
    </div>
  );
}

/** Nothing published yet: point at the channels that always have something. */
export function ContentEmpty() {
  return (
    <Notice
      icon={<Disc3 className="size-5 text-white/60" />}
      title="No content"
    >
      <p className="max-w-[34ch] text-[14px] text-white/60">
        Check back soon for new drops. Until then, Atmos Selects lives on
        SoundCloud and Spotify.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {[SOCIALS.soundcloud, SOCIALS.spotify].map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {s.label}
          </a>
        ))}
      </div>
    </Notice>
  );
}

/** A filter with nothing in it. */
export function ContentNoResults({
  body,
  onClear,
}: {
  body: string;
  onClear: () => void;
}) {
  return (
    <Notice
      icon={<Search className="size-5 text-white/60" />}
      title="No matches"
    >
      <p className="max-w-[34ch] text-[14px] text-white/60">{body}</p>
      <Button variant="outline" onClick={onClear}>
        Show everything
      </Button>
    </Notice>
  );
}

/** The request failed. */
export function ContentError({ onRetry }: { onRetry: () => void }) {
  return (
    <Notice
      icon={<Disc3 className="size-5 text-white/60" />}
      title="Couldn't load"
    >
      <p className="max-w-[34ch] text-[14px] text-white/60">
        Something went wrong loading content.
      </p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </Notice>
  );
}
