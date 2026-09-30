"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { toast } from "sonner";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { ContactForm } from "~/components/site/contact/contact-form";
import { CONTACT, SOCIALS } from "~/lib/site-constants";

/** Copies a phone number or email, confirming with a toast and a brief tick. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy. Select it and copy instead.");
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy ${label.toLowerCase()}`}
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/40 hover:text-white"
    >
      {copied ? (
        <Check className="size-4 text-[var(--site-accent-text)]" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

const lines = [
  {
    type: "instagram",
    value: SOCIALS.instagram.handle,
    meta: "Instagram DM · Quickest reply",
    href: SOCIALS.instagram.href,
    external: true,
    copy: "Instagram handle",
  },
  {
    type: "phone",
    value: CONTACT.phone,
    meta: `${CONTACT.name} · Phone · Professional enquiries`,
    href: CONTACT.phoneHref,
    copy: "Phone",
  },
  {
    type: "email",
    value: CONTACT.email,
    meta: `${CONTACT.name} · Email · Agencies, promoters, brands, venues`,
    href: `mailto:${CONTACT.email}`,
    copy: "Email",
  },
] as const satisfies readonly {
  type: string;
  value: string;
  meta: string;
  href: string;
  external?: true;
  copy: string;
}[];

/** Shared href, new-tab handling and analytics for a contact line's links. */
const linkProps = (l: (typeof lines)[number]) => ({
  href: l.href,
  ...("external" in l ? { target: "_blank", rel: "noopener noreferrer" } : {}),
  onClick: () => posthog.capture("contact_link_clicked", { type: l.type }),
});

/** Contact as a poster: the details are huge tappable lines, then the form. Held to a centred column on wide screens. */
export default function ContactPage() {
  return (
    <main className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 px-5 pt-12 pb-10 md:px-10 md:pt-20 md:pb-14">
        <h1 className="t-heading text-[clamp(2.75rem,9vw,5.5rem)]">
          Hit us up
        </h1>
        <p className="max-w-[36ch] text-[16px] text-white/70 md:pb-2 md:text-[17px]">
          Bookings, collabs, questions. Send us a message.
        </p>
      </div>

      <ul className="border-t border-white/10">
        {lines.map((l) => (
          <li
            key={l.type}
            className="flex items-center gap-3 border-b border-white/10 px-5 py-6 md:gap-5 md:px-10 md:py-8"
          >
            <a {...linkProps(l)} className="group @container min-w-0 flex-1">
              <span className="t-display block text-[min(5.2cqw,3.25rem)] tabular-nums transition-colors group-hover:text-[var(--site-accent-text)]">
                {l.value}
              </span>
              <span className="mt-3 block text-[13px] text-white/60 md:text-[14px]">
                {l.meta}
              </span>
            </a>
            {/* Copy first, then open: open is the louder action and ends the row. */}
            <CopyButton value={l.value} label={l.copy} />
            <a
              {...linkProps(l)}
              aria-label={`Open ${l.copy.toLowerCase()}`}
              className="hidden size-12 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform hover:translate-x-0.5 hover:-translate-y-0.5 md:flex"
            >
              <ArrowUpRight className="size-5" />
            </a>
          </li>
        ))}
      </ul>

      <section className="grid gap-8 px-5 py-16 md:px-10 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:gap-12">
        <h2 className="t-heading text-[clamp(1.75rem,4vw,2.75rem)]">
          Drop us a line
        </h2>
        <ContactForm />
      </section>
    </main>
  );
}
