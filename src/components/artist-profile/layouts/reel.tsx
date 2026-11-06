"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import type { ProfileSection } from "~/lib/artist-sections";
import type { ResolvedTheme } from "~/lib/artist-theme";
import {
  ClaimBand,
  Photo,
  Pill,
  RoundButton,
  SetPoster,
  SocialLinks,
  TicketPill,
  nextSet,
  setHref,
  setMeta,
  setTitle,
  type ClaimState,
} from "../parts";
import { BlockCell, Section, type SectionProps } from "../sections";
import { useProfileEditor } from "../editor/context";
import { Agenda, Carousel, HeadlinerLayout, Mark } from "./headliner";
import {
  BioTile,
  firstMusicAnchor,
  nameLength,
  pastSetsLine,
  shortBio,
} from "./shared";
import type { PublicProfile } from "../types";

/**
 * Reel. The page scrolls sideways: the header is the first panel, then the
 * artist's blocks in their reading order, flowing down columns as tall as
 * the screen and on to the right (see `cp-reel` in `artist-profile.css`).
 * Scrolling the page moves it along, as do the arrow keys and the bar along
 * the bottom; after the last column the page carries on to the site's
 * footer. On a phone each part is a card to swipe through.
 *
 * In edit mode it's laid out like Headliner, so the grid can be arranged.
 */
export function ReelLayout({
  profile,
  theme,
  claim,
}: {
  profile: PublicProfile;
  theme: ResolvedTheme;
  claim: ClaimState;
}) {
  const editor = useProfileEditor();
  if (editor?.editing)
    return <HeadlinerLayout profile={profile} theme={theme} claim={claim} />;

  const props: SectionProps = {
    profile,
    accent: theme.accent,
    tone: theme.tone,
    gigs: { upcoming: Agenda, past: Carousel },
  };
  const bio = shortBio(profile.bio) ? null : profile.bio;
  return (
    <>
      <Reel label={`${profile.name}'s page`}>
        <Hero profile={profile} />
        {panelsOf(profile.sections).map((panel) => (
          <div key={panel[0]!.id} className="cp-reel-item">
            <div className="flex flex-col gap-[var(--cp-gap)]">
              {panel.map((section) => (
                <BlockCell key={section.id} section={section}>
                  <Section section={section} {...props} />
                </BlockCell>
              ))}
            </div>
          </div>
        ))}
        {bio ? (
          <div id="about" className="cp-reel-item">
            <BioTile bio={bio} />
          </div>
        ) : null}
      </Reel>
      <ClaimBand profile={profile} claim={claim} />
    </>
  );
}

/**
 * The blocks as the reel's panels, in reading order. A heading shares a panel
 * with the block after it, so it's never left at the foot of a column or alone
 * on a card. Dividers and space are for arranging a grid, so they're left out.
 */
function panelsOf(sections: ProfileSection[]) {
  const panels: ProfileSection[][] = [];
  for (const section of sections) {
    if (section.type === "DIVIDER" || section.type === "SPACER") continue;
    const last = panels.at(-1);
    if (last?.at(-1)?.type === "HEADING") last.push(section);
    else panels.push([section]);
  }
  return panels;
}

/**
 * The sideways track and the bar that moves it. From md up the page's own
 * scroll drives it: the section is as tall as the track is long, the stage
 * sticks to the screen, and scrolling down moves the track along (so a mouse
 * wheel, the keyboard, a scroll over an embedded player and the page's
 * scrollbar all work as on any page, and the footer follows the last
 * column). On phones the track is a row of cards swiped sideways.
 */
function Reel({ label, children }: { label: string; children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const step = useScrollDrivenTrack(section, track);
  return (
    <section ref={section} aria-label={label} className="cp-reel">
      <div className="cp-reel-stage">
        <div ref={track} className="cp-reel-track">
          {children}
        </div>
        <Bar track={track} step={step} />
      </div>
    </section>
  );
}

const WIDE = "(min-width: 768px)";

/**
 * One step along: a column and its gap (a card and its gap on phones, where
 * the header card is wider than the rest).
 */
function columnStep(el: HTMLElement) {
  const panel = (el.children[1] ?? el.children[0]) as HTMLElement | undefined;
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
  return (panel?.offsetWidth ?? el.clientWidth) + gap;
}

/**
 * Ties the track to the page's scroll from md up (see `Reel`): sizes the
 * section to the track's length (`--reel-run`), moves the track as the page
 * scrolls, and moves the page when the track is scrolled some other way (an
 * in-page link or tabbing to a link in a later column). Sideways trackpad
 * swipes and the left and right arrows move it too. Returns a step along by
 * a column, back or forth.
 */
function useScrollDrivenTrack(
  section: RefObject<HTMLElement | null>,
  track: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const sec = section.current;
    const el = track.current;
    const page = sec?.closest<HTMLElement>("#main-layout-container");
    if (!sec || !el || !page) return;
    const wide = window.matchMedia(WIDE);
    const run = () => Math.max(0, el.scrollWidth - el.clientWidth);
    const top = () =>
      sec.getBoundingClientRect().top -
      page.getBoundingClientRect().top +
      page.scrollTop;
    // How far along the page's scroll puts the track.
    const along = () => Math.min(Math.max(page.scrollTop - top(), 0), run());

    const size = () =>
      sec.style.setProperty("--reel-run", wide.matches ? `${run()}px` : "0px");
    const fromPage = () => {
      if (wide.matches) el.scrollLeft = along();
    };
    const fromTrack = () => {
      if (!wide.matches || Math.abs(el.scrollLeft - along()) < 1) return;
      page.scrollTop = top() + el.scrollLeft;
    };
    const onWheel = (e: WheelEvent) => {
      if (!wide.matches || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      page.scrollTop += e.deltaX;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      // Only while the reel holds the screen.
      if (!wide.matches || page.scrollTop < top() - 1) return;
      if (page.scrollTop > top() + run() + 1) return;
      e.preventDefault();
      page.scrollBy({
        top: (e.key === "ArrowRight" ? 1 : -1) * columnStep(el),
        behavior: "smooth",
      });
    };

    const layout = () => {
      size();
      fromPage();
    };
    layout();
    // Columns reflow as photos load and text opens, so watch every panel.
    const observer = new ResizeObserver(layout);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    wide.addEventListener("change", layout);
    page.addEventListener("scroll", fromPage, { passive: true });
    el.addEventListener("scroll", fromTrack, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      observer.disconnect();
      wide.removeEventListener("change", layout);
      page.removeEventListener("scroll", fromPage);
      el.removeEventListener("scroll", fromTrack);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [section, track]);

  return (dir: 1 | -1) => {
    const el = track.current;
    const page = section.current?.closest("#main-layout-container");
    if (!el || !page) return;
    const by = dir * columnStep(el);
    if (window.matchMedia(WIDE).matches)
      page.scrollBy({ top: by, behavior: "smooth" });
    else el.scrollBy({ left: by, behavior: "smooth" });
  };
}

/** How far along the reel is, with buttons to step it a column. */
function Bar({
  track,
  step,
}: {
  track: RefObject<HTMLDivElement | null>;
  step: (dir: 1 | -1) => void;
}) {
  const [pos, setPos] = useState({ at: 0, of: 1, progress: 0, more: false });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const max = el.scrollWidth - el.clientWidth;
      const step = columnStep(el);
      const next = {
        at: Math.round(el.scrollLeft / step) + 1,
        of: Math.max(1, Math.round(max / step) + 1),
        progress: max > 0 ? el.scrollLeft / max : 1,
        more: max > 1,
      };
      setPos((prev) =>
        prev.at === next.at &&
        prev.of === next.of &&
        prev.more === next.more &&
        Math.abs(prev.progress - next.progress) < 0.002
          ? prev
          : next,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    el.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("scroll", schedule);
    };
  }, [track]);

  if (!pos.more) return null;
  return (
    <div className="cp-reel-bar cp-ctl">
      <span className="hidden text-[12px] whitespace-nowrap text-[var(--cp-muted)] lg:block">
        Scroll or use ← → to move along
      </span>
      <span
        aria-hidden
        className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--cp-line)]"
      >
        <span
          className="block h-full origin-left bg-[var(--cp-accent)]"
          style={{ transform: `scaleX(${Math.max(pos.progress, 0.02)})` }}
        />
      </span>
      <span className="font-mono text-[11px] text-[var(--cp-muted)] tabular-nums">
        {pos.at} / {pos.of}
      </span>
      <span className="hidden gap-2 md:flex">
        <RoundButton
          label="Back"
          disabled={pos.progress <= 0.001}
          onClick={() => step(-1)}
          className="size-9"
        >
          <ArrowLeft className="size-4" />
        </RoundButton>
        <RoundButton
          label="Along"
          disabled={pos.progress >= 0.999}
          onClick={() => step(1)}
          className="size-9"
        >
          <ArrowRight className="size-4" />
        </RoundButton>
      </span>
    </div>
  );
}

/** The first panel: their photo, name, actions and latest sets. */
function Hero({ profile }: { profile: PublicProfile }) {
  const next = nextSet(profile);
  const backdrop = profile.banner ?? profile.portrait;
  const listen = firstMusicAnchor(profile);
  const sets = (
    profile.upcoming.length ? profile.upcoming : profile.past
  ).slice(0, 3);
  const meta = [
    shortBio(profile.bio),
    sets.length ? pastSetsLine(profile) : null,
  ].filter(Boolean);

  return (
    <header className="cp-reel-hero">
      {backdrop ? (
        <Photo
          src={backdrop}
          alt=""
          priority
          sizes="(min-width: 768px) 480px, 100vw"
          className="cp-hero-photo absolute -inset-6 -z-10 blur-[1.5px]"
          position="50% 40%"
        />
      ) : null}
      <div aria-hidden className="cp-hero-glow absolute inset-0 -z-10" />
      <div aria-hidden className="cp-hero-fade absolute inset-0 -z-10" />

      <div className="@container px-5 pb-16 md:px-10 md:pb-6">
        <Mark profile={profile} className="w-24 md:w-28" />
        {profile.tagline ? (
          <p className="t-label mt-6 text-[11px] leading-[1.45] text-[var(--cp-muted)]">
            {profile.tagline}
          </p>
        ) : null}
        <h1
          className="cp-display mt-3 text-[min(7rem,var(--cp-name-cap),calc(100cqw/(var(--len)*var(--cp-display-em))*0.97))] [overflow-wrap:anywhere]"
          style={nameLength(profile.name)}
        >
          {profile.name}
        </h1>
        {meta.length ? (
          <p className="mt-4 text-[14px] text-[var(--cp-muted)]">
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
          <SocialLinks profile={profile} glass />
        </div>
        {sets.length ? (
          <ul className="mt-8 hidden border-t border-[var(--cp-line)] md:block">
            {sets.map((set) => (
              <li key={set.id} className="border-b border-[var(--cp-line)]">
                <a
                  href={setHref(set)}
                  className="group flex items-center gap-4 py-3"
                >
                  <SetPoster
                    set={set}
                    className="cp-media aspect-[4/5] w-9 shrink-0 rounded-[min(var(--cp-r-media),4px)]"
                    sizes="36px"
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
        ) : null}
      </div>
    </header>
  );
}
