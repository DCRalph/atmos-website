"use client";

import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { SoundCloudPlayer } from "~/components/soundcloud-player";
import { YouTubePlayer } from "~/components/youtube-player";
import { LexicalContent } from "~/components/lexical";
import { buildMediaUrl } from "~/lib/media-url";
import { type CreatorBlockTypeName } from "./block-types";

export type PublicBlock = {
  id: string;
  type: CreatorBlockTypeName;
  x: number;
  y: number;
  w: number;
  h: number;
  data: Record<string, unknown>;
};

export type PublicSocial = {
  platform: string;
  url: string;
  label: string | null;
};

export type PublicGigAttribution = {
  id: string;
  role: string | null;
  gig: {
    id: string;
    title: string;
    subtitle: string | null;
    gigStartTime: Date;
    gigEndTime: Date | null;
    posterFileUploadId: string | null;
    mode: string;
  };
};

export function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1) || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts") {
        return parts[1] ?? null;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function toSpotifyEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("spotify.com")) return null;
    if (u.pathname.startsWith("/embed/")) return u.toString();
    return `https://open.spotify.com/embed${u.pathname}`;
  } catch {
    return null;
  }
}

function getString(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return typeof v === "string" ? v : "";
}

function getArray<T>(data: Record<string, unknown>, key: string): T[] {
  const v = data[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

export function BlockRenderer({
  block,
  socials,
  gigAttributions,
  accent,
}: {
  block: PublicBlock;
  socials?: PublicSocial[];
  gigAttributions?: PublicGigAttribution[];
  accent?: string | null;
}) {
  switch (block.type) {
    case "HEADING": {
      const level = Number((block.data as Record<string, unknown>).level) || 2;
      const text = getString(block.data, "text") || "Heading";
      const align = getString(block.data, "align") || "left";
      const Tag = (
        level <= 1
          ? "h1"
          : level === 2
            ? "h2"
            : level === 3
              ? "h3"
              : "h4"
      ) as React.ElementType;
      const sizeClass =
        level === 1
          ? "text-4xl md:text-5xl font-bold"
          : level === 2
            ? "text-3xl md:text-4xl font-bold"
            : level === 3
              ? "text-2xl md:text-3xl font-semibold"
              : "text-xl md:text-2xl font-semibold";
      return (
        <Tag
          className={`${sizeClass}`}
          style={{ textAlign: align as "left" | "center" | "right" }}
        >
          {text}
        </Tag>
      );
    }
    case "RICH_TEXT": {
      const lexical = block.data.lexical;
      const hasLexical =
        typeof lexical === "object" &&
        lexical !== null &&
        "root" in (lexical as Record<string, unknown>);
      if (!hasLexical) {
        return <div className="h-full overflow-auto" />;
      }
      return (
        <div className="h-full overflow-auto">
          <LexicalContent
            value={lexical}
            namespace={`creator-block-render-${block.id}`}
            contentClassName="text-foreground text-sm leading-relaxed"
          />
        </div>
      );
    }
    case "IMAGE": {
      const url = getString(block.data, "url");
      const alt = getString(block.data, "alt") || "";
      if (!url) {
        return (
          <div className="bg-muted text-muted-foreground grid h-full w-full place-items-center rounded-md text-sm">
            No image selected
          </div>
        );
      }
      return (
        <div className="relative h-full w-full overflow-hidden rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="h-full w-full object-cover" />
        </div>
      );
    }
    case "GALLERY": {
      const urls = getArray<string>(block.data, "urls");
      if (!urls.length) {
        return (
          <div className="bg-muted text-muted-foreground grid h-full w-full place-items-center rounded-md text-sm">
            Empty gallery
          </div>
        );
      }
      return (
        <div className="grid h-full w-full grid-cols-2 gap-2 md:grid-cols-3">
          {urls.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={u}
              alt=""
              className="h-full w-full rounded-md object-cover"
            />
          ))}
        </div>
      );
    }
    case "SOUNDCLOUD_TRACK": {
      const url = getString(block.data, "url");
      if (!url)
        return (
          <div className="bg-muted text-muted-foreground grid h-full place-items-center rounded-md text-sm">
            No SoundCloud URL
          </div>
        );
      return (
        <SoundCloudPlayer
          url={url}
          size="default"
          params={accent ? { color: accent.replace("#", "") } : undefined}
        />
      );
    }
    case "SOUNDCLOUD_PLAYLIST": {
      const url = getString(block.data, "url");
      if (!url)
        return (
          <div className="bg-muted text-muted-foreground grid h-full place-items-center rounded-md text-sm">
            No SoundCloud URL
          </div>
        );
      return (
        <SoundCloudPlayer
          url={url}
          size="square"
          params={accent ? { color: accent.replace("#", "") } : undefined}
        />
      );
    }
    case "YOUTUBE_VIDEO": {
      const url = getString(block.data, "url");
      const id = getYouTubeId(url);
      if (!id)
        return (
          <div className="bg-muted text-muted-foreground grid h-full place-items-center rounded-md text-sm">
            Invalid YouTube URL
          </div>
        );
      return <YouTubePlayer videoId={id} title="YouTube video" />;
    }
    case "SPOTIFY_EMBED": {
      const url = getString(block.data, "url");
      const src = toSpotifyEmbedSrc(url);
      if (!src)
        return (
          <div className="bg-muted text-muted-foreground grid h-full place-items-center rounded-md text-sm">
            Invalid Spotify URL
          </div>
        );
      return (
        <iframe
          title="Spotify"
          src={src}
          width="100%"
          height="100%"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          loading="lazy"
          className="h-full w-full rounded-md"
        />
      );
    }
    case "SOCIAL_LINKS":
      return (
        <div className="flex flex-wrap gap-2">
          {(socials ?? []).map((s, i) => (
            <Link
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-accent hover:bg-accent/80 rounded-full px-4 py-2 text-sm"
              style={accent ? { color: accent } : undefined}
            >
              {s.label ?? s.platform}
            </Link>
          ))}
          {(!socials || socials.length === 0) && (
            <span className="text-muted-foreground text-sm">
              No socials configured
            </span>
          )}
        </div>
      );
    case "LINK_LIST": {
      const links = getArray<{ label: string; url: string }>(
        block.data,
        "links",
      );
      return (
        <div className="flex h-full flex-col gap-2 overflow-auto">
          {links.map((l, i) => (
            <Link
              key={i}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card hover:bg-accent/40 rounded-md border px-3 py-2 text-sm"
            >
              {l.label || l.url}
            </Link>
          ))}
          {links.length === 0 && (
            <span className="text-muted-foreground text-sm">No links yet</span>
          )}
        </div>
      );
    }
    case "GIG_LIST": {
      const attributions = gigAttributions ?? [];
      if (!attributions.length) {
        return (
          <div className="text-muted-foreground text-sm">
            No gigs attributed yet
          </div>
        );
      }
      return (
        <div className="grid h-full grid-cols-2 gap-3 overflow-auto md:grid-cols-3">
          {attributions.map((g) => (
            <Link
              key={g.id}
              href={`/gigs/${g.gig.id}`}
              className="bg-card hover:bg-accent/40 rounded-md border p-3 text-sm"
            >
              {g.gig.posterFileUploadId && (
                <div className="relative mb-2 aspect-video overflow-hidden rounded">
                  <Image
                    src={buildMediaUrl(g.gig.posterFileUploadId)}
                    alt={g.gig.title}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="font-medium">{g.gig.title}</div>
              {g.role && (
                <div className="text-muted-foreground text-xs">{g.role}</div>
              )}
              <div className="text-muted-foreground text-xs">
                {new Date(g.gig.gigStartTime).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </Link>
          ))}
        </div>
      );
    }
    case "CONTENT_LIST":
      return (
        <div className="text-muted-foreground text-sm">
          Content list — coming soon
        </div>
      );
    case "DIVIDER":
      return <div className="border-border h-full border-t-2" />;
    case "SPACER":
      return <div className="h-full w-full" />;
    case "CUSTOM_EMBED": {
      const url = getString(block.data, "url");
      if (!url)
        return (
          <div className="bg-muted text-muted-foreground grid h-full place-items-center rounded-md text-sm">
            No embed URL
          </div>
        );
      return (
        <iframe
          title="Embed"
          src={url}
          className="h-full w-full rounded-md"
          allow="autoplay; encrypted-media; picture-in-picture"
          loading="lazy"
        />
      );
    }
    default:
      return null;
  }
}
