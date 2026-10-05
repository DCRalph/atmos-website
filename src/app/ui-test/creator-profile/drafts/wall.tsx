"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "~/lib/utils";
import {
  fmtDay,
  fmtYear,
  groupConsecutive,
} from "~/components/site/gigs/gig-parts";
import type { MockProfile, ProfileSet } from "../fixtures";
import {
  ClaimBand,
  LinkRows,
  OnNowTag,
  Photo,
  Poster,
  Role,
  SetTimer,
  SocialLinks,
  TicketPill,
  TrackPlayer,
  VideoTile,
  isHeadline,
  setMeta,
  useSetOnNow,
} from "../parts";

type Filter = "all" | "upcoming" | "headline" | "b2b";

const filters: {
  id: Filter;
  label: string;
  test: (s: ProfileSet, upcoming: boolean) => boolean;
}[] = [
  { id: "all", label: "All", test: () => true },
  { id: "upcoming", label: "Upcoming", test: (_, upcoming) => upcoming },
  { id: "headline", label: "Headline", test: (s) => isHeadline(s) },
  { id: "b2b", label: "B2B", test: (s) => !!s.role?.startsWith("B2B") },
];

/**
 * Draft B, Wall. Type first, posters second: their name set edge to edge,
 * one strip of who they are, then every set they've played as a wall of
 * posters, newest first, grouped by year with the upcoming ones on top.
 * Their history with Atmos is the profile.
 */
export function WallDraft({ profile }: { profile: MockProfile }) {
  return (
    <>
      <Masthead profile={profile} />
      <ClaimBand profile={profile} className="mt-10" />
      <PosterWall profile={profile} />
      <MediaBand profile={profile} />
      {profile.bio.length || profile.links.length ? (
        <section className="grid gap-10 border-t border-[var(--cp-line)] px-5 py-16 md:px-10 md:py-24 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="cp-display text-[clamp(2.25rem,6vw,4.75rem)]">
              About
            </h2>
            <div className="mt-8 max-w-[60ch] space-y-5 text-[17px] leading-relaxed text-[var(--cp-muted)]">
              {profile.bio.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
          <LinkRows profile={profile} className="lg:mt-3" />
        </section>
      ) : null}
    </>
  );
}

function Masthead({ profile }: { profile: MockProfile }) {
  const next = profile.upcoming.find((s) => s.start) ?? null;
  return (
    <header className="px-5 pt-24 md:px-10 md:pt-32">
      <div className="@container">
        <h1
          className="cp-display text-[calc(100cqw/(var(--len)*var(--cp-display-em))*0.98)] leading-[0.82] whitespace-nowrap"
          style={{ "--len": Math.max(profile.name.length, 4) } as CSSProperties}
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
            className="row-span-2 aspect-[4/5] rounded-[var(--cp-r-media)] lg:row-span-1"
          />
        ) : (
          <div className="row-span-2 flex aspect-[4/5] items-center justify-center rounded-[var(--cp-r-media)] bg-[var(--cp-raised)] lg:row-span-1">
            <span className="cp-display text-5xl text-[var(--cp-faint)]">
              {profile.name.slice(0, 1)}
            </span>
          </div>
        )}
        <div className="min-w-0 self-end">
          <p className="text-[17px] text-[var(--cp-ink)] md:text-[19px]">
            {profile.tagline ??
              `${profile.past.length + profile.upcoming.length} sets on Atmos lineups`}
          </p>
          {profile.bio[0] ? (
            <p className="mt-2 line-clamp-2 max-w-[60ch] text-[15px] text-[var(--cp-muted)]">
              {profile.bio[0]}
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

/** The next set as one compact line with a timer, on the right of the strip. */
function NextUp({ set }: { set: ProfileSet }) {
  return (
    <div className="col-span-2 flex flex-wrap items-end gap-x-6 gap-y-4 lg:col-span-1 lg:justify-end">
      <div>
        <p className="t-label text-[11px] text-[var(--cp-muted)]">
          {set.start ? fmtDay(set.start) : "TBA"} · {set.venue}
        </p>
        <p className="cp-display mt-2 text-2xl">{set.title}</p>
        <div className="mt-4">
          <SetTimer set={set} compact onGround />
        </div>
      </div>
      <TicketPill ticket={set.ticket} size="lg" />
    </div>
  );
}

function PosterWall({ profile }: { profile: MockProfile }) {
  const [filter, setFilter] = useState<Filter>("all");
  const all = [
    ...profile.upcoming.map((set) => ({ set, upcoming: true })),
    ...profile.past.map((set) => ({ set, upcoming: false })),
  ];
  const test = filters.find((f) => f.id === filter)!.test;
  const shown = all.filter(({ set, upcoming }) => test(set, upcoming));
  const groups = groupConsecutive(shown, ({ set, upcoming }) =>
    upcoming ? "Coming up" : set.start ? fmtYear(set.start) : "Undated",
  );

  return (
    <section className="py-12 md:py-16">
      <div className="no-scrollbar sticky top-16 z-20 flex items-center gap-1 overflow-x-auto bg-[color-mix(in_oklab,var(--cp-ground)_92%,transparent)] px-5 py-3 backdrop-blur-md md:top-20 md:px-10">
        {filters.map((f) => {
          const count = all.filter(({ set, upcoming }) =>
            f.test(set, upcoming),
          ).length;
          if (!count) return null;
          return (
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
              <span className="ml-1.5 tabular-nums opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {groups.map((g) => (
        <div key={g.key} className="px-5 pt-10 md:px-10 md:pt-14">
          <div className="flex items-baseline justify-between gap-6 border-b border-[var(--cp-line)] pb-4">
            <h2
              className={cn(
                "cp-display text-[clamp(2.5rem,8vw,6rem)]",
                g.key === "Coming up"
                  ? "text-[var(--cp-ink)]"
                  : "text-[var(--cp-faint)]",
              )}
            >
              {g.key}
            </h2>
            <span className="t-label text-[11px] text-[var(--cp-muted)] tabular-nums">
              {g.items.length} {g.items.length === 1 ? "set" : "sets"}
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-10 pt-6 sm:grid-cols-3 md:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
            {g.items.map(({ set, upcoming }) => (
              <WallCard key={set.id} set={set} upcoming={upcoming} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * One poster. Upcoming ones carry a notched accent tab under the art (one
 * square corner, joined to the poster) with the date and ticket state.
 */
function WallCard({ set, upcoming }: { set: ProfileSet; upcoming: boolean }) {
  const onNow = useSetOnNow(set);
  return (
    <li>
      <a href="#" className="group block">
        <div className="relative">
          <Poster
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
              set.ticket.tone === "buy"
                ? "bg-[var(--cp-accent)] text-[var(--cp-accent-ink)]"
                : "bg-[var(--cp-raised)] text-[var(--cp-muted)]",
            )}
          >
            <span className="flex flex-col gap-1.5 @[200px]:flex-row @[200px]:items-center @[200px]:justify-between @[200px]:gap-3">
              <span className="t-label text-[10px] whitespace-nowrap tabular-nums">
                {set.start ? fmtDay(set.start) : "Date TBA"}
              </span>
              <span className="t-label truncate text-[10px] opacity-80">
                {set.ticket.label}
              </span>
            </span>
          </div>
        ) : null}
        <p className="cp-display mt-3 line-clamp-2 text-[15px] leading-tight group-hover:text-[var(--cp-accent-text)] md:text-[17px]">
          {set.title}
        </p>
        <p className="mt-1.5 truncate text-[13px] text-[var(--cp-muted)]">
          {upcoming ? set.venue : setMeta(set)}
        </p>
        <Role set={set} className="mt-2 block" />
      </a>
    </li>
  );
}

function MediaBand({ profile }: { profile: MockProfile }) {
  if (!profile.tracks.length && !profile.video && !profile.gallery.length)
    return null;
  return (
    <section className="grid gap-14 border-t border-[var(--cp-line)] px-5 py-16 md:px-10 md:py-24 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16">
      {profile.tracks.length ? (
        <div>
          <h2 className="cp-display mb-10 text-[clamp(2.25rem,6vw,4.75rem)]">
            Listen
          </h2>
          <TrackPlayer profile={profile} layout="stacked" />
        </div>
      ) : null}
      <div className="space-y-14">
        {profile.video ? (
          <div>
            <h2 className="cp-display mb-10 text-[clamp(2.25rem,6vw,4.75rem)]">
              Watch
            </h2>
            <VideoTile video={profile.video} />
          </div>
        ) : null}
        {profile.gallery.length ? (
          <div className="grid grid-cols-3 gap-2">
            {profile.gallery.slice(0, 6).map((src) => (
              <Photo
                key={src}
                src={src}
                alt=""
                sizes="15vw"
                className="aspect-square rounded-[var(--cp-r-media)]"
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
