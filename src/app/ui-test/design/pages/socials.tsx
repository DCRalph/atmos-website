"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Copy, Share2 } from "lucide-react";
import {
  FaFacebook,
  FaInstagram,
  FaSoundcloud,
  FaSpotify,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import type { IconType } from "react-icons";
import { cn } from "~/lib/utils";
import { useBoard } from "../board-state";
import { AtmosLogo, Media } from "../primitives";
import { PageTitle } from "./chrome";
import type { PageSpec } from "./types";

type Social = {
  label: string;
  href: string;
  handle: string;
  /** Brand colour, used only as a small accent. */
  color: string;
  Icon: IconType;
  /** What you'll find there. Illustrative, except SoundCloud and Spotify. */
  what: string;
};

// Links and handles are the live ones from the current Socials page.
const socials: Social[] = [
  {
    label: "Instagram",
    href: "https://instagram.com/atmos.nz",
    handle: "@atmos.nz",
    color: "#E1306C",
    Icon: FaInstagram,
    what: "Gig announcements, posters and photos",
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@atmos_tv",
    handle: "@atmos_tv",
    color: "#00F2EA",
    Icon: FaTiktok,
    what: "Clips from the floor",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@Atmosmediatv",
    handle: "@Atmosmediatv",
    color: "#FF0000",
    Icon: FaYoutube,
    what: "Sets and videos",
  },
  {
    label: "SoundCloud",
    href: "https://soundcloud.com/atmosmedia",
    handle: "atmosmedia",
    color: "#FF5500",
    Icon: FaSoundcloud,
    what: "Atmos Radio and Atmos Selects",
  },
  {
    label: "Spotify",
    href: "https://open.spotify.com/user/31zgkcouzyfpwhb3pfixdpvlfaom?si=a7f5f0fae13e4b1b",
    handle: "ATMOS",
    color: "#1DB954",
    Icon: FaSpotify,
    what: "Atmos Selects, updated weekly",
  },
  {
    label: "Facebook",
    href: "https://facebook.com/atmos.nz",
    handle: "atmos.nz",
    color: "#1877F2",
    Icon: FaFacebook,
    what: "Events and updates",
  },
];

const intro = "Gig drops, sets and clips. Pick your platform.";
const pageUrl = "https://atmosmedia.co.nz/socials";

/** Copy text, then confirm with a toast and a short-lived "copied" flag for the button. */
function useCopy() {
  const { toast } = useBoard();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast({ title: `${what} copied`, tone: "success" });
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      toast({
        title: "Couldn't copy. Long-press the link instead.",
        tone: "error",
      });
    }
  };
  return { copied, copy };
}

function CopyButton({
  social,
  copied,
  onCopy,
  glass = false,
}: {
  social: Social;
  copied: boolean;
  onCopy: () => void;
  glass?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={
        copied
          ? `${social.label} handle copied`
          : `Copy ${social.label} handle ${social.handle}`
      }
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
        glass
          ? "mx-glass text-white hover:bg-white/15"
          : "border border-white/20 text-white/75 hover:border-white hover:text-white",
        copied &&
          "border-transparent bg-[var(--mx-accent)] text-[var(--mx-accent-ink)] hover:bg-[var(--mx-accent)]",
      )}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// A · Directory

/** One row per platform: big name, handle, what's there, copy and open. */
function DirectoryDraft() {
  const { copied, copy } = useCopy();
  return (
    <div className="pb-20">
      <PageTitle title="Socials" intro={intro} />
      <ul className="mx-5 border-t border-white/10 md:mx-10">
        {socials.map((s) => (
          <li key={s.label} className="group relative border-b border-white/10">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-5 md:grid-cols-[40px_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] md:gap-x-6 md:py-6">
              <s.Icon
                className="size-6 max-md:hidden"
                style={{ color: s.color }}
              />
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 after:absolute after:inset-0"
              >
                <span className="mx-display block truncate text-[clamp(1.25rem,3.6vw,3rem)]">
                  {s.label}
                </span>
              </a>
              <p className="mx-label flex min-w-0 items-center gap-2 text-[12px] text-white/85 max-md:col-start-1 max-md:row-start-2">
                <s.Icon
                  className="size-4 shrink-0 md:hidden"
                  style={{ color: s.color }}
                />
                <span className="truncate">{s.handle}</span>
              </p>
              <p className="truncate text-[14px] text-white/60 max-md:hidden">
                {s.what}
              </p>
              <div className="relative z-10 flex items-center gap-2 max-md:col-start-2 max-md:row-span-2 max-md:row-start-1">
                <CopyButton
                  social={s}
                  copied={copied === s.label}
                  onCopy={() =>
                    void copy(s.label, s.handle, `${s.label} handle`)
                  }
                />
                <span
                  aria-hidden
                  className="flex size-11 items-center justify-center rounded-full bg-white text-black transition-colors group-hover:bg-[var(--mx-accent)] group-hover:text-[var(--mx-accent-ink)]"
                >
                  <ArrowUpRight className="size-5" />
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// B · Link in bio

/** The whole page is one photo; a stack of glass pills floats over it, thumb-first. */
function LinkInBioDraft() {
  const { copied, copy } = useCopy();
  return (
    <section className="relative overflow-hidden">
      <Media
        src="/home/CAGED 2-95.jpg"
        alt=""
        sizes="100vw"
        className="absolute inset-0"
        priority
      />
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
      <div className="mx-scrim-bottom absolute inset-0" />

      <div className="relative mx-auto flex max-w-[560px] flex-col items-center px-5 pt-28 pb-20 md:pt-36 md:pb-28">
        <h1 className="sr-only">Socials</h1>
        <AtmosLogo className="w-40 md:w-52" />
        <p className="mt-5 text-center text-[16px] text-white/80">{intro}</p>

        <ul className="mt-10 w-full space-y-3">
          {socials.map((s, i) => (
            <li
              key={s.label}
              className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-300"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="mx-glass group relative flex h-16 items-center gap-4 rounded-full pr-2 pl-5 transition-colors hover:bg-white/15">
                <s.Icon
                  className="size-5 shrink-0"
                  style={{ color: s.color }}
                />
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 after:absolute after:inset-0 after:rounded-full"
                >
                  <span className="mx-label block text-[13px]">{s.label}</span>
                  <span className="mt-1.5 block truncate text-[13px] text-white/70">
                    {s.handle}
                  </span>
                </a>
                <div className="relative z-10">
                  <CopyButton
                    social={s}
                    copied={copied === s.label}
                    onCopy={() =>
                      void copy(s.label, s.handle, `${s.label} handle`)
                    }
                    glass
                  />
                </div>
                <ArrowUpRight className="mr-3 size-4 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => void copy("page", pageUrl, "Link")}
          className="mx-label mx-glass mt-8 inline-flex h-11 items-center gap-2 rounded-full px-6 text-[11px] hover:bg-white/15"
        >
          {copied === "page" ? (
            <Check className="size-4" />
          ) : (
            <Share2 className="size-4" />
          )}
          {copied === "page" ? "Link copied" : "Copy page link"}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// C · Wall

/** Hairline tile wall, one tile per platform, Instagram wide. Brand colour appears as a rule on hover. */
function WallDraft() {
  const { copied, copy } = useCopy();
  return (
    <div className="pb-20">
      <PageTitle title="Socials" intro={intro} />
      <ul className="mx-5 grid grid-cols-2 gap-px border border-white/10 bg-white/10 md:mx-10 lg:grid-cols-3">
        {socials.map((s, i) => (
          <li
            key={s.label}
            className={cn(
              "group relative flex min-h-[168px] flex-col bg-black p-4 md:min-h-[260px] md:p-6",
              i === 0 && "col-span-2",
            )}
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 transition-transform duration-300 group-focus-within:scale-x-100 group-hover:scale-x-100"
              style={{ background: s.color }}
            />
            <div className="flex items-start justify-between gap-3">
              <s.Icon
                className={cn(
                  "shrink-0 text-white",
                  i === 0 ? "size-10 md:size-14" : "size-7 md:size-9",
                )}
              />
              <div className="relative z-10">
                <CopyButton
                  social={s}
                  copied={copied === s.label}
                  onCopy={() =>
                    void copy(s.label, s.handle, `${s.label} handle`)
                  }
                />
              </div>
            </div>
            <a
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="mt-auto pt-8 after:absolute after:inset-0"
            >
              <span
                className={cn(
                  "mx-display block break-words",
                  i === 0
                    ? "text-[clamp(2.5rem,7vw,6rem)]"
                    : "text-[clamp(0.9rem,2.6vw,2rem)]",
                )}
              >
                {s.label}
              </span>
              <span className="mt-3 flex items-center justify-between gap-2">
                <span className="mx-label truncate text-[11px] text-white/75">
                  {s.handle}
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-white/60 transition-colors group-hover:text-white" />
              </span>
              {i === 0 ? (
                <span className="mt-3 block max-w-[36ch] text-[14px] text-white/60 max-sm:hidden">
                  {s.what}
                </span>
              ) : null}
            </a>
          </li>
        ))}
        <li className="col-span-2 flex min-h-[168px] flex-col justify-between bg-black p-4 md:min-h-[260px] md:p-6 lg:col-span-1">
          <Share2 className="size-7 text-white/60 md:size-9" />
          <div>
            <p className="mx-display text-[clamp(0.9rem,2.6vw,2rem)]">Share</p>
            <button
              type="button"
              onClick={() => void copy("page", pageUrl, "Link")}
              className="mx-label mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-white/40 px-4 text-[10px] hover:border-white hover:bg-white/5"
            >
              {copied === "page" ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied === "page" ? "Copied" : "Copy link"}
            </button>
          </div>
        </li>
      </ul>
    </div>
  );
}

export const socialsPage: PageSpec = {
  id: "socials",
  title: "Socials",
  route: "/socials",
  nav: "Socials",
  states: [
    {
      id: "default",
      label: "Default",
      hint: "Copy a handle for the copied feedback",
    },
  ],
  drafts: [
    {
      id: "a",
      label: "A · Directory",
      note: "Dense directory rows with handle, what's there, copy and open. Descriptions other than SoundCloud and Spotify are illustrative.",
      Component: DirectoryDraft,
    },
    {
      id: "b",
      label: "B · Link in bio",
      note: "Phone-first stack of glass pills over one gig photo, like a link-in-bio page.",
      Component: LinkInBioDraft,
      heroUnderHeader: true,
    },
    {
      id: "c",
      label: "C · Wall",
      note: "Hairline tile wall with Instagram as the anchor tile; brand colour shows only as a hover rule.",
      Component: WallDraft,
    },
  ],
};
