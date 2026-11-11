"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { buildMediaUrl } from "~/lib/media-url";
import { useTabParam } from "~/hooks/use-tab-param";
import { Button, Media, Skeleton, buttonVariants } from "../ui";
import { ArtistDialog } from "../gigs/lineup";
import { fmtShortMonth, fmtYear } from "../gigs/gig-parts";

type Artist = RouterOutputs["artistProfiles"]["publicList"][number];

const TABS = [
  { id: "all", label: "All" },
  { id: "profiles", label: "With profiles" },
] as const;

/** One artist: photo, name, how often they've played, and their profile when it's published. */
function ArtistCard({
  artist,
  onOpen,
}: {
  artist: Artist;
  onOpen: () => void;
}) {
  const gigs = `${artist.gigs} ${artist.gigs === 1 ? "gig" : "gigs"}`;
  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={onOpen}
        className="group text-left"
        aria-label={artist.displayName}
      >
        {artist.avatarFileId ? (
          <Media
            src={buildMediaUrl(artist.avatarFileId)}
            alt=""
            sizes="(min-width: 1024px) 220px, 50vw"
            className="aspect-square rounded-[var(--site-r-panel)] rounded-tl-none transition-opacity group-hover:opacity-85"
          />
        ) : (
          <span className="t-display flex aspect-square items-center justify-center rounded-[var(--site-r-panel)] rounded-tl-none bg-white/5 text-4xl text-white/30">
            {artist.displayName.slice(0, 1)}
          </span>
        )}
        <span className="t-display group-hover:text-site-accent-text mt-3.5 block text-base [overflow-wrap:anywhere] normal-case transition-colors md:text-lg">
          {artist.displayName}
        </span>
        <span className="mt-1.5 block text-[13px] text-white/55">
          {artist.lastPlayed
            ? `${gigs} · last ${fmtShortMonth(artist.lastPlayed)} ${fmtYear(artist.lastPlayed)}`
            : `${gigs} · first one coming up`}
        </span>
      </button>
      {artist.isPublished ? (
        <Link
          href={`/@${artist.handle}`}
          className={cn(buttonVariants({ size: "sm" }), "mt-3.5 w-fit")}
        >
          View profile <ArrowUpRight className="size-3.5" />
        </Link>
      ) : null}
    </li>
  );
}

function GridSkeleton() {
  return (
    <ul aria-busy className={grid}>
      {Array.from({ length: 10 }, (_, i) => (
        <li key={i} className="space-y-3">
          <Skeleton className="aspect-square rounded-[var(--site-r-panel)] rounded-tl-none" />
          <Skeleton className="h-4 w-2/3 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

const grid =
  "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

/**
 * Everyone who has played an announced Atmos gig, most gigs first. A card opens
 * the gig page's artist dialog; a published profile also gets a button to it.
 */
export function ArtistsPage() {
  const { value: tab, onValueChange: setTab } = useTabParam([
    "all",
    "profiles",
  ]);
  const { data, isPending, isError, refetch } =
    api.artistProfiles.publicList.useQuery();
  const [selected, setSelected] = useState<Artist | null>(null);
  const [open, setOpen] = useState(false);
  const summary = api.artistProfiles.publicSummary.useQuery(
    { handle: selected?.handle ?? "" },
    { enabled: selected !== null, staleTime: 5 * 60_000 },
  );

  const lists = {
    all: data,
    profiles: data?.filter((a) => a.isPublished),
  };
  const artists = lists[tab] ?? [];

  return (
    <div className="px-5 pt-14 pb-20 md:px-10">
      <h1 className="t-heading text-[clamp(2.75rem,8vw,6.5rem)]">Artists</h1>
      <p className="mt-4 max-w-[52ch] text-[16px] text-white/70">
        Everyone who has played an Atmos night.
      </p>

      <div
        role="tablist"
        aria-label="Artists"
        className="no-scrollbar mt-10 mb-8 flex gap-7 overflow-x-auto border-b border-white/10"
      >
        {TABS.map((t) => {
          const count = lists[t.id]?.length;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "t-label -mb-px flex shrink-0 items-baseline gap-2 border-b-2 pb-4 text-[11px] transition-colors md:text-[12px]",
                tab === t.id
                  ? "border-site-accent text-white"
                  : "border-transparent text-white/50 hover:text-white",
              )}
            >
              {t.label}
              {count !== undefined ? (
                <span className="text-[10px] text-white/45 tabular-nums">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {isPending ? (
        <GridSkeleton />
      ) : isError ? (
        <div role="alert" className="flex flex-col items-start gap-4">
          <p className="text-[15px] text-white/60">
            We couldn&apos;t load artists.
          </p>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : artists.length === 0 ? (
        <p className="border border-white/10 px-6 py-12 text-center text-[15px] text-white/60">
          No artists here yet
        </p>
      ) : (
        <ul className={grid}>
          {artists.map((artist) => (
            <ArtistCard
              key={artist.id}
              artist={artist}
              onOpen={() => {
                setSelected(artist);
                setOpen(true);
              }}
            />
          ))}
        </ul>
      )}

      {selected ? (
        <ArtistDialog
          lineUp={[{ id: selected.id, role: null, artistProfile: selected }]}
          index={0}
          onSelect={() => undefined}
          summary={summary.data}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </div>
  );
}
