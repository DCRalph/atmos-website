"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import {
  fmtDay,
  fmtMonth,
  fmtTime,
  fmtYear,
  groupConsecutive,
} from "~/components/site/gigs/gig-parts";
import { cn } from "~/lib/utils";
import type { ProfileSection } from "~/lib/artist-sections";
import type { ResolvedTheme } from "~/lib/artist-theme";
import {
  CalendarTile,
  ClaimBand,
  MoreLink,
  OnNowTag,
  Photo,
  Pill,
  Role,
  RoundButton,
  SectionHeading,
  Segmented,
  SetPoster,
  SocialLinks,
  TicketPill,
  nextSet,
  setHref,
  setIsTba,
  setMeta,
  setTitle,
  useSetOnNow,
  type ClaimState,
} from "../parts";
import { ProfileSections, sectionAnchor } from "../sections";
import { HeroEditButton } from "../editor/hero-edit-button";
import {
  BioTile,
  firstMusicAnchor,
  nameLength,
  pastSetsLine,
  shortBio,
} from "./shared";
import type { ProfileSet, PublicProfile } from "../types";

type Of<T extends ProfileSection["type"]> = Extract<
  ProfileSection,
  { type: T }
>;

/**
 * Headliner. Header A: the artist's photo as atmosphere (darkened, an accent
 * glow, fading into the page), their mark framed like a record sleeve, and
 * their name, what they do and every action together in one block. Their
 * sets run along the bottom of the header, then their grid of tiles.
 */
export function HeadlinerLayout({
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
      <Hero profile={profile} />
      <ClaimBand profile={profile} claim={claim} />
      <ProfileSections
        profile={profile}
        accent={theme.accent}
        tone={theme.tone}
        gigs={{ upcoming: Agenda, past: Carousel }}
        className="px-5 pt-5 pb-16 md:px-10 md:pt-12 md:pb-24"
      />
      <AboutTile profile={profile} />
    </>
  );
}

function Hero({ profile }: { profile: PublicProfile }) {
  const next = nextSet(profile);
  const backdrop = profile.banner ?? profile.portrait;
  const listen = firstMusicAnchor(profile);
  const link = profile.sections.find((s) => s.type === "LINK_LIST")?.links[0];
  const upcoming = profile.upcoming.length > 0;
  const strip = upcoming ? profile.upcoming : profile.past;
  const meta = [
    shortBio(profile.bio),
    strip.length ? pastSetsLine(profile) : null,
  ].filter(Boolean);

  return (
    <section className="relative isolate flex min-h-[600px] flex-col justify-end overflow-hidden md:min-h-[min(680px,100dvh)]">
      <HeroEditButton />
      {backdrop ? (
        <Photo
          src={backdrop}
          alt=""
          priority
          sizes="100vw"
          className="cp-hero-photo absolute -inset-6 -z-10 blur-[1.5px]"
          position="50% 40%"
        />
      ) : null}
      <div aria-hidden className="cp-hero-glow absolute inset-0 -z-10" />
      <div aria-hidden className="cp-hero-fade absolute inset-0 -z-10" />

      <div className="px-5 pt-28 pb-5 md:px-10 md:pt-32 md:pb-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:gap-10">
          <Mark profile={profile} />
          <div className="@container min-w-0 flex-1">
            {profile.tagline ? (
              <p className="t-label text-[11px] leading-[1.45] text-[var(--cp-muted)] md:text-[12px]">
                {profile.tagline}
              </p>
            ) : null}
            <h1
              className="cp-display mt-4 text-[min(9.5rem,var(--cp-name-cap),calc(100cqw/(var(--len)*var(--cp-display-em))*0.97))] [overflow-wrap:anywhere]"
              style={nameLength(profile.name)}
            >
              {profile.name}
            </h1>
            {meta.length ? (
              <p className="mt-4 max-w-[60ch] text-[14px] text-[var(--cp-muted)] md:text-[15px]">
                {meta.join(" · ")}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {next ? (
                <TicketPill set={next} size="lg" />
              ) : listen ? (
                <Pill href={`#${listen}`} variant="accent" size="lg">
                  <Play className="size-4 fill-current" /> Listen
                </Pill>
              ) : null}
              {next && listen ? (
                <Pill href={`#${listen}`} variant="outline" size="lg">
                  <Play className="size-4" /> Listen
                </Pill>
              ) : link ? (
                <Pill href={link.url} variant="outline" size="lg">
                  <span className="max-w-[16ch] truncate">
                    {link.label || "Link"}
                  </span>
                </Pill>
              ) : null}
              <SocialLinks profile={profile} glass className="md:ml-2" />
            </div>
          </div>
        </div>

        {strip.length ? (
          <SetsStrip
            profile={profile}
            sets={strip.slice(0, 3)}
            upcoming={upcoming}
          />
        ) : null}
      </div>
    </section>
  );
}

/** Their photo (or their initial) in a frame, like a record sleeve. */
export function Mark({
  profile,
  className = "w-26 md:w-54",
}: {
  profile: PublicProfile;
  className?: string;
}) {
  return (
    <div className={cn("cp-tile shrink-0 rounded-tl-none !p-2", className)}>
      {profile.portrait ? (
        <Photo
          src={profile.portrait}
          alt={profile.name}
          sizes="216px"
          className="cp-media aspect-square rounded-[max(0px,calc(var(--cp-r-panel)-8px))] rounded-tl-none"
        />
      ) : (
        <div
          aria-hidden
          className="@container flex aspect-square items-center justify-center rounded-[max(0px,calc(var(--cp-r-panel)-8px))] rounded-tl-none bg-[var(--cp-raised)]"
        >
          <span className="cp-display text-[56cqw] leading-none text-[var(--cp-faint)]">
            {profile.name.slice(0, 1)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Their next sets (or, with none booked, their latest) along the bottom of
 * the header: a bar on wider screens, a row of posters on phones.
 */
function SetsStrip({
  profile,
  sets,
  upcoming,
}: {
  profile: PublicProfile;
  sets: ProfileSet[];
  upcoming: boolean;
}) {
  const total = upcoming ? profile.upcoming.length : profile.past.length;
  const more = (
    <MoreLink href={railMoreHref(profile, !upcoming)} className="shrink-0">
      {upcoming ? `All ${total} upcoming` : `All ${total} sets`}
    </MoreLink>
  );
  return (
    <>
      <div className="cp-tile mt-10 hidden items-center gap-8 !py-4 md:flex">
        <span className="t-label w-32 shrink-0 text-[11px] leading-snug text-[var(--cp-muted)]">
          {upcoming ? "Coming up" : "Recently with Atmos"}
        </span>
        <ul className="flex min-w-0 flex-1 gap-8">
          {sets.map((set) => (
            <li key={set.id} className="min-w-0">
              <a href={setHref(set)} className="group flex items-center gap-4">
                <SetPoster
                  set={set}
                  className="cp-media aspect-[4/5] w-10 shrink-0 rounded-[min(var(--cp-r-media),4px)]"
                  sizes="40px"
                />
                <span className="min-w-0">
                  <span className="cp-display block truncate text-[14px] leading-tight group-hover:text-[var(--cp-accent-text)]">
                    {setTitle(set)}
                  </span>
                  <span className="mt-1 block truncate text-[12.5px] text-[var(--cp-muted)]">
                    {setMeta(set)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        {more}
      </div>

      <div className="-mx-5 mt-8 md:hidden">
        <ul className="no-scrollbar flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5">
          {sets.map((set) => (
            <li key={set.id} className="w-[7.25rem] shrink-0 snap-start">
              <a href={setHref(set)} className="group block">
                <SetPoster
                  set={set}
                  className="cp-media aspect-[4/5] rounded-[var(--cp-r-media)]"
                  sizes="116px"
                />
                <span className="cp-display mt-2 block truncate text-[12px] leading-tight">
                  {setTitle(set)}
                </span>
                <span className="mt-1 block truncate text-[12px] text-[var(--cp-muted)]">
                  {setIsTba(set) ? "Date TBA" : fmtDay(set.start)}
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-4 px-5">{more}</div>
      </div>
    </>
  );
}

/** Where the strip's "all" link goes: the matching section if the page has one. */
function railMoreHref(profile: PublicProfile, recent: boolean) {
  const section = profile.sections.find(
    (s) => s.type === (recent ? "PAST_GIGS" : "GIG_LIST"),
  );
  return section ? `#${sectionAnchor(section)}` : "/gigs";
}

/** A bio too long for the header, as a tile closing the page. */
function AboutTile({ profile }: { profile: PublicProfile }) {
  if (!profile.bio || shortBio(profile.bio)) return null;
  return (
    <div id="about" className="scroll-mt-36 px-5 pb-16 md:px-10 md:pb-24">
      <BioTile bio={profile.bio} />
    </div>
  );
}

// ---------------------------------------------------------------------------

const views = [
  { id: "list", label: "List" },
  { id: "grid", label: "Grid" },
] as const;

/** Upcoming sets by month, each month headed by a calendar tile. */
export function Agenda({
  section,
  profile,
}: {
  section: Of<"GIG_LIST">;
  profile: PublicProfile;
}) {
  const [view, setView] = useState<"list" | "grid">("list");
  const groups = groupConsecutive(profile.upcoming, (s) =>
    setIsTba(s) ? "TBA" : fmtMonth(s.start),
  );

  return (
    <section>
      <SectionHeading
        title={section.title}
        aside={
          <Segmented
            label="View"
            options={views}
            value={view}
            onChange={setView}
          />
        }
      />
      {groups.map((g) => {
        const first = g.items[0]!;
        return (
          <div key={g.key}>
            <h3 className="flex items-center gap-4 border-b border-[var(--cp-line-soft)] py-3">
              {g.key === "TBA" ? (
                <span className="t-label text-[12px] text-[var(--cp-muted)]">
                  Date to be announced
                </span>
              ) : (
                <>
                  <CalendarTile date={first.start} />
                  <span className="t-label text-[12px] text-[var(--cp-muted)]">
                    {fmtMonth(first.start).split(" ")[0]}
                    <span className="sr-only"> {fmtYear(first.start)}</span>
                  </span>
                </>
              )}
            </h3>
            {view === "list" ? (
              <ul>
                {g.items.map((s) => (
                  <AgendaRow key={s.id} set={s} />
                ))}
              </ul>
            ) : (
              <ul className="grid grid-cols-2 gap-x-3 gap-y-8 py-6 @3xl:grid-cols-4 @3xl:gap-x-5">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <a href={setHref(s)} className="group block">
                      <SetPoster
                        set={s}
                        className="aspect-[4/5] rounded-[var(--cp-r-media)]"
                        sizes="(min-width: 768px) 25vw, 50vw"
                      />
                      <p className="cp-display mt-3 text-[15px] leading-tight group-hover:text-[var(--cp-accent-text)] @3xl:text-[18px]">
                        {setTitle(s)}
                      </p>
                      <p className="mt-1.5 text-[13px] text-[var(--cp-muted)]">
                        {setMeta(s)}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

function AgendaRow({ set }: { set: ProfileSet }) {
  const onNow = useSetOnNow(set);
  return (
    <li className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-[var(--cp-line-soft)] py-5 @lg:grid-cols-[72px_minmax(0,1fr)_auto] @2xl:grid-cols-[104px_minmax(0,1fr)_auto] @2xl:gap-x-7">
      <SetPoster
        set={set}
        fit="contain"
        className="aspect-square w-[72px] rounded-[var(--cp-r-media)] @2xl:w-[104px]"
        sizes="104px"
      />
      <div className="min-w-0">
        {onNow ? <OnNowTag className="mb-2" /> : null}
        <p className="cp-display text-lg leading-tight [overflow-wrap:anywhere] @2xl:text-[26px]">
          <a href={setHref(set)} className="hover:text-[var(--cp-accent-text)]">
            {setTitle(set)}
          </a>
        </p>
        <p className="mt-1.5 text-[13px] text-[var(--cp-muted)] @2xl:text-[15px]">
          {setMeta(set)}
          {setIsTba(set) ? "" : ` · ${fmtTime(set.start)}`}
        </p>
        <Role set={set} className="mt-2 block" />
      </div>
      <TicketPill
        set={set}
        size="md"
        className="col-start-2 w-fit @lg:col-start-3"
      />
    </li>
  );
}

/** Past sets as a poster carousel, like the reference's past events. */
export function Carousel({
  section,
  profile,
}: {
  section: Of<"PAST_GIGS">;
  profile: PublicProfile;
}) {
  const scroller = useRef<HTMLUListElement>(null);
  const sets = section.includeUpcoming
    ? [...profile.upcoming, ...profile.past]
    : profile.past;
  const scroll = (dir: 1 | -1) =>
    scroller.current?.scrollBy({
      left: dir * scroller.current.clientWidth * 0.8,
      behavior: "smooth",
    });

  // Arrows only when the posters run past the edge, each off at its end.
  const [edges, setEdges] = useState({ more: false, start: true, end: true });
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const next = {
        more: el.scrollWidth > el.clientWidth + 1,
        start: el.scrollLeft <= 1,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
      };
      setEdges((prev) =>
        prev.more === next.more &&
        prev.start === next.start &&
        prev.end === next.end
          ? prev
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <section>
      <SectionHeading
        title={section.title}
        aside={
          edges.more ? (
            <div className="flex gap-2">
              <RoundButton
                label="Previous"
                disabled={edges.start}
                onClick={() => scroll(-1)}
              >
                <ArrowLeft className="size-5" />
              </RoundButton>
              <RoundButton
                label="Next"
                disabled={edges.end}
                onClick={() => scroll(1)}
              >
                <ArrowRight className="size-5" />
              </RoundButton>
            </div>
          ) : null
        }
      >
        <p className="mt-4 text-[15px] text-[var(--cp-muted)]">
          {pastSetsLine(profile)}
        </p>
      </SectionHeading>
      <ul
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto @2xl:gap-5"
      >
        {sets.map((s) => (
          <li
            key={s.id}
            className="w-[200px] shrink-0 snap-start @2xl:w-[260px]"
          >
            <a href={setHref(s)} className="group block">
              <SetPoster
                set={s}
                className="aspect-[4/5] rounded-[var(--cp-r-media)]"
                sizes="260px"
              />
              <p className="cp-display mt-3 line-clamp-2 text-[15px] leading-tight group-hover:text-[var(--cp-accent-text)] @2xl:text-[18px]">
                {setTitle(s)}
              </p>
              <p className="mt-1.5 text-[13px] text-[var(--cp-muted)]">
                {setMeta(s)}
              </p>
              {section.showRole ? (
                <Role set={s} className="mt-2 block" />
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
