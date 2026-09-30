"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { toast } from "sonner";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import {
  FaFacebook,
  FaInstagram,
  FaSoundcloud,
  FaSpotify,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { PageTitle } from "~/components/site/ui";
import { SOCIALS, type SocialKey } from "~/lib/site-constants";
import { cn } from "~/lib/utils";

/** Profile URLs by platform. Kept as the existing import point; the data lives in site-constants. */
export const links = Object.fromEntries(
  Object.entries(SOCIALS).map(([key, { href }]) => [key, href]),
) as {
  [K in SocialKey]: (typeof SOCIALS)[K]["href"];
};

/** Directory rows in display order. Brand colour only tints the icon. */
const directory = [
  {
    ...SOCIALS.instagram,
    Icon: FaInstagram,
    color: "#E1306C",
    what: "Gig announcements, posters and photos",
  },
  {
    ...SOCIALS.tiktok,
    Icon: FaTiktok,
    color: "#00F2EA",
    what: "Clips from the floor",
  },
  {
    ...SOCIALS.youtube,
    Icon: FaYoutube,
    color: "#FF0000",
    what: "Sets and videos",
  },
  {
    ...SOCIALS.soundcloud,
    Icon: FaSoundcloud,
    color: "#FF5500",
    what: "Atmos Radio and Atmos Selects",
  },
  {
    ...SOCIALS.spotify,
    Icon: FaSpotify,
    color: "#1DB954",
    what: "Atmos Selects, updated weekly",
  },
  {
    ...SOCIALS.facebook,
    Icon: FaFacebook,
    color: "#1877F2",
    what: "Events and updates",
  },
  { ...SOCIALS.twitter, Icon: FaXTwitter, color: "#FFFFFF", what: "Updates" },
];

/** Copies a handle, confirms with a toast, and flags which row to tick for two seconds. */
function useCopiedHandle() {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = async (label: string, handle: string) => {
    try {
      await navigator.clipboard.writeText(handle);
      setCopied(label);
      toast.success(`${label} handle copied`);
    } catch {
      toast.error("Couldn't copy. Long-press the link instead.");
    }
  };
  return { copied, copy };
}

/** Socials directory: one row per platform with handle, what's there, copy and open. */
export default function SocialsPage() {
  const { copied, copy } = useCopiedHandle();
  return (
    <main className="pb-20">
      <PageTitle
        title="Socials"
        intro="Gig drops, sets and clips. Pick your platform."
      />
      <ul className="mx-5 border-t border-white/10 md:mx-10">
        {directory.map((s) => (
          <li key={s.label} className="group relative border-b border-white/10">
            <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 py-5 md:grid-cols-[64px_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] md:gap-x-6 md:py-6">
              <s.Icon
                className="size-8 max-md:row-span-2 md:size-12"
                style={{ color: s.color }}
                aria-hidden
              />
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  posthog.capture("social_link_clicked", {
                    platform: s.label.toUpperCase(),
                  })
                }
                className="min-w-0 after:absolute after:inset-0"
              >
                <span className="t-display block truncate text-[clamp(1.1rem,5.2vw,3rem)] leading-[1.05] md:text-[clamp(1.25rem,3.6vw,3rem)]">
                  {s.label}
                </span>
              </a>
              <p className="t-label flex min-w-0 items-center gap-2 text-[12px] text-white/85 max-md:col-start-2 max-md:row-start-2">
                <span className="truncate">{s.handle}</span>
              </p>
              <p className="truncate text-[14px] text-white/60 max-md:hidden">
                {s.what}
              </p>
              <div className="pointer-events-none relative z-10 flex items-center gap-2 max-md:col-start-3 max-md:row-span-2 max-md:row-start-1">
                <button
                  type="button"
                  onClick={() => void copy(s.label, s.handle)}
                  aria-label={
                    copied === s.label
                      ? `${s.label} handle copied`
                      : `Copy ${s.label} handle ${s.handle}`
                  }
                  className={cn(
                    "pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors",
                    copied === s.label
                      ? "border-transparent bg-[var(--site-accent)] text-[var(--site-accent-ink)]"
                      : "border-white/20 text-white/75 hover:border-white hover:text-white",
                  )}
                >
                  {copied === s.label ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
                <span
                  aria-hidden
                  className="flex size-11 items-center justify-center rounded-full bg-white text-black transition-colors group-hover:bg-[var(--site-accent)] group-hover:text-[var(--site-accent-ink)]"
                >
                  <ArrowUpRight className="size-5" />
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
