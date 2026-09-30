"use client";

import Link from "next/link";
import { useContext, useEffect, useState, type MouseEvent } from "react";
import { ArrowUp, ChevronDown, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { ScrollContainerContext } from "~/components/scroll-container-provider";
import {
  readingMinutes,
  type LegalBlock,
  type LegalDoc,
  type LegalSection,
} from "./legal-docs";

// Headings count as "reached" once they pass under the fixed header plus a margin.
const ACTIVE_OFFSET = 160;

/**
 * Id of the last section whose heading has scrolled above the header. Tracks
 * `#main-layout-container`, which is what scrolls on the public site. At the
 * very bottom the last section wins, since short closing sections never reach
 * the top.
 */
function useActiveSection(sections: readonly LegalSection[]) {
  const scrollRef = useContext(ScrollContainerContext);
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const container = scrollRef?.current;
    if (!container) return;
    const onScroll = () => {
      const atBottom =
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - 2;
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < ACTIVE_OFFSET)
          current = s.id;
      }
      setActive(atBottom ? sections.at(-1)?.id : current);
    };
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [scrollRef, sections]);

  return active;
}

/**
 * Privacy policy or terms: a sticky contents rail that follows your place on
 * desktop, a collapsible contents bar on mobile, and linkable sections.
 */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const active = useActiveSection(doc.sections);
  const scrollRef = useContext(ScrollContainerContext);
  const [open, setOpen] = useState(false);
  const current = doc.sections.find((s) => s.id === active);

  return (
    <div className="px-5 md:px-10">
      <header className="pt-10 pb-10 md:pt-16 md:pb-14 lg:pl-[calc(240px+4rem)]">
        <DocSwitch current={doc.id} />
        <h1 className="t-display mt-8 text-[clamp(2.25rem,6.5vw,5.5rem)] break-words">
          {doc.title}
        </h1>
        <p className="mt-5 text-[14px] text-white/60 tabular-nums">
          Last updated {doc.updated} · {readingMinutes(doc)} min read
        </p>
      </header>

      <div className="border-t border-white/10 pb-24">
        <div className="sticky top-16 z-30 -mx-5 border-b border-white/10 bg-black md:top-20 md:-mx-10 lg:hidden">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="legal-mobile-toc"
            onClick={() => setOpen((o) => !o)}
            className="flex h-14 w-full items-center gap-3 px-5 text-left md:px-10"
          >
            <span className="t-label text-[11px]">Contents</span>
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
            <div className="sticky top-28">
              <p className="t-label mb-5 text-[11px] text-white/60">Contents</p>
              <ol className="space-y-0.5 border-l border-white/10">
                {doc.sections.map((s) => (
                  <li key={s.id}>
                    <TocLink
                      section={s}
                      active={s.id === active}
                      className={cn(
                        "-ml-px border-l-2 py-1.5 pl-4",
                        s.id === active
                          ? "border-[var(--site-accent)]"
                          : "border-transparent",
                      )}
                    />
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => scrollRef?.current?.scrollTo({ top: 0 })}
                className="t-label mt-8 inline-flex items-center gap-2 text-[11px] text-white/60 hover:text-white"
              >
                <ArrowUp className="size-3.5" /> Back to top
              </button>
            </div>
          </nav>
          <article>
            {doc.sections.map((s) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-36 border-t border-white/10 py-10 first:border-t-0 first:pt-0 md:scroll-mt-40 md:py-12 lg:scroll-mt-28"
              >
                <SectionHeading section={s} />
                <div className="mt-6 space-y-5">
                  {s.blocks.map((b, i) => (
                    <Block key={i} block={b} />
                  ))}
                </div>
              </section>
            ))}
          </article>
        </div>
      </div>
    </div>
  );
}

/** Privacy / Terms pills, one per route. */
function DocSwitch({ current }: { current: LegalDoc["id"] }) {
  const docs = [
    { id: "privacy", label: "Privacy", href: "/privacy" },
    { id: "terms", label: "Terms", href: "/terms" },
  ] as const;
  return (
    <nav className="flex gap-2" aria-label="Legal documents">
      {docs.map((d) => (
        <Link
          key={d.id}
          href={d.href}
          aria-current={d.id === current ? "page" : undefined}
          className={cn(
            "t-label inline-flex h-9 items-center rounded-full border px-4 text-[11px] transition-colors",
            d.id === current
              ? "border-white bg-white text-black"
              : "border-white/20 text-white/75 hover:border-white/50 hover:text-white",
          )}
        >
          {d.label}
        </Link>
      ))}
    </nav>
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
          "w-7 shrink-0 tabular-nums",
          active ? "text-[var(--site-accent-text)]" : "text-white/40",
        )}
      >
        {section.n}
      </span>
      {section.title}
    </a>
  );
}

/** Section heading with a copy-link anchor (on hover on desktop, always on touch). */
function SectionHeading({ section }: { section: LegalSection }) {
  const copy = (e: MouseEvent<HTMLAnchorElement>) => {
    const url = new URL(window.location.href);
    url.hash = section.id;
    navigator.clipboard.writeText(url.toString()).then(
      () => toast.success("Link to section copied"),
      () => toast.error("Couldn't copy the link"),
    );
    e.currentTarget.blur();
  };
  return (
    <h2 className="group flex items-baseline gap-3">
      <span className="t-label w-8 shrink-0 text-[12px] text-white/50 tabular-nums">
        {section.n}
      </span>
      <span className="t-display min-w-0 text-[clamp(1.25rem,2.2vw,1.75rem)] leading-[1.05] break-words">
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

const bodyText = "text-[16px] leading-[1.7] text-white/75 md:text-[17px]";
const linkClass =
  "text-white underline decoration-white/30 underline-offset-4 hover:decoration-white";

/** A link in body copy: client-side for our own pages, plain for mailto. */
function InlineLink({ href, children }: { href: string; children: string }) {
  return href.startsWith("/") ? (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  ) : (
    <a href={href} className={cn(linkClass, "break-all")}>
      {children}
    </a>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if ("sub" in block)
    return <h3 className="t-label pt-3 text-[12px] text-white">{block.sub}</h3>;

  if ("list" in block)
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

  if ("terms" in block)
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

  if ("contact" in block)
    return (
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-6 gap-y-3 text-[16px] md:text-[17px]">
        {block.contact.map((c) => (
          <div key={c.label} className="contents">
            <dt className="t-label text-[10px] text-white/60">{c.label}</dt>
            <dd>
              <InlineLink href={c.href}>{c.value}</InlineLink>
            </dd>
          </div>
        ))}
      </dl>
    );

  const { p, link } = block;
  const at = link ? p.indexOf(link.text) : -1;
  if (!link || at < 0) return <p className={bodyText}>{p}</p>;
  return (
    <p className={bodyText}>
      {p.slice(0, at)}
      <InlineLink href={link.href}>{link.text}</InlineLink>
      {p.slice(at + link.text.length)}
    </p>
  );
}
