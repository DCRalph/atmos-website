"use client";

import { useState } from "react";
import { cn } from "~/lib/utils";
import {
  fmtDay,
  fmtYear,
  groupConsecutive,
} from "~/components/site/gigs/gig-parts";
import type { ProfileSection } from "~/lib/artist-sections";
import type { ResolvedTheme } from "~/lib/artist-theme";
import {
  ClaimBand,
  OnNowTag,
  Photo,
  Role,
  SetPoster,
  SetTimer,
  SocialLinks,
  TicketPill,
  isHeadline,
  nextSet,
  setHref,
  setIsTba,
  setMeta,
  setTitle,
  useSetOnNow,
  useTicketCta,
  type ClaimState,
} from "../parts";
import { ProfileSections } from "../sections";
import { About, nameLength, pastSetsLine } from "./shared";
import type { ProfileSet, PublicProfile } from "../types";

type Of<T extends ProfileSection["type"]> = Extract<
  ProfileSection,
  { type: T }
>;

/**
 * Wall. Type first, posters second: their name set edge to edge, one strip of
 * who they are, then their sections, with their sets drawn as a wall of
 * posters grouped by year. Their history with Atmos is the profile.
 */
export function WallLayout({
  profile,
  theme,
  claim,
}: {
  profile: PublicProfile;
  theme: ResolvedTheme;
  claim: ClaimState;
}) {
  return (
    <>
      <Masthead profile={profile} />
      <ClaimBand profile={profile} claim={claim} className="mt-10" />
      <ProfileSections
        profile={profile}
        accent={theme.accent}
        tone={theme.tone}
        gigs={{ upcoming: ComingUp, past: Archive }}
        className="px-5 py-14 md:px-10 md:py-20"
      />
      <About profile={profile} className="border-t border-[var(--cp-line)]" />
    </>
  );
}

function Masthead({ profile }: { profile: PublicProfile }) {
  const next = nextSet(profile);
  const intro = profile.bio?.split(/\n\s*\n/)[0]?.trim();
  return (
    <header className="px-5 pt-24 md:px-10 md:pt-32">
      <div className="@container">
        <h1
          className="cp-display text-[calc(100cqw/(var(--len)*var(--cp-display-em))*0.98)] leading-[0.82] whitespace-nowrap"
          style={nameLength(profile.name)}
        >
          {profile.name}
        </h1>
      </div>

      <div className="mt-8 grid grid-cols-[96px_minmax(0,1fr)] gap-x-5 gap-y-6 border-y border-[var(--cp-line)] py-6 md:grid-cols-[140px_minmax(0,1fr)] lg:grid-cols-[140px_minmax(0,1fr)_auto] lg:items-end lg:gap-x-10">
        {profile.portrait ? (
          <Photo
            src={profile.portrait}
            alt={profile.name}
            sizes="140px"
            className="aspect-[4/5] rounded-[var(--cp-r-media)]"
          />
        ) : (
          <div
            aria-hidden
            className="@container flex aspect-[4/5] items-center justify-center rounded-[var(--cp-r-media)] bg-[var(--cp-raised)] shadow-[inset_0_0_0_1px_var(--cp-line)]"
          >
            <span className="cp-display text-[60cqw] leading-none text-[var(--cp-faint)]">
              {profile.name.slice(0, 1)}
            </span>
          </div>
        )}
        <div className="min-w-0 self-end">
          <p className="text-[17px] text-[var(--cp-ink)] md:text-[19px]">
            {profile.tagline ?? pastSetsLine(profile)}
          </p>
          {intro ? (
            <p className="mt-2 line-clamp-2 max-w-[60ch] text-[15px] text-[var(--cp-muted)]">
              {intro}
            </p>
          ) : null}
          <SocialLinks profile={profile} className="mt-5 max-lg:hidden" />
        </div>
        <SocialLinks profile={profile} className="col-span-2 lg:hidden" />
        {next ? <NextUp set={next} /> : null}
      </div>
    </header>
  );
}

/** The next set as one compact block with a timer, on the right of the strip. */
function NextUp({ set }: { set: ProfileSet }) {
  return (
    <div className="col-span-2 flex flex-wrap items-end gap-x-6 gap-y-4 lg:col-span-1 lg:justify-end">
      <div className="min-w-0">
        <p className="t-label text-[11px] text-[var(--cp-muted)]">
          {fmtDay(set.start)} · {set.venue}
        </p>
        <p className="cp-display mt-2 text-2xl [overflow-wrap:anywhere]">
          <a href={setHref(set)} className="hover:text-[var(--cp-accent-text)]">
            {setTitle(set)}
          </a>
        </p>
        <div className="mt-4">
          <SetTimer set={set} compact onGround />
        </div>
      </div>
      <TicketPill set={set} size="lg" />
    </div>
  );
}

const posterGrid =
  "grid grid-cols-2 gap-x-3 gap-y-10 pt-6 sm:grid-cols-3 md:gap-x-5 lg:grid-cols-4 xl:grid-cols-5";

function GroupHeading({
  title,
  count,
  faint,
}: {
  title: string;
  count: number;
  faint?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-[var(--cp-line)] pb-4">
      <h2
        className={cn(
          "cp-display text-[clamp(2.5rem,8vw,6rem)] [overflow-wrap:anywhere]",
          faint ? "text-[var(--cp-faint)]" : "text-[var(--cp-ink)]",
        )}
      >
        {title}
      </h2>
      <span className="t-label shrink-0 text-[11px] text-[var(--cp-muted)] tabular-nums">
        {count} {count === 1 ? "set" : "sets"}
      </span>
    </div>
  );
}

function ComingUp({
  section,
  profile,
}: {
  section: Of<"GIG_LIST">;
  profile: PublicProfile;
}) {
  return (
    <section>
      <GroupHeading
        title={section.title || "Coming up"}
        count={profile.upcoming.length}
      />
      <ul className={posterGrid}>
        {profile.upcoming.map((set) => (
          <WallCard key={set.id} set={set} upcoming showRole />
        ))}
      </ul>
    </section>
  );
}

type Filter = "all" | "headline" | "b2b";

const filters: {
  id: Filter;
  label: string;
  test: (s: ProfileSet) => boolean;
}[] = [
  { id: "all", label: "All", test: () => true },
  { id: "headline", label: "Headline", test: isHeadline },
  {
    id: "b2b",
    label: "B2B",
    test: (s) => !!s.role && /b2b|back to back/i.test(s.role),
  },
];

/** Past sets by year, with sticky filters when there's more than one kind. */
function Archive({
  section,
  profile,
}: {
  section: Of<"PAST_GIGS">;
  profile: PublicProfile;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const sets = section.includeUpcoming
    ? [...profile.upcoming, ...profile.past]
    : profile.past;
  const options = filters
    .map((f) => ({ ...f, count: sets.filter(f.test).length }))
    .filter((f) => f.count > 0);
  const test = filters.find((f) => f.id === filter)!.test;
  const groups = groupConsecutive(sets.filter(test), (s) =>
    setIsTba(s) ? "TBA" : fmtYear(s.start),
  );

  return (
    <section>
      {section.title ? (
        <h2 className="cp-display mb-6 text-[clamp(2.25rem,6vw,4.75rem)] [overflow-wrap:anywhere]">
          {section.title}
        </h2>
      ) : null}
      {options.length > 1 ? (
        <div className="no-scrollbar sticky top-16 z-20 -mx-5 flex items-center gap-1 overflow-x-auto bg-[color-mix(in_oklab,var(--cp-ground)_92%,transparent)] px-5 py-3 backdrop-blur-md md:top-20 md:-mx-10 md:px-10">
          {options.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "t-label h-9 shrink-0 rounded-full px-4 text-[10px] transition-colors",
                filter === f.id
                  ? "bg-[var(--cp-ink)] text-[var(--cp-ground)]"
                  : "text-[var(--cp-muted)] hover:text-[var(--cp-ink)]",
              )}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
      ) : null}
      {groups.map((g) => (
        <div key={g.key} className="pt-10 md:pt-14">
          <GroupHeading title={g.key} count={g.items.length} faint />
          <ul className={posterGrid}>
            {g.items.map((set) => (
              <WallCard key={set.id} set={set} showRole={section.showRole} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * One poster. Upcoming ones carry a notched tab under the art (one square
 * corner, joined to the poster) with the date and ticket state.
 */
function WallCard({
  set,
  upcoming,
  showRole,
}: {
  set: ProfileSet;
  upcoming?: boolean;
  showRole?: boolean;
}) {
  const onNow = useSetOnNow(set);
  const cta = useTicketCta()(set);
  const buyable = cta.tone === "buy" || cta.tone === "external";
  return (
    <li>
      <a
        href={cta.href && upcoming ? cta.href : setHref(set)}
        className="group block"
      >
        <div className="relative">
          <SetPoster
            set={set}
            className={cn(
              "aspect-[4/5]",
              upcoming
                ? "rounded-t-[var(--cp-r-media)]"
                : "rounded-[var(--cp-r-media)]",
            )}
            sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, 50vw"
          />
          {onNow ? <OnNowTag className="absolute top-3 left-3" /> : null}
        </div>
        {upcoming ? (
          <div
            className={cn(
              "@container rounded-b-[var(--cp-r-media)] px-3 py-2.5",
              buyable
                ? "bg-[var(--cp-accent)] text-[var(--cp-accent-ink)]"
                : "bg-[var(--cp-raised)] text-[var(--cp-muted)]",
            )}
          >
            <span className="flex flex-col gap-1.5 @[200px]:flex-row @[200px]:items-center @[200px]:justify-between @[200px]:gap-3">
              <span className="t-label text-[10px] whitespace-nowrap tabular-nums">
                {setIsTba(set) ? "Date TBA" : fmtDay(set.start)}
              </span>
              <span className="t-label truncate text-[10px] opacity-80">
                {cta.label}
              </span>
            </span>
          </div>
        ) : null}
        <p className="cp-display mt-3 line-clamp-2 text-[15px] leading-tight group-hover:text-[var(--cp-accent-text)] md:text-[17px]">
          {setTitle(set)}
        </p>
        <p className="mt-1.5 truncate text-[13px] text-[var(--cp-muted)]">
          {upcoming ? set.venue : setMeta(set)}
        </p>
        {showRole ? <Role set={set} className="mt-2 block" /> : null}
      </a>
    </li>
  );
}
