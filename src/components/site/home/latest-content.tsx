"use client";

import { Play } from "lucide-react";
import type { IconType } from "react-icons";
import { FaSoundcloud, FaSpotify, FaYoutube } from "react-icons/fa6";
import { api, type RouterOutputs } from "~/trpc/react";
import { YouTubePlayer } from "~/components/youtube-player";
import { contentVideoId } from "~/lib/home-content";
import { Media, Skeleton } from "../ui";
import { SectionEmpty, SectionError, SectionHeader, nzDate } from "./parts";

type ContentItem = NonNullable<
  RouterOutputs["homeContent"]["getHomeLatest"]["video"]
>;

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

const gridClass = "grid grid-cols-3 items-start gap-x-3 gap-y-6 md:gap-8";

/** A full-width YouTube player followed by three equally sized content items. */
export function LatestContent() {
  const latest = api.homeContent.getHomeLatest.useQuery();
  const video = latest.data?.video;
  const videoId = video ? contentVideoId(video) : null;

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
      ) : !video && !latest.data.items.length ? (
        <SectionEmpty>Nothing published yet.</SectionEmpty>
      ) : (
        <div className="space-y-8 md:space-y-10">
          {video && videoId ? (
            <article>
              <YouTubePlayer videoId={videoId} title={video.title} />
              <h3 className="t-display mt-4 text-xl leading-tight break-words normal-case md:text-3xl">
                {video.title}
              </h3>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/65 md:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <FaYoutube className="size-4" /> YouTube
                </span>
                {video.dj ? <span>{video.dj}</span> : null}
                <span>{nzDate.full.format(video.date)}</span>
              </p>
            </article>
          ) : null}
          <ul className={gridClass}>
            {latest.data.items.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ContentCard({ item }: { item: ContentItem }) {
  const platform = platformOf(item);

  return (
    <li className="min-w-0">
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
      >
        {item.imageUrl ? (
          <div className="relative">
            <Media
              src={item.imageUrl}
              alt=""
              sizes="33vw"
              className="aspect-square transition-opacity group-hover:opacity-85"
            />
            <span className="t-label pointer-events-none absolute top-0 left-0 bg-black px-1.5 py-1.5 text-[7px] text-white md:px-2.5 md:py-2 md:text-[9px]">
              {item.type}
            </span>
            <span
              aria-hidden
              className="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full bg-white text-black md:right-4 md:bottom-4 md:size-10"
            >
              <Play className="ml-0.5 size-3.5 md:size-5" fill="currentColor" />
            </span>
          </div>
        ) : null}
        <h3 className="t-display group-hover:text-site-accent-text mt-3 text-xs leading-tight break-words normal-case transition-colors sm:text-base md:mt-4 md:text-xl">
          {item.title}
        </h3>
        {item.dj ? (
          <p className="mt-2 text-xs break-words text-white/85 md:text-base">
            {item.dj}
          </p>
        ) : null}
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-white/65 md:text-sm">
          {!item.imageUrl ? <span>{item.type}</span> : null}
          {platform ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
              {platform.Icon ? (
                <platform.Icon className="size-3 shrink-0 md:size-4" />
              ) : null}
              {platform.label}
            </span>
          ) : null}
        </p>
      </a>
    </li>
  );
}

function ContentSkeleton() {
  return (
    <div aria-busy aria-label="Loading latest content" className="space-y-8">
      <div>
        <Skeleton className="aspect-video" />
        <Skeleton className="mt-4 h-6 w-3/4" />
      </div>
      <div className={gridClass}>
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton className="aspect-square" />
            <Skeleton className="mt-4 h-5 w-3/4" />
            <Skeleton className="mt-2 h-3.5 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
