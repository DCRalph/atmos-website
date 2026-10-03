"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { Media } from "../primitives";
import { GroupChat, chatMessages } from "./about-chat";
import type { PageSpec } from "./types";

// Real copy from src/components/about/*, punctuation tidied where it was missing.
const copy = {
  where: "Immersive electronic music events in Pōneke, Wellington.",
  statement:
    "We design every element to work as one: sound, light, space. When it all comes together, that's the atmosphere.",
  experienceTitle: "Atmosphere over everything.",
  experience:
    "We take venues you know and reshape them into something different. Sound, light and design working together to create an environment, not just a show.",
  revealA:
    "Every space starts as a blank room. We build it out with sound and light until it feels like somewhere else entirely.",
  revealB:
    "The setup evolves throughout the night. It doesn't look or feel the same from start to finish.",
  chatTitle: "There's a lot going on. Leave it at the door.",
  spacesTitle: "Turning nowhere into somewhere.",
  spaces:
    "We work with existing venues but we also use spaces you wouldn't expect. Basements, warehouses, places around Pōneke that most people walk past without a second look.",
  welcome:
    "Everyone's welcome. No pretension, no pressure. Just a good environment with good people around you.",
};

const img = {
  crowd: "/home/atmos-46.jpg",
  lights: "/home/atmos-9.jpg",
  booth: "/home/atmos-17.jpg",
  closing: "/home/atmos-8.jpg",
  floor: "/home/atmos-15.jpg",
};

/** True when scroll moments should render finished: the board state or the OS setting. */
function useStill(state: string) {
  const reduced = useReducedMotion();
  return state === "reduced" || reduced === true;
}

/** The hero line, with "atmospheres" in the accent. */
function HeroLine({ className }: { className?: string }) {
  return (
    <h1 className={cn("mx-display", className)}>
      We don&apos;t do gigs.
      <br />
      We build{" "}
      <span className="text-[var(--mx-accent-text)]">atmospheres.</span>
    </h1>
  );
}

/** Closing index: where to go next, as full-width display rows. */
function NextLinks() {
  return (
    <nav aria-label="Next" className="border-t border-white/10">
      {[
        { label: "Upcoming gigs", meta: "Tickets and lineups" },
        { label: "Meet the crew", meta: "DJs and producers" },
      ].map((l) => (
        <a
          key={l.label}
          href="#"
          className="group flex items-center justify-between gap-6 border-b border-white/10 px-5 py-7 transition-colors hover:bg-white/[0.03] md:px-10 md:py-10"
        >
          <span className="mx-display text-[clamp(1.6rem,5vw,4rem)] transition-colors group-hover:text-[var(--mx-accent-text)]">
            {l.label}
          </span>
          <span className="flex items-center gap-4">
            <span className="mx-label hidden text-[11px] text-white/60 sm:block">
              {l.meta}
            </span>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform group-hover:translate-x-1 md:size-14">
              <ArrowRight className="size-5" />
            </span>
          </span>
        </a>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// A · Manifesto

function Word({
  word,
  i,
  total,
  progress,
}: {
  word: string;
  i: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const start = 0.1 + (i / total) * 0.7;
  const opacity = useTransform(
    progress,
    [start, start + 0.7 / total],
    [0.14, 1],
  );
  return (
    <motion.span className="inline-block" style={{ opacity }}>
      {word}&nbsp;
    </motion.span>
  );
}

const statementText =
  "mx-display max-w-[22ch] text-[clamp(1.6rem,5.2vw,4.75rem)] leading-[1]";

/** The statement lights up word by word as you scroll through a pinned screen. */
function LitStatement({ still }: { still: boolean }) {
  if (still) {
    return (
      <section className="px-5 py-24 md:px-10 md:py-40">
        <p className={statementText}>{copy.statement}</p>
      </section>
    );
  }
  return <PinnedStatement />;
}

function PinnedStatement() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const words = copy.statement.split(" ");
  return (
    <section ref={ref} className="relative h-[220svh]">
      <div className="sticky top-0 flex h-svh items-center px-5 md:px-10">
        <p className={statementText} aria-label={copy.statement}>
          {words.map((w, i) => (
            <Word
              key={`${w}-${i}`}
              word={w}
              i={i}
              total={words.length}
              progress={scrollYProgress}
            />
          ))}
        </p>
      </div>
    </section>
  );
}

/** A: full-bleed crowd hero, one pinned statement that lights up, then the story in editorial beats. */
function ManifestoDraft({ state }: { state: string }) {
  const still = useStill(state);
  return (
    <>
      <section className="relative flex min-h-[88svh] items-end overflow-hidden">
        <Media
          src={img.crowd}
          alt="Crowd at an Atmos event"
          sizes="100vw"
          className="absolute inset-0"
          priority
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="mx-scrim-bottom absolute inset-0" />
        <div className="relative w-full px-5 pt-40 pb-10 md:px-10 md:pb-16">
          <HeroLine className="text-[clamp(2rem,7.2vw,7rem)]" />
          <p className="mt-6 max-w-[44ch] text-[16px] text-white/75 md:text-[18px]">
            {copy.where}
          </p>
        </div>
      </section>

      <LitStatement still={still} />

      <section className="grid gap-8 border-t border-white/10 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-2 lg:gap-16">
        <h2 className="mx-display text-[clamp(2rem,4.6vw,4.25rem)]">
          {copy.experienceTitle}
        </h2>
        <p className="max-w-[58ch] text-[17px] leading-relaxed text-white/70 md:text-[19px] lg:pt-2">
          {copy.experience}
        </p>
      </section>

      <figure className="relative">
        <Media
          src={img.lights}
          alt="An Atmos venue transformed with lighting"
          sizes="100vw"
          className="aspect-[4/5] w-full sm:aspect-[21/9]"
        />
        <figcaption className="mx-glass-dark absolute right-5 bottom-5 left-5 max-w-[460px] rounded-[var(--mx-r-panel)] rounded-tl-none p-5 md:right-auto md:bottom-10 md:left-10 md:p-6">
          <p className="text-[16px] leading-relaxed text-white">
            {copy.revealA}
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-white/70">
            {copy.revealB}
          </p>
        </figcaption>
      </figure>

      <section className="grid gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-20">
        <h2 className="mx-display text-[clamp(2rem,4.6vw,4.25rem)] lg:sticky lg:top-10 lg:self-start">
          {copy.chatTitle}
        </h2>
        <GroupChat />
      </section>

      <section className="grid border-t border-white/10 lg:grid-cols-2">
        <Media
          src={img.booth}
          alt="DJ playing an Atmos event"
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="aspect-[4/5] lg:aspect-auto lg:min-h-[640px]"
        />
        <div className="flex flex-col justify-center px-5 py-16 md:px-10 lg:py-20">
          <h2 className="mx-display text-[clamp(2rem,4.2vw,4rem)]">
            {copy.spacesTitle}
          </h2>
          <p className="mt-8 max-w-[56ch] text-[17px] leading-relaxed text-white/70">
            {copy.spaces}
          </p>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-white">
            {copy.welcome}
          </p>
        </div>
      </section>

      <NextLinks />
    </>
  );
}

// ---------------------------------------------------------------------------
// B · Group chat

const chatLayout =
  "grid w-full items-center gap-10 px-5 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-20";
const chatTitle = (
  <h2 className="mx-display text-[clamp(2rem,5vw,4.75rem)]">
    {copy.chatTitle}
  </h2>
);

/** The chat section: pinned playback, or the full thread when motion is off. */
function ChatPlayback({ still }: { still: boolean }) {
  if (still) {
    return (
      <section className={cn(chatLayout, "py-20 md:py-28")}>
        {chatTitle}
        <GroupChat />
      </section>
    );
  }
  return <PinnedChat />;
}

/** Pinned chat that plays message by message as you scroll. */
function PinnedChat() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const n = chatMessages.length;
  const [play, setPlay] = useState({ count: 1, typing: false });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const f = Math.min(1, Math.max(0, (p - 0.05) / 0.85)) * (n - 1);
    const count = Math.min(n, 1 + Math.floor(f));
    const typing = count < n && f - Math.floor(f) > 0.45;
    setPlay((cur) =>
      cur.count === count && cur.typing === typing ? cur : { count, typing },
    );
  });

  return (
    <section ref={ref} className="relative h-[320svh]">
      <div className="sticky top-0 flex h-svh items-center py-10">
        <div className={chatLayout}>
          {chatTitle}
          <GroupChat
            count={play.count}
            typing={play.typing}
            animate
            fixedHeight
          />
        </div>
      </div>
    </section>
  );
}

/** B: the group chat carries the page. Type-only opener, the chat plays on scroll, photos come after as proof. */
function ChatDraft({ state }: { state: string }) {
  const still = useStill(state);
  return (
    <>
      <section className="grid gap-10 px-5 pt-14 pb-16 md:px-10 md:pt-24 md:pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-end lg:gap-16">
        <HeroLine className="text-[clamp(2rem,5.4vw,5.5rem)]" />
        <div className="space-y-4 text-[16px] leading-relaxed text-white/70 lg:pb-2">
          <p className="text-white">{copy.where}</p>
          <p>{copy.experience}</p>
        </div>
      </section>

      <div className="border-t border-white/10">
        <ChatPlayback still={still} />
      </div>

      <section className="relative flex min-h-[80svh] items-end overflow-hidden">
        <Media
          src={img.lights}
          alt="An Atmos venue transformed with lighting"
          sizes="100vw"
          className="absolute inset-0"
        />
        <div className="mx-scrim-left absolute inset-0" />
        <div className="mx-scrim-bottom absolute inset-0 opacity-80" />
        <p className="mx-display relative max-w-[20ch] px-5 pb-12 text-[clamp(1.6rem,4.4vw,4rem)] leading-[1] md:px-10 md:pb-16">
          {copy.statement}
        </p>
      </section>

      <section className="grid md:grid-cols-2">
        <div className="border-white/10 px-5 py-16 md:border-r md:px-10 md:py-24">
          <h2 className="mx-display text-[clamp(1.75rem,3.4vw,3rem)]">
            {copy.spacesTitle}
          </h2>
          <p className="mt-6 max-w-[56ch] text-[16px] leading-relaxed text-white/70 md:text-[17px]">
            {copy.spaces}
          </p>
        </div>
        <div className="border-t border-white/10 px-5 py-16 md:border-t-0 md:px-10 md:py-24">
          <h2 className="mx-display text-[clamp(1.75rem,3.4vw,3rem)]">
            Everyone&apos;s welcome.
          </h2>
          <p className="mt-6 max-w-[56ch] text-[16px] leading-relaxed text-white/70 md:text-[17px]">
            No pretension, no pressure. Just a good environment with good people
            around you.
          </p>
        </div>
      </section>

      <section className="grid gap-px bg-white/10 sm:grid-cols-2">
        {[
          {
            src: img.booth,
            alt: "DJ playing an Atmos event",
            caption: copy.revealA,
          },
          { src: img.closing, alt: "Atmos gig photo", caption: copy.revealB },
        ].map((p) => (
          <figure key={p.src} className="bg-black">
            <Media
              src={p.src}
              alt={p.alt}
              sizes="(min-width: 640px) 50vw, 100vw"
              className="aspect-[4/3]"
            />
            <figcaption className="max-w-[52ch] px-5 pt-4 pb-10 text-[14px] leading-relaxed text-white/65 md:px-10">
              {p.caption}
            </figcaption>
          </figure>
        ))}
      </section>

      <NextLinks />
    </>
  );
}

// ---------------------------------------------------------------------------
// C · Index

const chapters = [
  {
    title: copy.experienceTitle,
    body: copy.experience,
    image: img.lights,
    alt: "An Atmos venue transformed with lighting",
  },
  {
    title: "Sound, light, space.",
    body: `${copy.statement} ${copy.revealB}`,
    image: img.booth,
    alt: "DJ playing an Atmos event",
  },
  {
    title: "Leave it at the door.",
    body: "There's a lot going on.",
    chat: true,
  },
  {
    title: copy.spacesTitle,
    body: copy.spaces,
    image: img.closing,
    alt: "Atmos gig photo",
  },
  {
    title: "Everyone's welcome.",
    body: "No pretension, no pressure. Just a good environment with good people around you.",
    image: img.floor,
    alt: "The crowd at an Atmos event",
  },
] as const satisfies readonly {
  title: string;
  body: string;
  image?: string;
  alt?: string;
  chat?: true;
}[];

/** C: split opener, then the story as a numbered, ruled index. Dense, scannable, one entrance animation. */
function IndexDraft({ state }: { state: string }) {
  const still = useStill(state);
  return (
    <>
      <section className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex flex-col justify-end px-5 pt-14 pb-12 md:px-10 md:pt-24 md:pb-16">
          <motion.div
            initial={still ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroLine className="text-[clamp(2rem,4.6vw,5rem)]" />
          </motion.div>
          <p className="mt-8 max-w-[44ch] text-[16px] text-white/70 md:text-[18px]">
            {copy.where}
          </p>
        </div>
        <Media
          src={img.crowd}
          alt="Crowd at an Atmos event"
          sizes="(min-width: 1024px) 46vw, 100vw"
          className="aspect-[4/3] lg:aspect-auto lg:min-h-[620px]"
          priority
        />
      </section>

      <ol className="border-t border-white/10">
        {chapters.map((c, i) => (
          <li
            key={c.title}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 gap-y-6 border-b border-white/10 px-5 py-10 md:grid-cols-[4rem_minmax(0,1fr)] md:px-10 md:py-14 lg:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,300px)] lg:gap-x-10"
          >
            <span className="mx-label mx-num pt-2 text-[12px] text-white/55">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2 className="mx-display text-[clamp(1.6rem,3.2vw,2.75rem)]">
              {c.title}
            </h2>
            <p className="col-start-2 max-w-[56ch] text-[16px] leading-relaxed text-white/70 lg:col-start-3 lg:row-start-1 lg:pt-1">
              {c.body}
            </p>
            {"chat" in c ? (
              <GroupChat className="col-start-2 max-w-[440px] lg:col-span-2 lg:col-start-3" />
            ) : (
              <Media
                src={c.image}
                alt={c.alt}
                sizes="(min-width: 1024px) 300px, 90vw"
                className="col-start-2 aspect-[4/3] lg:col-start-4 lg:row-start-1"
              />
            )}
          </li>
        ))}
      </ol>

      <NextLinks />
    </>
  );
}

export const aboutPage: PageSpec = {
  id: "about",
  title: "About",
  route: "/about",
  states: [
    { id: "default", label: "Default" },
    {
      id: "reduced",
      label: "Reduced motion",
      hint: "Scroll moments render finished, as prefers-reduced-motion visitors see them",
    },
  ],
  drafts: [
    {
      id: "a",
      label: "A · Manifesto",
      note: "Crowd hero, a pinned statement that lights up word by word on scroll, then editorial beats and a static group chat.",
      Component: ManifestoDraft,
      heroUnderHeader: true,
    },
    {
      id: "b",
      label: "B · Group chat",
      note: "Type-only opener; the group chat is the scroll moment, playing message by message while pinned. Photos follow as proof.",
      Component: ChatDraft,
    },
    {
      id: "c",
      label: "C · Index",
      note: "Split opener, then the story as a numbered, ruled index with thumbnails. Densest; only a one-shot entrance.",
      Component: IndexDraft,
    },
  ],
};
