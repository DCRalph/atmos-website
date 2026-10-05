"use client";

import { useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  fmtMonth,
  fmtTime,
  fmtYear,
  groupConsecutive,
} from "~/components/site/gigs/gig-parts";
import type { MockProfile, ProfileSet } from "../fixtures";
import {
  CalendarTile,
  ClaimBand,
  LinkRows,
  MoreLink,
  OnNowTag,
  Photo,
  Pill,
  Poster,
  Role,
  RoundButton,
  SectionHeading,
  Segmented,
  SetTimer,
  SocialLinks,
  TicketPill,
  TrackPlayer,
  VideoTile,
  Waveform,
  setMeta,
  useSetOnNow,
} from "../parts";

/**
 * Draft A, Headliner. The DnB Allstars "next show" page turned into a person:
 * their photo and name own the left of the first viewport with the next set
 * counting down under it, the rest of their run stacked in a rail on the
 * right. Below: sets by month on calendar tiles, music, video, a poster
 * carousel of past sets, about, photos, and their name signing off.
 */
export function HeadlinerDraft({ profile }: { profile: MockProfile }) {
  return (
    <>
      <Hero profile={profile} />
      <ClaimBand profile={profile} />
      <Sets profile={profile} />
      {profile.tracks.length ? (
        <section id="listen" className="px-5 py-16 md:px-10 md:py-24">
          <SectionHeading title="Listen" className="mb-10" />
          <TrackPlayer profile={profile} />
        </section>
      ) : null}
      {profile.video ? (
        <section className="px-5 pb-16 md:px-10 md:pb-24">
          <SectionHeading title="Watch" className="mb-10" />
          <VideoTile video={profile.video} className="max-w-[1100px]" />
        </section>
      ) : null}
      <PastCarousel profile={profile} />
      <About profile={profile} />
      <Photos profile={profile} />
      <SignOff name={profile.name} />
    </>
  );
}

// ---------------------------------------------------------------------------

function Hero({ profile }: { profile: MockProfile }) {
  const next = profile.upcoming.find((s) => s.start) ?? null;
  const rest = profile.upcoming.filter((s) => s !== next);
  const backdrop = profile.banner ?? profile.portrait;
  const fallbackPoster = (next ?? profile.past[0])?.poster;

  return (
    <section className="relative grid min-h-[640px] lg:min-h-[min(820px,100dvh)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,34%)]">
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
            set={{ title: "", poster: fallbackPoster }}
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
            style={
              { "--len": Math.max(profile.name.length, 5) } as CSSProperties
            }
          >
            {profile.name}
          </h1>
          {profile.tagline ? (
            <p className="t-label mt-5 text-[12px] leading-[1.45] text-[var(--cp-muted)] md:text-[13px]">
              {profile.tagline}
            </p>
          ) : !profile.claimed ? (
            <p className="t-label mt-5 text-[12px] text-[var(--cp-muted)]">
              {profile.past.length + profile.upcoming.length} sets on Atmos
              lineups
            </p>
          ) : null}
          <SocialLinks profile={profile} glass className="mt-6" />

          {next ? (
            <NextSet set={next} />
          ) : profile.tracks[0] ? (
            <LatestTrack profile={profile} />
          ) : null}
        </div>
      </div>

      <Rail profile={profile} sets={next ? rest : []} />
    </section>
  );
}

/** The next set under the name: what, where, a countdown and the buy button. */
function NextSet({ set }: { set: ProfileSet }) {
  const onNow = useSetOnNow(set);
  return (
    <div className="mt-10 max-w-[600px] border-t border-[var(--cp-line)] pt-7">
      <p className="cp-display text-[clamp(1.5rem,3.2vw,2.5rem)]">
        <a href="#" className="hover:text-[var(--cp-accent-text)]">
          {set.title}
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
        <TicketPill ticket={set.ticket} size="lg" />
        <Pill variant="glass" size="lg" href="#sets">
          All sets
        </Pill>
      </div>
    </div>
  );
}

/** Nothing booked: the hero hands the slot to their latest track instead. */
function LatestTrack({ profile }: { profile: MockProfile }) {
  const track = profile.tracks[0]!;
  return (
    <div className="cp-glass mt-10 flex max-w-[600px] items-center gap-4 rounded-[var(--cp-r-panel)] p-3 pr-5">
      <Poster
        set={{ title: track.title, poster: track.artwork }}
        className="aspect-square w-20 shrink-0 rounded-[var(--cp-r-media)]"
        sizes="80px"
      />
      <div className="min-w-0 flex-1">
        <p className="cp-display truncate text-xl">{track.title}</p>
        <p className="mt-1 text-[13px] text-[var(--cp-muted)]">
          Latest · {track.length}
        </p>
        <Waveform wave={track.wave} className="mt-3 h-6" />
      </div>
      <Pill variant="accent" size="md" href="#listen">
        Listen
      </Pill>
    </div>
  );
}

/** The DnB Allstars "Then" column: what comes after the next set, or recent ones. */
function Rail({ profile, sets }: { profile: MockProfile; sets: ProfileSet[] }) {
  const recent = !sets.length;
  const list = recent ? profile.past.slice(0, 4) : sets.slice(0, 4);
  if (!list.length) return null;
  return (
    <aside
      aria-labelledby="rail-title"
      className="flex flex-col justify-center bg-[var(--cp-raised)] px-5 py-10 md:px-10 lg:px-[clamp(28px,3.2vw,56px)] lg:pt-32 lg:pb-12"
    >
      <h2
        id="rail-title"
        className="t-label mb-5 text-[11px] text-[var(--cp-faint)]"
      >
        {recent ? "Recently" : "Then"}
      </h2>
      <ol>
        {list.map((set) => (
          <li key={set.id}>
            <a
              href="#"
              className="group grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 border-t border-[var(--cp-line)] py-4"
            >
              <Poster
                set={set}
                className="aspect-[4/5] w-16 rounded-[min(var(--cp-r-media),4px)]"
                sizes="64px"
              />
              <span className="min-w-0">
                <span className="cp-display block truncate text-[17px] leading-tight group-hover:text-[var(--cp-accent-text)]">
                  {set.title}
                </span>
                <span className="mt-1.5 block truncate text-[13px] text-[var(--cp-muted)]">
                  {setMeta(set)}
                </span>
                <Role set={set} className="mt-2 block" />
              </span>
              <span
                className={cn(
                  "t-label text-[10px]",
                  recent || set.ticket.tone === "none"
                    ? "text-[var(--cp-faint)]"
                    : set.ticket.tone === "buy"
                      ? "text-[var(--cp-accent-text)]"
                      : "text-[var(--cp-faint)]",
                )}
              >
                {recent
                  ? "Photos"
                  : set.ticket.tone === "buy"
                    ? "Tickets"
                    : set.ticket.label}
              </span>
            </a>
          </li>
        ))}
      </ol>
      <MoreLink href={recent ? "#past" : "#sets"} className="mt-6">
        {recent
          ? `All ${profile.past.length} past sets`
          : `All ${profile.upcoming.length} upcoming`}
      </MoreLink>
    </aside>
  );
}

// ---------------------------------------------------------------------------

const views = [
  { id: "list", label: "List" },
  { id: "grid", label: "Grid" },
] as const;

/** Upcoming sets by month, each month headed by a calendar tile that sticks. */
function Sets({ profile }: { profile: MockProfile }) {
  const [view, setView] = useState<"list" | "grid">("list");
  if (!profile.upcoming.length) return null;
  const groups = groupConsecutive(profile.upcoming, (s) =>
    s.start ? fmtMonth(s.start) : "TBA",
  );

  return (
    <section id="sets" className="scroll-mt-16 px-5 py-16 md:px-10 md:py-24">
      <SectionHeading
        title="Sets"
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
              {first.start ? (
                <>
                  <CalendarTile date={first.start} />
                  <span className="t-label text-[12px] text-[var(--cp-muted)]">
                    {fmtMonth(first.start).split(" ")[0]}
                    <span className="sr-only"> {fmtYear(first.start)}</span>
                  </span>
                </>
              ) : (
                <span className="t-label text-[12px] text-[var(--cp-muted)]">
                  Date to be announced
                </span>
              )}
            </h3>
            {view === "list" ? (
              <ul>
                {g.items.map((s) => (
                  <SetRow key={s.id} set={s} />
                ))}
              </ul>
            ) : (
              <ul className="grid grid-cols-2 gap-x-3 gap-y-8 py-6 md:grid-cols-4 md:gap-x-5">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <a href="#" className="group block">
                      <Poster
                        set={s}
                        className="aspect-[4/5] rounded-[var(--cp-r-media)]"
                        sizes="(min-width: 768px) 25vw, 50vw"
                      />
                      <p className="cp-display mt-3 text-[15px] leading-tight group-hover:text-[var(--cp-accent-text)] md:text-[18px]">
                        {s.title}
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

function SetRow({ set }: { set: ProfileSet }) {
  const onNow = useSetOnNow(set);
  return (
    <li className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-[var(--cp-line-soft)] py-5 sm:grid-cols-[72px_minmax(0,1fr)_auto] md:grid-cols-[104px_minmax(0,1fr)_auto] md:gap-x-7">
      <Poster
        set={set}
        fit="contain"
        className="aspect-square w-[72px] rounded-[var(--cp-r-media)] md:w-[104px]"
        sizes="104px"
      />
      <div className="min-w-0">
        {onNow ? <OnNowTag className="mb-2" /> : null}
        <p className="cp-display text-lg leading-tight md:text-[26px]">
          <a href="#" className="hover:text-[var(--cp-accent-text)]">
            {set.title}
          </a>
        </p>
        <p className="mt-1.5 text-[13px] text-[var(--cp-muted)] md:text-[15px]">
          {setMeta(set)}
          {set.start ? ` · ${fmtTime(set.start)}` : ""}
        </p>
        <Role set={set} className="mt-2 block" />
      </div>
      <TicketPill
        ticket={set.ticket}
        size="md"
        className="col-start-2 w-fit sm:col-start-3"
      />
    </li>
  );
}

// ---------------------------------------------------------------------------

/** Past sets as a poster carousel, like the reference's past events. */
function PastCarousel({ profile }: { profile: MockProfile }) {
  const scroller = useRef<HTMLUListElement>(null);
  if (!profile.past.length) return null;
  const firstYear = profile.past.at(-1)?.start;
  const scroll = (dir: 1 | -1) =>
    scroller.current?.scrollBy({
      left: dir * scroller.current.clientWidth * 0.8,
      behavior: "smooth",
    });

  return (
    <section id="past" className="scroll-mt-16 py-16 md:py-24">
      <SectionHeading
        title="Past sets"
        className="mb-10 px-5 md:px-10"
        aside={
          <div className="flex gap-2">
            <RoundButton label="Previous" onClick={() => scroll(-1)}>
              <ArrowLeft className="size-5" />
            </RoundButton>
            <RoundButton label="Next" onClick={() => scroll(1)}>
              <ArrowRight className="size-5" />
            </RoundButton>
          </div>
        }
      >
        <p className="mt-4 text-[15px] text-[var(--cp-muted)]">
          {profile.past.length} sets with Atmos
          {firstYear ? ` since ${fmtYear(firstYear)}` : ""}
        </p>
      </SectionHeading>
      <ul
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 md:scroll-px-10 md:gap-5 md:px-10"
      >
        {profile.past.map((s) => (
          <li key={s.id} className="w-[200px] shrink-0 snap-start md:w-[260px]">
            <a href="#" className="group block">
              <Poster
                set={s}
                className="aspect-[4/5] rounded-[var(--cp-r-media)]"
                sizes="260px"
              />
              <p className="cp-display mt-3 line-clamp-2 text-[15px] leading-tight group-hover:text-[var(--cp-accent-text)] md:text-[18px]">
                {s.title}
              </p>
              <p className="mt-1.5 text-[13px] text-[var(--cp-muted)]">
                {setMeta(s)}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function About({ profile }: { profile: MockProfile }) {
  if (!profile.bio.length && !profile.links.length) return null;
  return (
    <section className="grid gap-10 px-5 py-16 md:px-10 md:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      {profile.portrait ? (
        <Photo
          src={profile.portrait}
          alt={profile.name}
          sizes="(min-width: 1024px) 40vw, 100vw"
          className="aspect-[4/5] rounded-[var(--cp-r-media)]"
        />
      ) : null}
      <div className="lg:pt-4">
        <h2 className="cp-display text-[clamp(2.25rem,6vw,4.75rem)]">About</h2>
        <div className="mt-8 max-w-[60ch] space-y-5 text-[17px] leading-relaxed text-[var(--cp-muted)]">
          {profile.bio.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <LinkRows profile={profile} className="mt-10" />
      </div>
    </section>
  );
}

function Photos({ profile }: { profile: MockProfile }) {
  if (!profile.gallery.length) return null;
  const [lead, ...rest] = profile.gallery;
  return (
    <section className="px-5 pb-16 md:px-10 md:pb-24">
      <SectionHeading title="Photos" className="mb-10" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Photo
          src={lead!}
          alt=""
          sizes="50vw"
          className="col-span-2 aspect-[3/2] rounded-[var(--cp-r-media)] md:row-span-2 md:aspect-auto"
        />
        {rest.map((src) => (
          <Photo
            key={src}
            src={src}
            alt=""
            sizes="25vw"
            className="aspect-[3/2] rounded-[var(--cp-r-media)]"
          />
        ))}
      </div>
    </section>
  );
}

/** Their name, oversized and cropped by the footer: the site footer's logo move. */
function SignOff({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      className="@container overflow-hidden px-5 pt-10 select-none md:px-10"
    >
      <p
        className="cp-display translate-y-[22%] text-center text-[min(26rem,calc(100cqw/(var(--len)*var(--cp-display-em))*0.98))] leading-[0.8] whitespace-nowrap text-[var(--cp-line)]"
        style={{ "--len": Math.max(name.length, 5) } as CSSProperties}
      >
        {name}
      </p>
    </div>
  );
}
