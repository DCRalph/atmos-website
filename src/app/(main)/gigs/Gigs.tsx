"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { StaticBackground } from "~/components/static-background";
import { PastGigCard } from "~/components/gigs/past-gig-card";
import { AnimatedPageHeader } from "~/components/animated-page-header";
import { MainPageSection } from "~/components/main-page-section";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

/**
 * The gigs page: one grid at a time, chosen by the tabs under the header.
 *
 * The three lists are fetched together rather than on demand, so switching tabs
 * is instant and the counts beside each label are known without a query of
 * their own. None of them is paginated, so the counts are exact.
 *
 * Nothing is re-sorted here. Every list arrives in the order the server means
 * it to be in — unannounced gigs after announced ones, and past gigs in the
 * order an admin arranged them — and sorting again in the browser threw both
 * away. It used to sort upcoming gigs by start time, which put TBA gigs, whose
 * stand-in date is redacted to 1970, at the top of the page.
 */

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "affiliated", label: "Past affiliated" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function GigsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("upcoming");

  const upcoming = api.gigs.getUpcoming.useQuery();
  const past = api.gigs.getPast.useQuery({ kind: "OURS" });
  const affiliated = api.gigs.getPast.useQuery({ kind: "AFFILIATED" });

  const panels = {
    upcoming: {
      query: upcoming,
      empty: "No upcoming gigs",
      isUpcoming: true,
    },
    past: {
      query: past,
      empty: "No past gigs yet",
      isUpcoming: false,
    },
    affiliated: {
      query: affiliated,
      empty: "No affiliated gigs yet",
      isUpcoming: false,
    },
  } satisfies Record<TabId, unknown>;

  const active = panels[activeTab];
  const gigs = active.query.data ?? [];

  return (
    <main className="min-h-content bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-46.jpg" />

      <MainPageSection>
        <AnimatedPageHeader
          title="GIGS & EVENTS"
          subtitle="Upcoming events and past nights from Atmos"
        />

        {/* The rail is pulled down two pixels so each tab's own bottom border
            lands on the track below it. */}
        <div className="mb-8 border-b-2 border-white/10 sm:mb-10">
          <div
            role="tablist"
            aria-label="Gigs"
            className="-mb-[2px] flex items-center gap-5 overflow-x-auto sm:gap-7"
          >
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              const count = panels[tab.id].query.data?.length;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "border-b-2 pb-3 text-[11px] font-black tracking-wider whitespace-nowrap uppercase transition-colors sm:pb-4 sm:text-sm md:text-base",
                    isActive
                      ? "border-accent-muted text-white"
                      : "border-transparent text-white/40 hover:text-white/75",
                  )}
                >
                  {tab.label}
                  {/* Hidden on the narrowest phones, where three labels and
                      three counts are wider than the screen. */}
                  {count !== undefined && (
                    <span className="ml-2 hidden text-[11px] text-white/30 sm:inline">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-3">
          {active.query.isLoading ? (
            <div className="col-span-full flex items-center justify-center border-2 border-white/10 bg-black/80 py-12 backdrop-blur-sm">
              <Loader2 className="text-accent-muted h-6 w-6 animate-spin" />
            </div>
          ) : gigs.length > 0 ? (
            gigs.map((gig) => (
              <PastGigCard
                key={gig.id}
                gig={gig}
                upcomming={active.isUpcoming}
              />
            ))
          ) : (
            <div className="col-span-full border-2 border-white/10 bg-black/80 p-8 text-center backdrop-blur-sm">
              <p className="font-bold tracking-wider text-white/60 uppercase">
                {active.empty}
              </p>
            </div>
          )}
        </div>
      </MainPageSection>
    </main>
  );
}
