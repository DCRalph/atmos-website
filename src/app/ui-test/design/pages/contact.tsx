"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
import { cn } from "~/lib/utils";
import { useBoard } from "../board-state";
import { photos } from "../fixtures";
import { Media, buttonVariants } from "../primitives";
import { PageTitle } from "./chrome";
import { ContactForm } from "./contact-form";
import type { PageSpec } from "./types";

// Real routes from src/app/(main)/contact/Contact.tsx.
const subtitle = "Bookings, collabs, questions. Send us a message.";
const instagram = {
  handle: "@atmos.nz",
  href: "https://instagram.com/atmos.nz",
};
const pro = {
  who: "For agencies, promoters, brands, venues and other professional enquiries.",
  name: "Finn",
  phone: "+64 27 472 6850",
  phoneHref: "tel:+64274726850",
  email: "finn@atmosmedia.co.nz",
};

/** Copies a phone number or email, confirming with a toast and a tick. */
function CopyButton({
  value,
  label,
  glass = false,
}: {
  value: string;
  label: string;
  glass?: boolean;
}) {
  const { toast } = useBoard();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: `${label} copied`, tone: "success" });
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({
        title: "Couldn't copy. Select it and copy instead.",
        tone: "error",
      });
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label.toLowerCase()}`}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border text-white/70 transition-colors hover:text-white",
        glass ? "mx-glass" : "border-white/15 hover:border-white/40",
      )}
    >
      {copied ? (
        <Check className="size-4 text-[var(--mx-accent-text)]" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

/** Finn's contact lines as a definition list; used by drafts A and B. */
function ProDetails({
  glass = false,
  className,
}: {
  glass?: boolean;
  className?: string;
}) {
  // Over the photo the panel is narrow, so email takes its own row there.
  const rows = [
    { term: "Contact", value: pro.name },
    { term: "Phone", value: pro.phone, href: pro.phoneHref },
    { term: "Email", value: pro.email, href: `mailto:${pro.email}` },
  ];
  return (
    <dl
      className={cn(
        "grid gap-4 sm:gap-x-8",
        glass
          ? "sm:grid-cols-[auto_minmax(0,1fr)]"
          : "sm:grid-cols-[auto_auto_minmax(0,1fr)]",
        className,
      )}
    >
      {rows.map((r) => (
        <div
          key={r.term}
          className={cn(glass && r.term === "Email" && "sm:col-span-2")}
        >
          <dt className="mx-label text-[10px] text-white/60">{r.term}</dt>
          <dd className="mt-2 flex min-h-9 items-center gap-2 text-[16px]">
            {r.href ? (
              <>
                <a
                  href={r.href}
                  className="mx-num truncate underline decoration-white/30 underline-offset-4 hover:decoration-white"
                >
                  {r.value}
                </a>
                <CopyButton value={r.value} label={r.term} glass={glass} />
              </>
            ) : (
              r.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function InstagramLink({ variant }: { variant: "glass" | "outline" }) {
  return (
    <a
      href={instagram.href}
      target="_blank"
      rel="noreferrer"
      className={buttonVariants({ variant, size: "sm" })}
    >
      <FaInstagram className="size-3.5" /> Open Instagram
    </a>
  );
}

// ---------------------------------------------------------------------------

/** A: the CAGED photo fills the page; routes and form float on it as notched glass. */
function PhotoDraft({ state }: { state: string }) {
  return (
    <section className="relative overflow-hidden">
      <Media
        src={photos.caged}
        alt=""
        sizes="100vw"
        className="absolute inset-0"
        priority
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="mx-scrim-left absolute inset-0" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />

      <div className="relative grid gap-10 px-5 pt-28 pb-16 md:px-10 md:pt-36 md:pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:gap-16">
        <div>
          <h1 className="mx-display text-[clamp(3rem,10vw,8.5rem)]">
            Hit us up
          </h1>
          <p className="mt-5 max-w-[44ch] text-[17px] text-white/80">
            {subtitle}
          </p>

          <div className="mx-glass-dark mt-10 max-w-[560px] rounded-[var(--mx-r-panel)] rounded-tl-none">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-5 md:p-6">
              <div>
                <h2 className="mx-label text-[12px]">Instagram DM</h2>
                <p className="mt-2 text-[15px] text-white/75">
                  Quickest reply. Message{" "}
                  <a
                    href={instagram.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white underline underline-offset-4"
                  >
                    {instagram.handle}
                  </a>
                </p>
              </div>
              <InstagramLink variant="glass" />
            </div>
            <div className="p-5 md:p-6">
              <h2 className="mx-label text-[12px]">Professional enquiries</h2>
              <p className="mt-2 text-[15px] text-white/75">{pro.who}</p>
              <ProDetails glass className="mt-5" />
            </div>
          </div>
        </div>

        <div className="mx-glass-dark rounded-[var(--mx-r-panel)] rounded-tl-none p-5 md:p-8 lg:self-start">
          <h2 className="mx-display mb-7 text-[clamp(1.5rem,2.4vw,2rem)]">
            Drop us a line
          </h2>
          <ContactForm key={state} state={state} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function DirectoryRow({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5 border-b border-white/10 px-5 py-9 md:px-10 md:py-12 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
      <h2 className="mx-display text-[clamp(1.35rem,2.2vw,1.75rem)]">
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** B: no photo. A ruled directory where the form is just the last route. */
function DirectoryDraft({ state }: { state: string }) {
  return (
    <>
      <PageTitle title="Hit us up" intro={subtitle} />
      <div className="border-t border-white/10">
        <DirectoryRow title="Instagram DM">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <p className="text-[17px] text-white/75">
              The quickest reply. DM us at{" "}
              <span className="text-white">{instagram.handle}</span>
            </p>
            <InstagramLink variant="outline" />
          </div>
        </DirectoryRow>
        <DirectoryRow title="Professional enquiries">
          <p className="max-w-[60ch] text-[17px] text-white/75">{pro.who}</p>
          <ProDetails className="mt-6" />
        </DirectoryRow>
        <DirectoryRow title="Drop us a line">
          <div className="max-w-[720px]">
            <ContactForm key={state} state={state} />
          </div>
        </DirectoryRow>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

const posterLines = [
  {
    value: instagram.handle,
    meta: "Instagram DM · Quickest reply",
    href: instagram.href,
    external: true,
  },
  {
    value: pro.phone,
    meta: "Finn · Phone · Professional enquiries",
    href: pro.phoneHref,
    copy: "Phone",
  },
  {
    value: pro.email,
    meta: "Finn · Email · Agencies, promoters, brands, venues",
    href: `mailto:${pro.email}`,
    copy: "Email",
  },
] as const satisfies readonly {
  value: string;
  meta: string;
  href: string;
  external?: true;
  copy?: string;
}[];

/** C: the contact details are the poster. Huge display lines, then the form. */
function PosterDraft({ state }: { state: string }) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 px-5 pt-12 pb-10 md:px-10 md:pt-20 md:pb-14">
        <h1 className="mx-display text-[clamp(2.75rem,9vw,7rem)]">Hit us up</h1>
        <p className="max-w-[36ch] text-[16px] text-white/70 md:pb-2 md:text-[17px]">
          {subtitle}
        </p>
      </div>

      <ul className="border-t border-white/10">
        {posterLines.map((l) => (
          <li
            key={l.value}
            className="flex items-center gap-3 border-b border-white/10 px-5 py-6 md:gap-5 md:px-10 md:py-9"
          >
            <a
              href={l.href}
              {...("external" in l
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
              className="group flex min-w-0 flex-1 items-center gap-5"
            >
              <span className="min-w-0 flex-1">
                <span className="mx-display mx-num block text-[clamp(1.1rem,4.6vw,4.5rem)] transition-colors group-hover:text-[var(--mx-accent-text)]">
                  {l.value}
                </span>
                <span className="mt-3 block text-[13px] text-white/60 md:text-[14px]">
                  {l.meta}
                </span>
              </span>
              <span className="hidden size-14 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 md:flex">
                <ArrowUpRight className="size-5" />
              </span>
            </a>
            {"copy" in l ? <CopyButton value={l.value} label={l.copy} /> : null}
          </li>
        ))}
      </ul>

      <section className="grid gap-8 px-5 py-16 md:px-10 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,640px)] lg:gap-16">
        <h2 className="mx-display text-[clamp(1.75rem,4vw,3.5rem)]">
          Drop us a line
        </h2>
        <ContactForm key={state} state={state} subjectPills />
      </section>
    </>
  );
}

export const contactPage: PageSpec = {
  id: "contact",
  title: "Contact",
  route: "/contact",
  nav: "Contact",
  states: [
    { id: "default", label: "Default" },
    {
      id: "errors",
      label: "Validation errors",
      hint: "As if sent empty; typing in a field clears its error",
    },
    {
      id: "sending",
      label: "Sending",
      hint: "Held mid-send; the button label carries the busy state",
    },
    { id: "sent", label: "Sent", hint: "Real success copy" },
  ],
  drafts: [
    {
      id: "a",
      label: "A · Photo",
      note: "The CAGED photo fills the page; routes and form float on it as notched glass panels.",
      Component: PhotoDraft,
      heroUnderHeader: true,
    },
    {
      id: "b",
      label: "B · Directory",
      note: "No photo. A ruled directory: Instagram, Finn, then the form as the last route. Copy buttons on phone and email.",
      Component: DirectoryDraft,
    },
    {
      id: "c",
      label: "C · Poster",
      note: "The details are the design: huge display lines you can tap or copy, then the form with one-tap subjects.",
      Component: PosterDraft,
    },
  ],
};
