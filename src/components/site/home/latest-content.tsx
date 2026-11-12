"use client";

import type { CSSProperties, ReactNode } from "react";
import { Play } from "lucide-react";
import type { IconType } from "react-icons";
import { FaSoundcloud, FaSpotify, FaYoutube } from "react-icons/fa6";
import { api, type RouterOutputs } from "~/trpc/react";
import { YouTubePlayer } from "~/components/youtube-player";
import { HOME_GRID_COLUMNS, contentVideoId } from "~/lib/home-content";
import { cn } from "~/lib/utils";
import { Media, Skeleton } from "../ui";
import { SectionEmpty, SectionError, SectionHeader, nzDate } from "./parts";

type Tile = RouterOutputs["homeContent"]["getHomeLatest"][number];
type ContentItem = Tile["item"];

// Stored platform casing varies ("soundcloud", "Soundcloud"), so match loosely.
const platforms: Record<string, { label: string; Icon: IconType }> = {
  soundcloud: { label: "SoundCloud", Icon: FaSoundcloud },
  spotify: { label: "Spotify", Icon: FaSpotify },
  youtube: { label: "YouTube", Icon: FaYoutube },
};

function platformOf(item: ContentItem) {
  const key =
    item.platform?.trim().toLowerCase() ??
    (item.linkType.startsWith("SOUNDCLOUD")
      ? "soundcloud"
      : item.linkType === "YOUTUBE_VIDEO"
        ? "youtube"
        : "");
  return (
    platforms[key] ??
    (item.platform ? { label: item.platform, Icon: null } : null)
  );
}

/**
 * Three squares across on desktop, each tile placed in its saved cell. Phones
 * get two across in the same reading order, growing down as far as it needs;
 * dense flow closes the gaps a two-square video would leave. `--gap` lets a
 * video's height match one square exactly.
 */
const gridClass =
  "grid grid-flow-dense grid-cols-2 items-start gap-x-(--gap) gap-y-6 [--gap:0.75rem] md:grid-cols-3 md:gap-y-8 md:[--gap:2rem]";
const tileClass = "min-w-0 md:col-start-(--col) md:row-start-(--row)";
const spanClass = (span: 1 | 2) => (span === 2 ? "col-span-2" : "col-span-1");

function cellStyle(slot: number) {
  return {
    "--col": (slot % HOME_GRID_COLUMNS) + 1,
    "--row": Math.floor(slot / HOME_GRID_COLUMNS) + 1,
  } as CSSProperties;
}

/** Home's content section: a 3 x 2 grid of squares, with YouTube videos two squares wide. */
export function LatestContent() {
  const latest = api.homeContent.getHomeLatest.useQuery();

  return (
    <section
      aria-labelledby="home-content"
      className="px-5 pb-16 md:px-10 md:pb-24"
    >
      <SectionHeader
        id="home-content"
        title="Latest content"
        href="/content"
        linkLabel="All content"
      />
      {latest.isPending ? (
        <ContentSkeleton />
      ) : latest.isError ? (
        <SectionError what="content" onRetry={() => void latest.refetch()} />
      ) : !latest.data.length ? (
        <SectionEmpty>Nothing published yet.</SectionEmpty>
      ) : (
        <ul className={gridClass}>
          {latest.data.map((tile) => (
            <li
              key={tile.item.id}
              style={cellStyle(tile.slot)}
              className={cn(tileClass, spanClass(tile.span))}
            >
              {tile.span === 2 ? (
                <VideoTile item={tile.item} />
              ) : (
                <ContentCard item={tile.item} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Two squares wide and one tall. The invisible square sets the height, so it lines up with its row. */
function TwoSquareFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative bg-white/5">
      <div
        aria-hidden
        className="aspect-square w-[calc((100%-var(--gap))/2)]"
      />
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

function VideoTile({ item }: { item: ContentItem }) {
  const videoId = contentVideoId(item);
  if (!videoId) return <ContentCard item={item} />;
  return (
    <article>
      <TwoSquareFrame>
        <YouTubePlayer videoId={videoId} title={item.title} fill />
      </TwoSquareFrame>
      <h3 className="t-display mt-3 text-sm leading-tight break-words normal-case sm:text-base md:mt-4 md:text-xl">
        {item.title}
      </h3>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/65 md:text-sm">
        <span className="inline-flex items-center gap-1.5">
          <FaYoutube className="size-3 md:size-4" /> YouTube
        </span>
        {item.dj ? <span>{item.dj}</span> : null}
        <span>{nzDate.full.format(item.date)}</span>
      </p>
    </article>
  );
}

function ContentCard({ item }: { item: ContentItem }) {
  const platform = platformOf(item);

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
    >
      <div className="relative">
        {item.imageUrl ? (
          <Media
            src={item.imageUrl}
            alt=""
            sizes="(min-width: 768px) 33vw, 50vw"
            className="aspect-square transition-opacity group-hover:opacity-85"
          />
        ) : (
          <div className="flex aspect-square items-center justify-center bg-white/5 text-white/40">
            {platform?.Icon ? <platform.Icon className="size-1/4" /> : null}
          </div>
        )}
        <span className="t-label pointer-events-none absolute top-0 left-0 bg-black px-1.5 py-1.5 text-[8px] text-white md:px-2.5 md:py-2 md:text-[9px]">
          {item.type}
        </span>
        <span
          aria-hidden
          className="absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-full bg-white text-black md:right-4 md:bottom-4 md:size-10"
        >
          <Play className="ml-0.5 size-4 md:size-5" fill="currentColor" />
        </span>
      </div>
      <h3 className="t-display group-hover:text-site-accent-text mt-3 text-sm leading-tight break-words normal-case transition-colors sm:text-base md:mt-4 md:text-xl">
        {item.title}
      </h3>
      {item.dj ? (
        <p className="mt-2 text-xs break-words text-white/85 md:text-base">
          {item.dj}
        </p>
      ) : null}
      {platform ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-white/65 md:text-sm">
          <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
            {platform.Icon ? (
              <platform.Icon className="size-3 shrink-0 md:size-4" />
            ) : null}
            {platform.label}
          </span>
        </p>
      ) : null}
    </a>
  );
}

const skeletonSpans: (1 | 2)[] = [2, 1, 1, 1, 1];

function ContentSkeleton() {
  return (
    <div aria-busy aria-label="Loading latest content" className={gridClass}>
      {skeletonSpans.map((span, i) => (
        <div key={i} className={spanClass(span)}>
          {span === 2 ? (
            <TwoSquareFrame>
              <Skeleton className="size-full" />
            </TwoSquareFrame>
          ) : (
            <Skeleton className="aspect-square" />
          )}
          <Skeleton className="mt-4 h-5 w-3/4" />
          <Skeleton className="mt-2 h-3.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}
