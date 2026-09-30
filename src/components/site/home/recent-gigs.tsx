"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { gigPath } from "~/lib/gig-url";
import { Button, Skeleton } from "../ui";
import {
  GigPoster,
  SectionEmpty,
  SectionError,
  SectionHeader,
  nzDate,
} from "./parts";

type RecentGig = RouterOutputs["homeGigs"]["getHomeRecent"]["pastGigs"][number];

const cardClass = "w-[62vw] shrink-0 snap-start sm:w-[280px]";

/** Admin-curated past gigs (featured first) as a horizontal poster rail. */
export function RecentGigs() {
  const recent = api.homeGigs.getHomeRecent.useQuery();
  const gigs = recent.data
    ? [recent.data.featuredGig, ...recent.data.pastGigs].filter(
        (g): g is RecentGig => g !== null,
      )
    : [];

  if (recent.isPending)
    return (
      <Shell>
        <div aria-busy className="flex gap-4 overflow-hidden px-5 md:px-10">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={cardClass}>
              <Skeleton className="aspect-[4/5]" />
              <Skeleton className="mt-4 h-5 w-3/4 rounded-full" />
              <Skeleton className="mt-2.5 h-3 w-1/2 rounded-full" />
            </div>
          ))}
        </div>
      </Shell>
    );

  if (recent.isError)
    return (
      <Shell>
        <div className="px-5 md:px-10">
          <SectionError
            what="past gigs"
            onRetry={() => void recent.refetch()}
          />
        </div>
      </Shell>
    );

  if (gigs.length === 0)
    return (
      <Shell>
        <div className="px-5 md:px-10">
          <SectionEmpty>No past gigs yet.</SectionEmpty>
        </div>
      </Shell>
    );

  return <PosterRail gigs={gigs} />;
}

function Shell({
  children,
  arrows,
}: {
  children: React.ReactNode;
  arrows?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="home-recent" className="pb-16 md:pb-24">
      <div className="px-5 md:px-10">
        <SectionHeader
          id="home-recent"
          title="Recent gigs"
          href="/gigs"
          linkLabel="All gigs"
        >
          {arrows}
        </SectionHeader>
      </div>
      {children}
    </section>
  );
}

/** The rail itself. Arrows appear on desktop only when it overflows. */
function PosterRail({ gigs }: { gigs: RecentGig[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () =>
      setEdges({
        start: rail.scrollLeft <= 1,
        end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1,
      });
    update();
    rail.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    return () => {
      rail.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [gigs.length]);

  const scroll = (dir: 1 | -1) =>
    railRef.current?.scrollBy({
      left: dir * railRef.current.clientWidth * 0.8,
      behavior: "smooth",
    });

  return (
    <Shell
      arrows={
        edges.start && edges.end ? null : (
          <div className="mr-1 hidden gap-2 md:flex">
            <Button
              variant="outline"
              aria-label="Scroll back"
              disabled={edges.start}
              onClick={() => scroll(-1)}
              className="size-11 px-0"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              variant="outline"
              aria-label="Scroll forward"
              disabled={edges.end}
              onClick={() => scroll(1)}
              className="size-11 px-0"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
        )
      }
    >
      <div
        ref={railRef}
        className="flex snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] gap-4 overflow-x-auto px-5 pb-2 md:scroll-px-10 md:px-10"
      >
        {gigs.map((gig) => {
          const photos = gig.media.filter((m) => m.type === "photo").length;
          return (
            <Link
              key={gig.id}
              href={gigPath(gig)}
              className={`group ${cardClass}`}
            >
              <div className="relative">
                <GigPoster
                  gig={gig}
                  sizes="(min-width: 640px) 280px, 62vw"
                  className="aspect-[4/5] transition-opacity group-hover:opacity-85"
                />
                {photos ? (
                  <span className="glass t-label absolute right-2 bottom-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px]">
                    <Images className="size-3.5" /> {photos} photos
                  </span>
                ) : null}
              </div>
              <p className="t-display mt-4 line-clamp-2 text-lg break-words normal-case transition-colors group-hover:text-[var(--site-accent-text)]">
                {gig.title}
              </p>
              <p className="t-label mt-2 truncate text-[10px] text-white/55">
                {[nzDate.full.format(gig.gigStartTime), gig.subtitle]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </Link>
          );
        })}
      </div>
    </Shell>
  );
}
