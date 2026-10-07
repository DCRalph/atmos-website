"use client";

import { useContext, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { ScrollContainerContext } from "~/components/scroll-container-provider";
import {
  fmtDay,
  fmtDayNum,
  fmtTime,
  fmtWeekday,
} from "~/components/site/gigs/gig-parts";
import { sectionTitle, type ProfileSection } from "~/lib/artist-sections";
import type { ResolvedTheme } from "~/lib/artist-theme";
import {
  ClaimBand,
  OnNowTag,
  Photo,
  Pill,
  Poster,
  Role,
  SectionHeading,
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
import { BioText, firstMusicAnchor, nameLength } from "./shared";
import type { ProfileSet, PublicProfile } from "../types";

type Of<T extends ProfileSection["type"]> = Extract<
  ProfileSection,
  { type: T }
>;

/**
 * Stage. Link-in-bio first: on a phone their portrait fills the screen with
 * the things people came for stacked as big pills. On desktop that portrait
 * becomes a column that stays put while the right side scrolls like a press
 * kit, with tabs (one per titled section) that track where you are.
 */
export function StageLayout({
  profile,
  theme,
  claim,
}: {
  profile: PublicProfile;
  theme: ResolvedTheme;
  claim: ClaimState;
}) {
  const tabs = [
    ...profile.sections.flatMap((s) => {
      const label = sectionTitle(s);
      return label ? [{ id: sectionAnchor(s), label }] : [];
    }),
    ...(profile.bio ? [{ id: "about", label: "About" }] : []),
  ];

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)]">
      <Identity profile={profile} />
      <div className="min-w-0 pb-16 lg:pt-20">
        <ClaimBand profile={profile} claim={claim} className="lg:mt-8" />
        {tabs.length > 1 ? <Tabs tabs={tabs} /> : null}
        <ProfileSections
          profile={profile}
          accent={theme.accent}
          tone={theme.tone}
          gigs={{ upcoming: Upcoming, past: Past }}
          className="px-5 pt-10 md:px-10 md:pt-14 lg:px-12"
        />
        {profile.bio ? (
          <section
            id="about"
            className="scroll-mt-36 px-5 pt-20 md:px-10 lg:px-12"
          >
            <h2 className="cp-display mb-8 text-[clamp(2rem,4.4vw,3.75rem)]">
              About
            </h2>
            <BioText bio={profile.bio} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** The portrait column: name, socials and the stacked actions. Sticky on desktop. */
function Identity({ profile }: { profile: PublicProfile }) {
  const next = nextSet(profile);
  const poster = (next ?? profile.past[0])?.poster ?? null;
  const listen = firstMusicAnchor(profile);
  const link = profile.sections.find((s) => s.type === "LINK_LIST")?.links[0];

  return (
    <aside className="relative flex h-[min(100svh,880px)] flex-col justify-end overflow-hidden lg:sticky lg:top-0 lg:h-dvh">
      {profile.portrait || profile.banner ? (
        <Photo
          src={(profile.portrait ?? profile.banner)!}
          alt={profile.name}
          priority
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="absolute inset-0"
          position="50% 30%"
        />
      ) : poster ? (
        <Poster
          title=""
          src={poster}
          className="absolute inset-0 scale-110 opacity-70 blur-2xl"
          sizes="40vw"
        />
      ) : null}
      <div className="cp-scrim-bottom absolute inset-0" />
      <div className="cp-scrim-top absolute inset-x-0 top-0 h-40" />

      <div className="@container relative px-5 pb-8 md:px-10 md:pb-12">
        <h1
          className="cp-display text-[min(7rem,calc(100cqw/(var(--len)*var(--cp-display-em))*0.97))] [overflow-wrap:anywhere]"
          style={nameLength(profile.name)}
        >
          {profile.name}
        </h1>
        {profile.tagline ? (
          <p className="t-label mt-4 text-[11px] leading-[1.45] text-[var(--cp-muted)] md:text-[12px]">
            {profile.tagline}
          </p>
        ) : null}
        <SocialLinks profile={profile} glass className="mt-5" />

        <div className="mt-7 grid max-w-[440px] gap-2.5 [&>a]:min-w-0">
          {next ? <NextPill set={next} /> : null}
          {listen ? (
            <Pill
              href={`#${listen}`}
              variant="glass"
              size="lg"
              className="justify-between"
            >
              Listen <ArrowRight className="size-4" />
            </Pill>
          ) : null}
          {link ? (
            <Pill
              href={link.url}
              variant="glass"
              size="lg"
              className="justify-between"
            >
              <span className="truncate">{link.label || "Link"}</span>
              <ArrowRight className="size-4 shrink-0" />
            </Pill>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function NextPill({ set }: { set: ProfileSet }) {
  const onNow = useSetOnNow(set);
  const cta = useTicketCta()(set);
  const buy = cta.tone === "buy" || cta.tone === "external";
  return (
    <Pill
      href={buy && cta.href ? cta.href : setHref(set)}
      variant={buy ? "accent" : "glass"}
      size="lg"
      className="justify-between"
    >
      <span>{onNow ? "On now" : buy ? "Tickets" : "Next set"}</span>
      <span className="truncate opacity-75">
        {fmtDay(set.start)}
        <span className="max-sm:hidden"> · {set.venue}</span>
      </span>
    </Pill>
  );
}

/** Anchor tabs that stick under the header and follow the scroll. */
function Tabs({ tabs }: { tabs: { id: string; label: string }[] }) {
  const scrollRef = useContext(ScrollContainerContext);
  const [active, setActive] = useState(tabs[0]?.id);
  const ids = tabs.map((t) => t.id).join(" ");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(hit.target.id);
      },
      { root: scrollRef?.current, rootMargin: "-30% 0px -60% 0px" },
    );
    for (const id of ids.split(" ")) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids, scrollRef]);

  return (
    <nav
      aria-label="Profile sections"
      className="sticky top-16 z-20 border-b border-[var(--cp-line)] bg-[color-mix(in_oklab,var(--cp-ground)_92%,transparent)] backdrop-blur-md md:top-20"
    >
      <ul className="no-scrollbar flex gap-7 overflow-x-auto px-5 md:px-10 lg:px-12">
        {tabs.map((t) => (
          <li key={t.id} className="shrink-0">
            <a
              href={`#${t.id}`}
              aria-current={active === t.id ? "true" : undefined}
              className={cn(
                "t-label relative flex h-14 items-center text-[11px] whitespace-nowrap transition-colors",
                active === t.id
                  ? "text-[var(--cp-ink)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--cp-accent)]"
                  : "text-[var(--cp-muted)] hover:text-[var(--cp-ink)]",
              )}
            >
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Next set as a notched stub joined to its poster, then the rest as dated rows. */
function Upcoming({
  section,
  profile,
}: {
  section: Of<"GIG_LIST">;
  profile: PublicProfile;
}) {
  const next = nextSet(profile);
  const rest = profile.upcoming.filter((s) => s !== next);
  return (
    <section>
      <SectionHeading title={section.title} className="mb-8" />
      {next ? <NextStub set={next} /> : null}
      {rest.length ? (
        <ul className="mt-8 border-t border-[var(--cp-line)]">
          {rest.map((s) => (
            <li
              key={s.id}
              className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-[var(--cp-line)] py-4 sm:grid-cols-[56px_64px_minmax(0,1fr)_auto] md:gap-x-6"
            >
              <SetPoster
                set={s}
                className="aspect-[4/5] w-14 rounded-[min(var(--cp-r-media),4px)]"
                sizes="56px"
              />
              <div className="max-sm:hidden">
                {setIsTba(s) ? (
                  <p className="cp-display text-3xl text-[var(--cp-faint)]">
                    --
                  </p>
                ) : (
                  <>
                    <p className="cp-display text-4xl tabular-nums">
                      {fmtDayNum(s.start)}
                    </p>
                    <p className="t-label mt-1 text-[10px] text-[var(--cp-muted)]">
                      {fmtWeekday(s.start)}
                    </p>
                  </>
                )}
              </div>
              <div className="min-w-0">
                <p className="cp-display truncate text-lg leading-tight md:text-xl">
                  <a
                    href={setHref(s)}
                    className="hover:text-[var(--cp-accent-text)]"
                  >
                    {setTitle(s)}
                  </a>
                </p>
                <p className="mt-1.5 truncate text-[13px] text-[var(--cp-muted)]">
                  <span className="sm:hidden">
                    {setIsTba(s) ? "" : `${fmtDay(s.start)} · `}
                  </span>
                  {s.venue}
                  {setIsTba(s) ? " · Date TBA" : ` · ${fmtTime(s.start)}`}
                </p>
                <Role set={s} className="mt-2 block" />
              </div>
              <TicketPill
                set={s}
                className="col-start-2 w-fit sm:col-start-4"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function NextStub({ set }: { set: ProfileSet }) {
  const onNow = useSetOnNow(set);
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-5 rounded-[var(--cp-r-panel)] rounded-tl-none bg-[var(--cp-raised)] p-4 md:grid-cols-[150px_minmax(0,1fr)] md:gap-7 md:p-5">
      <SetPoster
        set={set}
        className="aspect-[4/5] rounded-[min(var(--cp-r-media),6px)]"
        sizes="150px"
      />
      <div className="flex min-w-0 flex-col justify-between gap-5">
        <div>
          {onNow ? <OnNowTag className="mb-3" /> : null}
          <p className="cp-display text-[clamp(1.4rem,2.6vw,2.25rem)] [overflow-wrap:anywhere]">
            <a
              href={setHref(set)}
              className="hover:text-[var(--cp-accent-text)]"
            >
              {setTitle(set)}
            </a>
          </p>
          <p className="mt-2 text-[14px] text-[var(--cp-muted)]">
            {setMeta(set, { time: true })}
          </p>
          <Role set={set} className="mt-2 block" />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <SetTimer set={set} compact onGround />
          <TicketPill set={set} size="md" />
        </div>
      </div>
    </div>
  );
}

function Past({
  section,
  profile,
}: {
  section: Of<"PAST_GIGS">;
  profile: PublicProfile;
}) {
  const sets = section.includeUpcoming
    ? [...profile.upcoming, ...profile.past]
    : profile.past;
  return (
    <section>
      <SectionHeading title={section.title} className="mb-8" />
      <ul className="border-t border-[var(--cp-line)]">
        {sets.map((s) => (
          <li key={s.id}>
            <a
              href={setHref(s)}
              className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--cp-line)] py-3 md:grid-cols-[44px_120px_minmax(0,1fr)_auto]"
            >
              <SetPoster
                set={s}
                className="aspect-[4/5] w-11 rounded-[min(var(--cp-r-media),4px)]"
                sizes="44px"
              />
              <span className="t-label text-[11px] text-[var(--cp-muted)] max-md:hidden">
                {setIsTba(s) ? "TBA" : fmtDay(s.start).slice(4)}
              </span>
              <span className="min-w-0">
                <span className="cp-display block truncate text-[15px] leading-tight group-hover:text-[var(--cp-accent-text)] md:text-[17px]">
                  {setTitle(s)}
                </span>
                <span className="mt-1 block truncate text-[13px] text-[var(--cp-muted)]">
                  <span className="md:hidden">
                    {setIsTba(s) ? "" : `${fmtDay(s.start).slice(4)} · `}
                  </span>
                  {s.venue}
                </span>
              </span>
              {section.showRole ? <Role set={s} /> : <span />}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
