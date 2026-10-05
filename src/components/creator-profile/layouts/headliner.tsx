"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  fmtMonth,
  fmtTime,
  fmtYear,
  groupConsecutive,
} from "~/components/site/gigs/gig-parts";
import type { ProfileSection } from "~/lib/creator-sections";
import type { ResolvedTheme } from "~/lib/creator-theme";
import {
  CalendarTile,
  ClaimBand,
  MoreLink,
  OnNowTag,
  Photo,
  Pill,
  Poster,
  Role,
  RoundButton,
  SectionHeading,
  Segmented,
  SetPoster,
  SetTimer,
  SocialLinks,
  TicketPill,
  nextSet,
  setHref,
  setIsTba,
  setMeta,
  setTitle,
  useSetOnNow,
  useTicketCta,
  type ClaimState,
} from "../parts";
import { ProfileSections, sectionAnchor } from "../sections";
import { About, firstMusicAnchor, nameLength, pastSetsLine } from "./shared";
import type { ProfileSet, PublicProfile } from "../types";

type Of<T extends ProfileSection["type"]> = Extract<
  ProfileSection,
  { type: T }
>;

/**
 * Headliner. The DnB Allstars "next show" page turned into a person: their
 * photo and name own the left of the first viewport with the next set
 * counting down under it, the rest of their run in a rail on the right. Their
 * sections follow, then about, then their name signing off.
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
        className="px-5 py-16 md:px-10 md:py-24"
      />
      <About profile={profile} withPortrait />
      <SignOff name={profile.name} />
    </>
  );
}

function Hero({ profile }: { profile: PublicProfile }) {
  const next = nextSet(profile);
  const rest = profile.upcoming.filter((s) => s !== next);
  const backdrop = profile.banner ?? profile.portrait;
  const fallbackPoster = (next ?? profile.past[0])?.poster ?? null;
  const rail = rest.length
    ? { title: "Then", sets: rest.slice(0, 4), recent: false }
    : profile.past.length
      ? { title: "Recently", sets: profile.past.slice(0, 4), recent: true }
      : null;
  const listen = firstMusicAnchor(profile);

  return (
    <section
      className={cn(
        "relative grid min-h-[640px] lg:min-h-[min(820px,100dvh)]",
        rail && "lg:grid-cols-[minmax(0,1fr)_minmax(360px,34%)]",
      )}
    >
      <div className="relative flex flex-col justify-end overflow-hidden max-lg:min-h-[640px]">
        {backdrop ? (
          <Photo
            src={backdrop}
            alt=""
            priority
            sizes="(min-width: 1024px) 66vw, 100vw"
            className="absolute inset-0"
            position="50% 35%"
          />
        ) : fallbackPoster ? (
          // No photo yet: their latest poster, blurred into an atmosphere.
          <Poster
            title=""
            src={fallbackPoster}
            className="absolute inset-0 scale-110 opacity-70 blur-2xl"
            sizes="50vw"
          />
        ) : null}
        <div className="cp-scrim-bottom absolute inset-0" />
        <div className="cp-scrim-left absolute inset-0 max-lg:hidden" />
        <div className="cp-scrim-top absolute inset-x-0 top-0 h-40" />

        <div className="@container relative px-5 pt-32 pb-10 md:px-10 md:pb-14">
          <h1
            className="cp-display text-[min(9rem,calc(100cqw/(var(--len)*var(--cp-display-em))*0.97))] [overflow-wrap:anywhere]"
            style={nameLength(profile.name)}
          >
            {profile.name}
          </h1>
          {profile.tagline ? (
            <p className="t-label mt-5 text-[12px] leading-[1.45] text-[var(--cp-muted)] md:text-[13px]">
              {profile.tagline}
            </p>
          ) : !profile.claimed ? (
            <p className="t-label mt-5 text-[12px] text-[var(--cp-muted)]">
              {pastSetsLine(profile)}
            </p>
          ) : null}
          <SocialLinks profile={profile} glass className="mt-6" />

          {next ? (
            <NextSet set={next} />
          ) : listen ? (
            <Pill
              href={`#${listen}`}
              variant="accent"
              size="lg"
              className="mt-10"
            >
              Listen
            </Pill>
          ) : null}
        </div>
      </div>

      {rail ? (
        <aside
          aria-labelledby="rail-title"
          className="flex flex-col justify-center bg-[var(--cp-raised)] px-5 py-10 md:px-10 lg:px-[clamp(28px,3.2vw,56px)] lg:pt-32 lg:pb-12"
        >
          <h2
            id="rail-title"
            className="t-label mb-5 text-[11px] text-[var(--cp-faint)]"
          >
            {rail.title}
          </h2>
          <ol>
            {rail.sets.map((set) => (
              <RailItem key={set.id} set={set} recent={rail.recent} />
            ))}
          </ol>
          <MoreLink href={railMoreHref(profile, rail.recent)} className="mt-6">
            {rail.recent
              ? `All ${profile.past.length} past sets`
              : `All ${profile.upcoming.length} upcoming`}
          </MoreLink>
        </aside>
      ) : null}
    </section>
  );
}

/** Where the rail's "all" link goes: the matching section if the page has one. */
function railMoreHref(profile: PublicProfile, recent: boolean) {
  const section = profile.sections.find(
    (s) => s.type === (recent ? "PAST_GIGS" : "GIG_LIST"),
  );
  return section ? `#${sectionAnchor(section)}` : "/gigs";
}

function RailItem({ set, recent }: { set: ProfileSet; recent: boolean }) {
  const cta = useTicketCta()(set);
  const buyable = !recent && (cta.tone === "buy" || cta.tone === "external");
  const label = recent
    ? "View"
    : buyable
      ? "Tickets"
      : cta.tone === "muted"
        ? cta.label
        : "Details";
  return (
    <li>
      <a
        href={setHref(set)}
        className="group grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 border-t border-[var(--cp-line)] py-4"
      >
        <SetPoster
          set={set}
          className="aspect-[4/5] w-16 rounded-[min(var(--cp-r-media),4px)]"
          sizes="64px"
        />
        <span className="min-w-0">
          <span className="cp-display block truncate text-[17px] leading-tight group-hover:text-[var(--cp-accent-text)]">
            {setTitle(set)}
          </span>
          <span className="mt-1.5 block truncate text-[13px] text-[var(--cp-muted)]">
            {setMeta(set)}
          </span>
          <Role set={set} className="mt-2 block" />
        </span>
        <span
          className={cn(
            "t-label max-w-[9ch] text-right text-[10px] leading-tight",
            buyable ? "text-[var(--cp-accent-text)]" : "text-[var(--cp-faint)]",
          )}
        >
          {label}
        </span>
      </a>
    </li>
  );
}

/** The next set under the name: what, where, a countdown and the buy button. */
function NextSet({ set }: { set: ProfileSet }) {
  const onNow = useSetOnNow(set);
  return (
    <div className="mt-10 max-w-[600px] border-t border-[var(--cp-line)] pt-7">
      <p className="cp-display text-[clamp(1.5rem,3.2vw,2.5rem)] [overflow-wrap:anywhere]">
        <a href={setHref(set)} className="hover:text-[var(--cp-accent-text)]">
          {setTitle(set)}
        </a>
      </p>
      <p className="t-label mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-[var(--cp-muted)] md:text-[12px]">
        <span>{setMeta(set, { time: !onNow })}</span>
        <Role set={set} />
      </p>
      <div className="mt-6">
        <SetTimer set={set} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <TicketPill set={set} size="lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const views = [
  { id: "list", label: "List" },
  { id: "grid", label: "Grid" },
] as const;

/** Upcoming sets by month, each month headed by a calendar tile that sticks. */
function Agenda({
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
        className="mb-8"
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
            <h3 className="sticky top-16 z-10 flex items-center gap-4 border-b border-[var(--cp-line-soft)] bg-[color-mix(in_oklab,var(--cp-ground)_94%,transparent)] py-3 backdrop-blur-md md:top-20">
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
              <ul className="grid grid-cols-2 gap-x-3 gap-y-8 py-6 md:grid-cols-4 md:gap-x-5">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <a href={setHref(s)} className="group block">
                      <SetPoster
                        set={s}
                        className="aspect-[4/5] rounded-[var(--cp-r-media)]"
                        sizes="(min-width: 768px) 25vw, 50vw"
                      />
                      <p className="cp-display mt-3 text-[15px] leading-tight group-hover:text-[var(--cp-accent-text)] md:text-[18px]">
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
    <li className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-[var(--cp-line-soft)] py-5 sm:grid-cols-[72px_minmax(0,1fr)_auto] md:grid-cols-[104px_minmax(0,1fr)_auto] md:gap-x-7">
      <SetPoster
        set={set}
        fit="contain"
        className="aspect-square w-[72px] rounded-[var(--cp-r-media)] md:w-[104px]"
        sizes="104px"
      />
      <div className="min-w-0">
        {onNow ? <OnNowTag className="mb-2" /> : null}
        <p className="cp-display text-lg leading-tight [overflow-wrap:anywhere] md:text-[26px]">
          <a href={setHref(set)} className="hover:text-[var(--cp-accent-text)]">
            {setTitle(set)}
          </a>
        </p>
        <p className="mt-1.5 text-[13px] text-[var(--cp-muted)] md:text-[15px]">
          {setMeta(set)}
          {setIsTba(set) ? "" : ` · ${fmtTime(set.start)}`}
        </p>
        <Role set={set} className="mt-2 block" />
      </div>
      <TicketPill
        set={set}
        size="md"
        className="col-start-2 w-fit sm:col-start-3"
      />
    </li>
  );
}

/** Past sets as a poster carousel, like the reference's past events. */
function Carousel({
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

  return (
    <section>
      <SectionHeading
        title={section.title}
        className="mb-10"
        aside={
          sets.length > 2 ? (
            <div className="flex gap-2">
              <RoundButton label="Previous" onClick={() => scroll(-1)}>
                <ArrowLeft className="size-5" />
              </RoundButton>
              <RoundButton label="Next" onClick={() => scroll(1)}>
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
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 md:-mx-10 md:scroll-px-10 md:gap-5 md:px-10"
      >
        {sets.map((s) => (
          <li key={s.id} className="w-[200px] shrink-0 snap-start md:w-[260px]">
            <a href={setHref(s)} className="group block">
              <SetPoster
                set={s}
                className="aspect-[4/5] rounded-[var(--cp-r-media)]"
                sizes="260px"
              />
              <p className="cp-display mt-3 line-clamp-2 text-[15px] leading-tight group-hover:text-[var(--cp-accent-text)] md:text-[18px]">
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

/** Their name, oversized and cropped at the bottom: the site footer's logo move. */
function SignOff({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      className="@container overflow-hidden px-5 pt-10 select-none md:px-10"
    >
      <p
        className="cp-display translate-y-[22%] text-center text-[min(26rem,calc(100cqw/(var(--len)*var(--cp-display-em))*0.98))] leading-[0.8] whitespace-nowrap text-[var(--cp-line)]"
        style={nameLength(name)}
      >
        {name}
      </p>
    </div>
  );
}
