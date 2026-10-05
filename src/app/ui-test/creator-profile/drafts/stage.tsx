"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  fmtDay,
  fmtDayNum,
  fmtTime,
  fmtWeekday,
} from "~/components/site/gigs/gig-parts";
import type { MockProfile, ProfileSet } from "../fixtures";
import {
  ClaimBand,
  LinkRows,
  OnNowTag,
  Photo,
  Pill,
  Poster,
  Role,
  SetTimer,
  SocialLinks,
  TicketPill,
  TrackPlayer,
  VideoTile,
  setMeta,
  useSetOnNow,
} from "../parts";

/**
 * Draft C, Stage. Link-in-bio first: on a phone their portrait fills the
 * screen with the three things people came for stacked as big pills. On
 * desktop that portrait becomes a column that stays put while the right side
 * scrolls like a press kit, with a tab bar that tracks where you are.
 */
export function StageDraft({ profile }: { profile: MockProfile }) {
  const tabs = [
    { id: "sets", label: "Sets", show: profile.upcoming.length > 0 },
    { id: "listen", label: "Listen", show: profile.tracks.length > 0 },
    { id: "watch", label: "Watch", show: !!profile.video },
    { id: "photos", label: "Photos", show: profile.gallery.length > 0 },
    { id: "about", label: "About", show: profile.bio.length > 0 },
    { id: "past", label: "Past", show: profile.past.length > 0 },
  ].filter((t) => t.show);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)]">
      <Identity profile={profile} />
      <div className="min-w-0 pb-16 lg:pt-20">
        <ClaimBand profile={profile} className="lg:mt-8" />
        <Tabs tabs={tabs} />
        <div className="space-y-20 px-5 pt-10 md:px-10 md:pt-14 lg:px-12">
          {profile.upcoming.length ? (
            <section id="sets" className="scroll-mt-36">
              <Heading>Sets</Heading>
              <UpcomingSets sets={profile.upcoming} />
            </section>
          ) : null}
          {profile.tracks.length ? (
            <section id="listen" className="scroll-mt-36">
              <Heading>Listen</Heading>
              <TrackPlayer profile={profile} layout="stacked" />
            </section>
          ) : null}
          {profile.video ? (
            <section id="watch" className="scroll-mt-36">
              <Heading>Watch</Heading>
              <VideoTile video={profile.video} />
            </section>
          ) : null}
          {profile.gallery.length ? (
            <section id="photos" className="scroll-mt-36">
              <Heading>Photos</Heading>
              <div className="columns-2 gap-2 md:gap-3 [&>*]:mb-2 md:[&>*]:mb-3">
                {profile.gallery.map((src, i) => (
                  <Photo
                    key={src}
                    src={src}
                    alt=""
                    sizes="30vw"
                    className={cn(
                      "break-inside-avoid rounded-[var(--cp-r-media)]",
                      i % 3 === 0 ? "aspect-[4/5]" : "aspect-[3/2]",
                    )}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {profile.bio.length ? (
            <section id="about" className="scroll-mt-36">
              <Heading>About</Heading>
              <div className="max-w-[60ch] space-y-5 text-[17px] leading-relaxed text-[var(--cp-muted)]">
                {profile.bio.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              <LinkRows profile={profile} className="mt-10" />
            </section>
          ) : null}
          {profile.past.length ? (
            <section id="past" className="scroll-mt-36">
              <Heading>Past</Heading>
              <PastList sets={profile.past} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <h2 className="cp-display mb-8 text-[clamp(2rem,4.4vw,3.75rem)]">
      {children}
    </h2>
  );
}

/** The portrait column: name, socials and the stacked actions. Sticky on desktop. */
function Identity({ profile }: { profile: MockProfile }) {
  const next = profile.upcoming.find((s) => s.start) ?? null;
  const poster = (next ?? profile.past[0])?.poster;
  return (
    <aside className="relative flex h-[min(100svh,880px)] flex-col justify-end overflow-hidden lg:sticky lg:top-0 lg:h-dvh">
      {profile.portrait ? (
        <Photo
          src={profile.portrait}
          alt={profile.name}
          priority
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="absolute inset-0"
          position="50% 30%"
        />
      ) : poster ? (
        <Poster
          set={{ title: "", poster }}
          className="absolute inset-0 scale-110 opacity-70 blur-2xl"
          sizes="40vw"
        />
      ) : null}
      <div className="cp-scrim-bottom absolute inset-0" />
      <div className="cp-scrim-top absolute inset-x-0 top-0 h-40" />

      <div className="@container relative px-5 pb-8 md:px-10 md:pb-12">
        <h1
          className="cp-display text-[min(7rem,calc(100cqw/(var(--len)*var(--cp-display-em))*0.97))] [overflow-wrap:anywhere]"
          style={{ "--len": Math.max(profile.name.length, 5) } as CSSProperties}
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
          {profile.tracks.length ? (
            <Pill
              variant="glass"
              size="lg"
              href="#listen"
              className="justify-between"
            >
              Listen <ArrowRight className="size-4" />
            </Pill>
          ) : null}
          {profile.links[0] ? (
            <Pill
              variant="glass"
              size="lg"
              href={profile.links[0].url}
              className="justify-between"
            >
              {profile.links[0].label} <ArrowRight className="size-4" />
            </Pill>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function NextPill({ set }: { set: ProfileSet }) {
  const onNow = useSetOnNow(set);
  const buy = set.ticket.tone === "buy";
  return (
    <Pill
      variant={buy ? "accent" : "glass"}
      size="lg"
      href="#sets"
      className="justify-between"
    >
      <span>{onNow ? "On now" : buy ? "Tickets" : "Next set"}</span>
      <span className="truncate opacity-75">
        {set.start ? fmtDay(set.start) : "TBA"}
        <span className="max-sm:hidden"> · {set.venue}</span>
      </span>
    </Pill>
  );
}

/** Anchor tabs that stick under the header and follow the scroll. */
function Tabs({ tabs }: { tabs: { id: string; label: string }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const ids = tabs.map((t) => t.id).join(" ");

  useEffect(() => {
    const root = document.getElementById("cp-scroll");
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(hit.target.id);
      },
      { root, rootMargin: "-30% 0px -60% 0px" },
    );
    ids.split(" ").forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  return (
    <nav
      aria-label="Profile sections"
      className="sticky top-16 z-20 border-b border-[var(--cp-line)] bg-[color-mix(in_oklab,var(--cp-ground)_92%,transparent)] backdrop-blur-md md:top-20"
    >
      <ul className="no-scrollbar flex gap-7 overflow-x-auto px-5 md:px-10 lg:px-12">
        {tabs.map((t) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              aria-current={active === t.id ? "true" : undefined}
              className={cn(
                "t-label relative flex h-14 items-center text-[11px] transition-colors",
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
function UpcomingSets({ sets }: { sets: ProfileSet[] }) {
  const [next, ...rest] = sets;
  return (
    <>
      {next ? <NextStub set={next} /> : null}
      <ul className="mt-8 border-t border-[var(--cp-line)]">
        {rest.map((s) => (
          <li
            key={s.id}
            className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-[var(--cp-line)] py-4 sm:grid-cols-[56px_64px_minmax(0,1fr)_auto] md:gap-x-6"
          >
            <Poster
              set={s}
              className="aspect-[4/5] w-14 rounded-[min(var(--cp-r-media),4px)]"
              sizes="56px"
            />
            <div className="max-sm:hidden">
              {s.start ? (
                <>
                  <p className="cp-display text-4xl tabular-nums">
                    {fmtDayNum(s.start)}
                  </p>
                  <p className="t-label mt-1 text-[10px] text-[var(--cp-muted)]">
                    {fmtWeekday(s.start)}
                  </p>
                </>
              ) : (
                <p className="cp-display text-3xl text-[var(--cp-faint)]">--</p>
              )}
            </div>
            <div className="min-w-0">
              <p className="cp-display truncate text-lg leading-tight md:text-xl">
                {s.title}
              </p>
              <p className="mt-1.5 truncate text-[13px] text-[var(--cp-muted)]">
                <span className="sm:hidden">
                  {s.start ? `${fmtDay(s.start)} · ` : ""}
                </span>
                {s.venue}
                {s.start ? ` · ${fmtTime(s.start)}` : " · Date TBA"}
              </p>
              <Role set={s} className="mt-2 block" />
            </div>
            <TicketPill
              ticket={s.ticket}
              className="col-start-2 w-fit sm:col-start-4"
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function NextStub({ set }: { set: ProfileSet }) {
  const onNow = useSetOnNow(set);
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-5 rounded-[var(--cp-r-panel)] rounded-tl-none bg-[var(--cp-raised)] p-4 md:grid-cols-[150px_minmax(0,1fr)] md:gap-7 md:p-5">
      <Poster
        set={set}
        className="aspect-[4/5] rounded-[min(var(--cp-r-media),6px)]"
        sizes="150px"
      />
      <div className="flex min-w-0 flex-col justify-between gap-5">
        <div>
          {onNow ? <OnNowTag className="mb-3" /> : null}
          <p className="cp-display text-[clamp(1.4rem,2.6vw,2.25rem)]">
            {set.title}
          </p>
          <p className="mt-2 text-[14px] text-[var(--cp-muted)]">
            {setMeta(set, { time: true })}
          </p>
          <Role set={set} className="mt-2 block" />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <SetTimer set={set} compact onGround />
          <TicketPill ticket={set.ticket} size="md" />
        </div>
      </div>
    </div>
  );
}

function PastList({ sets }: { sets: ProfileSet[] }) {
  return (
    <ul className="border-t border-[var(--cp-line)]">
      {sets.map((s) => (
        <li key={s.id}>
          <a
            href="#"
            className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--cp-line)] py-3 md:grid-cols-[44px_120px_minmax(0,1fr)_auto]"
          >
            <Poster
              set={s}
              className="aspect-[4/5] w-11 rounded-[min(var(--cp-r-media),4px)]"
              sizes="44px"
            />
            <span className="t-label text-[11px] text-[var(--cp-muted)] max-md:hidden">
              {s.start ? fmtDay(s.start).slice(4) : "TBA"}
            </span>
            <span className="min-w-0">
              <span className="cp-display block truncate text-[15px] leading-tight group-hover:text-[var(--cp-accent-text)] md:text-[17px]">
                {s.title}
              </span>
              <span className="mt-1 block truncate text-[13px] text-[var(--cp-muted)]">
                <span className="md:hidden">
                  {s.start ? `${fmtDay(s.start).slice(4)} · ` : ""}
                </span>
                {s.venue}
              </span>
            </span>
            <Role set={s} />
          </a>
        </li>
      ))}
    </ul>
  );
}
