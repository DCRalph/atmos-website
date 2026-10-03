"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { motion, useScroll } from "motion/react";
import {
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Link2,
  List,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useBoard } from "../board-state";
import {
  legalDocs,
  readingMinutes,
  type LegalBlock,
  type LegalDoc,
  type LegalSection,
} from "./legal-docs";
import type { PageSpec } from "./types";

type DocId = LegalDoc["id"];
const docIdFor = (state: string): DocId =>
  state === "terms" ? "terms" : "privacy";

/** Id of the last section whose heading has scrolled above `offset`px. */
function useActiveSection(doc: LegalDoc, offset = 140) {
  const [active, setActive] = useState(doc.sections[0]?.id);
  useEffect(() => {
    const onScroll = () => {
      let current = doc.sections[0]?.id;
      for (const s of doc.sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < offset) current = s.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [doc, offset]);
  const index = Math.max(
    0,
    doc.sections.findIndex((s) => s.id === active),
  );
  return { active, index };
}

/** Privacy / Terms pills. Switches the document in place. */
function DocSwitch({
  value,
  onChange,
}: {
  value: DocId;
  onChange: (id: DocId) => void;
}) {
  return (
    <div className="flex gap-2" role="group" aria-label="Document">
      {(["privacy", "terms"] as const).map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "mx-label h-9 rounded-full border px-4 text-[11px] transition-colors",
            value === id
              ? "border-white bg-white text-black"
              : "border-white/20 text-white/75 hover:border-white/50 hover:text-white",
          )}
        >
          {id === "privacy" ? "Privacy" : "Terms"}
        </button>
      ))}
    </div>
  );
}

function Meta({ doc }: { doc: LegalDoc }) {
  return (
    <p className="mx-num mt-5 text-[14px] text-white/60">
      Last updated {doc.updated} · {readingMinutes(doc)} min read
    </p>
  );
}

const bodyText = "text-[16px] leading-[1.7] text-white/75 md:text-[17px]";

function Block({ block }: { block: LegalBlock }) {
  if ("sub" in block)
    return (
      <h3 className="mx-label pt-3 text-[12px] text-white">{block.sub}</h3>
    );
  if ("list" in block) {
    return (
      <ul
        className={cn(
          bodyText,
          "list-disc space-y-2 pl-5 marker:text-white/35",
        )}
      >
        {block.list.map((item) => (
          <li key={item} className="pl-1">
            {item}
          </li>
        ))}
      </ul>
    );
  }
  if ("terms" in block) {
    return (
      <dl className={cn(bodyText, "space-y-3")}>
        {block.terms.map((t) => (
          <div key={t.term}>
            <dt className="inline font-semibold text-white">{t.term}. </dt>
            <dd className="inline">{t.text}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if ("contact" in block) {
    return (
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-6 gap-y-3 text-[16px] md:text-[17px]">
        {block.contact.map((c) => (
          <div key={c.label} className="contents">
            <dt className="mx-label text-[10px] text-white/60">{c.label}</dt>
            <dd>
              <a
                href={c.href}
                className="break-all underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                {c.value}
              </a>
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  const { p, link } = block;
  const at = link ? p.indexOf(link.text) : -1;
  if (!link || at < 0) return <p className={bodyText}>{p}</p>;
  return (
    <p className={bodyText}>
      {p.slice(0, at)}
      <a
        href={link.href}
        className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
      >
        {link.text}
      </a>
      {p.slice(at + link.text.length)}
    </p>
  );
}

/** Section heading with a copy-link anchor (visible on hover, always on touch). */
function SectionHeading({
  section,
  hangNumber = false,
}: {
  section: LegalSection;
  hangNumber?: boolean;
}) {
  const { toast } = useBoard();
  const copy = (e: MouseEvent<HTMLAnchorElement>) => {
    const url = new URL(window.location.href);
    url.hash = section.id;
    navigator.clipboard.writeText(url.toString()).then(
      () => toast({ title: "Link to section copied", tone: "success" }),
      () => toast({ title: "Couldn't copy the link", tone: "error" }),
    );
    e.currentTarget.blur();
  };
  return (
    <h2 className="group relative flex items-baseline gap-3">
      <span
        className={cn(
          "mx-label mx-num w-8 shrink-0 text-[12px] text-white/50",
          hangNumber &&
            "xl:absolute xl:top-1 xl:right-full xl:mr-8 xl:w-auto xl:text-right",
        )}
      >
        {section.n}
      </span>
      <span className="mx-display text-[clamp(1.25rem,2.2vw,1.75rem)] leading-[1.05]">
        {section.title}
      </span>
      <a
        href={`#${section.id}`}
        onClick={copy}
        aria-label={`Copy link to ${section.title}`}
        className="flex size-8 shrink-0 translate-y-1 items-center justify-center self-start rounded-full text-white/50 transition-opacity hover:text-white focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
      >
        <Link2 className="size-4" />
      </a>
    </h2>
  );
}

function Sections({
  doc,
  hangNumbers = false,
}: {
  doc: LegalDoc;
  hangNumbers?: boolean;
}) {
  return (
    <>
      {doc.sections.map((s) => (
        <section
          key={s.id}
          id={s.id}
          className="scroll-mt-20 border-t border-white/10 py-10 first:border-t-0 first:pt-0 md:py-12"
        >
          <SectionHeading section={s} hangNumber={hangNumbers} />
          <div className="mt-6 space-y-5">
            {s.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function TocLink({
  section,
  active,
  onPick,
  className,
}: {
  section: LegalSection;
  active: boolean;
  onPick?: () => void;
  className?: string;
}) {
  return (
    <a
      href={`#${section.id}`}
      onClick={onPick}
      aria-current={active ? "location" : undefined}
      className={cn(
        "flex gap-3 text-[14px] leading-snug transition-colors",
        active ? "text-white" : "text-white/60 hover:text-white",
        className,
      )}
    >
      <span
        className={cn(
          "mx-num w-7 shrink-0",
          active ? "text-[var(--mx-accent-text)]" : "text-white/40",
        )}
      >
        {section.n}
      </span>
      {section.title}
    </a>
  );
}

// ---------------------------------------------------------------------------

/** A: sticky contents rail on desktop; a sticky "Contents" bar that expands on mobile. */
function SidebarDoc({ initial }: { initial: DocId }) {
  const [docId, setDocId] = useState(initial);
  const doc = legalDocs[docId];
  const { active, index } = useActiveSection(doc);
  const [open, setOpen] = useState(false);
  const current = doc.sections[index];

  return (
    <div className="px-5 md:px-10">
      <header className="pt-10 pb-10 md:pt-16 md:pb-14 lg:pl-[calc(240px+4rem)]">
        <DocSwitch value={docId} onChange={setDocId} />
        <h1 className="mx-display mt-8 text-[clamp(2.25rem,6.5vw,5.5rem)]">
          {doc.title}
        </h1>
        <Meta doc={doc} />
      </header>

      <div className="border-t border-white/10 pb-24">
        <div className="sticky top-0 z-30 -mx-5 border-b border-white/10 bg-black md:-mx-10 lg:hidden">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="legal-mobile-toc"
            onClick={() => setOpen((o) => !o)}
            className="flex h-14 w-full items-center gap-3 px-5 text-left md:px-10"
          >
            <span className="mx-label text-[11px]">Contents</span>
            <span className="min-w-0 flex-1 truncate text-[14px] text-white/65">
              {current ? `${current.n} · ${current.title}` : null}
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-white/60 transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
          {open ? (
            <ol
              id="legal-mobile-toc"
              className="max-h-[60svh] space-y-1 overflow-y-auto border-t border-white/10 px-5 py-3 md:px-10"
            >
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <TocLink
                    section={s}
                    active={s.id === active}
                    onPick={() => setOpen(false)}
                    className="py-2"
                  />
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        <div className="grid pt-10 lg:grid-cols-[240px_minmax(0,68ch)] lg:gap-16 lg:pt-14">
          <nav aria-label="Contents" className="hidden lg:block">
            <div className="sticky top-8">
              <p className="mx-label mb-5 text-[11px] text-white/60">
                Contents
              </p>
              <ol className="space-y-0.5 border-l border-white/10">
                {doc.sections.map((s) => (
                  <li key={s.id}>
                    <TocLink
                      section={s}
                      active={s.id === active}
                      className={cn(
                        "-ml-px border-l-2 py-1.5 pl-4",
                        s.id === active
                          ? "border-[var(--mx-accent)]"
                          : "border-transparent",
                      )}
                    />
                  </li>
                ))}
              </ol>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0 });
                }}
                className="mx-label mt-8 inline-flex items-center gap-2 text-[11px] text-white/60 hover:text-white"
              >
                <ArrowUp className="size-3.5" /> Back to top
              </a>
            </div>
          </nav>
          <article>
            <Sections doc={doc} />
          </article>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** B: one centred column. A sticky reading bar carries contents, prev/next and a scroll-linked progress line. */
function ReaderDoc({ initial }: { initial: DocId }) {
  const [docId, setDocId] = useState(initial);
  const doc = legalDocs[docId];
  const { active, index } = useActiveSection(doc);
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: articleRef,
    offset: ["start 60px", "end end"],
  });
  const current = doc.sections[index];
  const prev = doc.sections[index - 1];
  const next = doc.sections[index + 1];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !barRef.current?.contains(e.target))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (s: LegalSection | undefined) =>
    s && document.getElementById(s.id)?.scrollIntoView();
  const column = "mx-auto w-full max-w-[72ch]";
  const stepClass =
    "flex size-9 items-center justify-center rounded-full border border-white/15 text-white/75 hover:border-white/40 hover:text-white disabled:opacity-30";

  return (
    <>
      <header className={cn(column, "px-5 pt-12 pb-10 md:pt-20 md:pb-14")}>
        <DocSwitch value={docId} onChange={setDocId} />
        <h1 className="mx-display mt-8 text-[clamp(2.25rem,6.5vw,5rem)]">
          {doc.title}
        </h1>
        <Meta doc={doc} />
      </header>

      <div className="pb-24">
        <div
          ref={barRef}
          className="sticky top-0 z-30 border-y border-white/10 bg-black"
        >
          <div
            className={cn(column, "relative flex h-14 items-center gap-3 px-5")}
          >
            <button
              type="button"
              aria-expanded={open}
              aria-controls="legal-reader-toc"
              onClick={() => setOpen((o) => !o)}
              className="mx-label flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/20 px-4 text-[11px] hover:border-white/50"
            >
              <List className="size-3.5" />{" "}
              <span className="max-sm:sr-only">Contents</span>
            </button>
            <p
              className="min-w-0 flex-1 truncate text-[14px] text-white/75"
              aria-live="polite"
            >
              {current ? (
                <>
                  <span className="mx-num text-[var(--mx-accent-text)]">
                    {current.n}
                  </span>{" "}
                  {current.title}
                </>
              ) : null}
            </p>
            <button
              type="button"
              aria-label="Previous section"
              disabled={!prev}
              onClick={() => go(prev)}
              className={stepClass}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next section"
              disabled={!next}
              onClick={() => go(next)}
              className={stepClass}
            >
              <ChevronRight className="size-4" />
            </button>

            {open ? (
              <ol
                id="legal-reader-toc"
                className="mx-float absolute top-full left-5 mt-2 max-h-[min(60svh,520px)] w-[min(420px,calc(100vw-2.5rem))] overflow-y-auto rounded-[var(--mx-r-panel)] rounded-tl-none border border-white/12 bg-[var(--mx-raised)] p-2"
              >
                {doc.sections.map((s) => (
                  <li key={s.id}>
                    <TocLink
                      section={s}
                      active={s.id === active}
                      onPick={() => setOpen(false)}
                      className={cn(
                        "rounded-[10px] px-3 py-2.5",
                        s.id === active && "bg-white/10",
                      )}
                    />
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
          <motion.div
            aria-hidden
            className="absolute inset-x-0 -bottom-px h-0.5 origin-left bg-[var(--mx-accent)]"
            style={{ scaleX: scrollYProgress }}
          />
        </div>

        <article ref={articleRef} className={cn(column, "px-5 pt-10 md:pt-14")}>
          <Sections doc={doc} hangNumbers />
        </article>
      </div>
    </>
  );
}

export const legalPage: PageSpec = {
  id: "legal",
  title: "Privacy & terms",
  route: "/privacy",
  states: [
    { id: "privacy", label: "Privacy", hint: "/privacy" },
    { id: "terms", label: "Terms", hint: "/terms" },
  ],
  drafts: [
    {
      id: "a",
      label: "A · Sidebar",
      note: "Sticky contents rail that tracks your section on desktop; a sticky Contents bar that expands on mobile. Date is pinned (real page prints today's).",
      Component: ({ state }) => (
        <SidebarDoc key={state} initial={docIdFor(state)} />
      ),
    },
    {
      id: "b",
      label: "B · Reader",
      note: "One centred column with hanging numbers. A sticky reading bar holds contents, prev/next and a scroll-linked progress line.",
      Component: ({ state }) => (
        <ReaderDoc key={state} initial={docIdFor(state)} />
      ),
    },
  ],
};
