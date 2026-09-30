"use client";

import { ArrowUpRight } from "lucide-react";
import type { IconType } from "react-icons";
import { FaSoundcloud, FaSpotify, FaYoutube } from "react-icons/fa6";
import { api, type RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Skeleton } from "../ui";
import { SectionEmpty, SectionError, SectionHeader, nzDate } from "./parts";

type ContentItem = NonNullable<
  RouterOutputs["homeContent"]["getHomeLatest"]["featuredItem"]
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

/** Admin-curated latest content: the featured item large, the rest as rows. */
export function LatestContent() {
  const latest = api.homeContent.getHomeLatest.useQuery();
  const featured = latest.data?.featuredItem;

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
      ) : !featured ? (
        <SectionEmpty>Nothing published yet.</SectionEmpty>
      ) : (
        <div className="grid gap-x-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <FeaturedItem item={featured} />
          {latest.data.items.length ? (
            <ul className="max-lg:mt-2">
              {latest.data.items.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** Kind, platform and date. */
function Meta({ item }: { item: ContentItem }) {
  const platform = platformOf(item);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="t-label rounded-[var(--site-r-chip)] border border-white/20 px-2 py-1.5 text-[9px] text-white/75">
        {item.type}
      </span>
      {platform ? (
        <span className="inline-flex items-center gap-2 text-white/70">
          {platform.Icon ? <platform.Icon className="size-4 shrink-0" /> : null}
          <span className="t-label text-[10px]">{platform.label}</span>
        </span>
      ) : null}
      <span className="t-label text-[10px] text-white/55 tabular-nums">
        {nzDate.full.format(item.date)}
      </span>
    </div>
  );
}

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

function FeaturedItem({ item }: { item: ContentItem }) {
  const platform = platformOf(item);
  return (
    <a
      href={item.link}
      {...external}
      className="group block border-t border-white/15 py-6"
    >
      <Meta item={item} />
      <h3 className="t-display mt-6 text-[clamp(1.75rem,3.5vw,3rem)] break-words transition-colors group-hover:text-[var(--site-accent-text)]">
        {item.title}
      </h3>
      {item.dj ? (
        <p className="mt-3 text-[16px] text-white/85">with {item.dj}</p>
      ) : null}
      <p className="mt-3 line-clamp-3 max-w-[56ch] text-[15px] text-white/65">
        {item.description}
      </p>
      <span className="t-label mt-6 inline-flex items-center gap-1.5 text-[11px] text-white/70 group-hover:text-white">
        {platform ? `Open on ${platform.label}` : "Open"}
        <ArrowUpRight className="size-3.5" />
      </span>
    </a>
  );
}

function ItemRow({ item }: { item: ContentItem }) {
  return (
    <li>
      <a
        href={item.link}
        {...external}
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-t border-white/15 py-6"
      >
        <div className="min-w-0">
          <Meta item={item} />
          <p className="t-display mt-4 line-clamp-2 text-xl break-words transition-colors group-hover:text-[var(--site-accent-text)]">
            {item.title}
          </p>
          <p className="mt-2 truncate text-[14px] text-white/60">
            {item.dj ? `with ${item.dj} · ` : null}
            {item.description}
          </p>
        </div>
        <ArrowUpRight className="mt-1 size-4 text-white/50 group-hover:text-white" />
      </a>
    </li>
  );
}

function ContentSkeleton() {
  const block = (large: boolean) => (
    <div className="space-y-4 border-t border-white/15 py-6">
      <Skeleton className="h-6 w-48 rounded-full" />
      <Skeleton
        className={cn("rounded-full", large ? "h-10 w-3/4" : "h-6 w-1/2")}
      />
      <Skeleton className="h-3.5 w-2/3 rounded-full" />
    </div>
  );
  return (
    <div aria-busy className="grid gap-x-10 lg:grid-cols-2">
      {block(true)}
      <div>
        {block(false)}
        {block(false)}
      </div>
    </div>
  );
}
