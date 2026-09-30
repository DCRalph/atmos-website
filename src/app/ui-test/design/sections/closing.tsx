"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Radio, X } from "lucide-react";
import {
  FaInstagram,
  FaSoundcloud,
  FaSpotify,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import { cn } from "~/lib/utils";
import { CONTACT } from "~/lib/site-constants";
import { navLinks, photos, upcomingGigs } from "../fixtures";
import { GlassDialog } from "../overlays";
import {
  AtmosLogo,
  Button,
  IconButton,
  Media,
  VariantTag,
} from "../primitives";

/** Inline signup: validates on submit, swaps to a confirmed state. */
function EmailForm({
  className,
  onDone,
}: {
  className?: string;
  onDone?: () => void;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "error" | "sending" | "done">(
    "idle",
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setState("error");
    setState("sending");
    setTimeout(() => {
      setState("done");
      onDone?.();
    }, 900);
  };

  if (state === "done") {
    return (
      <div
        role="status"
        className={cn(
          "flex h-14 items-center gap-3 rounded-full border border-white/25 bg-black/30 px-2 pr-6",
          className,
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]">
          <Check className="size-5" />
        </span>
        <p className="min-w-0 truncate text-[15px]">
          You&apos;re in. Check {email} to confirm.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <form
        noValidate
        onSubmit={submit}
        className={cn(
          "flex h-14 items-center rounded-full border bg-black/30 p-1.5 pl-6 focus-within:border-white/70",
          state === "error" ? "border-[#ff6b6b]" : "border-white/25",
        )}
      >
        <label className="sr-only" htmlFor={id}>
          Email
        </label>
        <input
          id={id}
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          aria-invalid={state === "error"}
          aria-describedby={state === "error" ? `${id}-err` : undefined}
          placeholder="Email address"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/50"
        />
        <Button
          type="submit"
          className="h-full"
          disabled={state === "sending"}
          aria-busy={state === "sending"}
        >
          {state === "sending" ? "Joining…" : "Subscribe"}
        </Button>
      </form>
      {state === "error" ? (
        <p id={`${id}-err`} className="mt-2 pl-6 text-[13px] text-[#ff8a8a]">
          That email doesn&apos;t look right.
        </p>
      ) : null}
    </div>
  );
}

function NewsletterInline() {
  return (
    <div className="grid grid-cols-1 gap-10 px-5 py-6 md:px-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
      <h3 className="mx-display text-[clamp(2.1rem,8.5vw,6rem)]">
        Join the{" "}
        <span className="text-[var(--mx-accent-text)]">atmosphere</span>
      </h3>
      <div className="space-y-4">
        <p className="max-w-[44ch] text-[15px] text-white/70">
          Gigs, mixes and merch drops, straight to your inbox. First access to
          tickets before they go public.
        </p>
        <EmailForm />
        <p className="text-[12px] text-white/50">Unsubscribe any time.</p>
      </div>
    </div>
  );
}

/** The popup as a real modal. Used from the Overlays section too. */
export function NewsletterDialogTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <GlassDialog
      open={open}
      onOpenChange={setOpen}
      title="Join the atmosphere"
      description="Gigs, mixes and merch drops, straight to your inbox."
      trigger={<Button variant="outline">Open popup</Button>}
    >
      <div className="p-5">
        <EmailForm onDone={() => setTimeout(() => setOpen(false), 1600)} />
      </div>
    </GlassDialog>
  );
}

function NewsletterPopup() {
  return (
    <div className="relative flex min-h-[520px] flex-col items-center justify-center gap-6 overflow-hidden p-5">
      <Media
        src={photos.booth}
        alt=""
        sizes="100vw"
        className="absolute inset-0 opacity-70"
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="mx-glass-dark mx-float relative w-full max-w-[560px] rounded-[var(--mx-r-panel)] rounded-tl-none p-7 md:p-9">
        <IconButton label="Close" className="absolute top-4 right-4 size-10">
          <X className="size-4" />
        </IconButton>
        <h3 className="mx-display pr-12 text-[clamp(1.9rem,7vw,2.6rem)]">
          Join the{" "}
          <span className="text-[var(--mx-accent-text)]">atmosphere</span>
        </h3>
        <p className="mt-4 max-w-[40ch] text-[15px] text-white/70">
          Gigs, mixes and merch drops, straight to your inbox.
        </p>
        <EmailForm className="mt-7" />
      </div>
      <div className="relative">
        <NewsletterDialogTrigger />
      </div>
    </div>
  );
}

/** Live gig popup: bottom corner card while a gig is on. Dismiss hides it. */
function LivePopup() {
  const gig = upcomingGigs[0];
  const [shown, setShown] = useState(true);
  return (
    <div className="relative min-h-[220px] overflow-hidden">
      <Media
        src={photos.caged}
        alt=""
        sizes="100vw"
        className="absolute inset-0 opacity-50"
      />
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative flex min-h-[220px] items-end p-5 md:p-10">
        {shown ? (
          <div className="mx-glass-dark mx-float animate-in fade-in-0 slide-in-from-bottom-2 relative flex w-full max-w-[420px] items-center gap-4 rounded-[var(--mx-r-panel)] rounded-bl-none p-3 duration-300">
            <Media
              src={gig.poster}
              alt=""
              sizes="64px"
              className="aspect-[4/5] w-16"
            />
            <a href="#" className="min-w-0 flex-1 after:absolute after:inset-0">
              <p className="mx-label flex items-center gap-1.5 text-[10px] text-[var(--mx-accent-text)]">
                <Radio className="size-3.5" /> Live now
              </p>
              <p className="mx-display mt-1.5 truncate text-lg">
                {gig.headline}
              </p>
              <p className="mt-1 truncate text-[13px] text-white/60">
                {gig.venue} · Doors till 1am
              </p>
            </a>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-black">
              <ArrowUpRight className="size-4" />
            </span>
            <button
              type="button"
              aria-label="Hide live banner"
              onClick={() => setShown(false)}
              className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <Button variant="glass" onClick={() => setShown(true)}>
            Show live popup again
          </Button>
        )}
      </div>
    </div>
  );
}

const socials = [
  { label: "Instagram", Icon: FaInstagram },
  { label: "TikTok", Icon: FaTiktok },
  { label: "YouTube", Icon: FaYoutube },
  { label: "SoundCloud", Icon: FaSoundcloud },
  { label: "Spotify", Icon: FaSpotify },
];

/** Site footer, shared by the board and every page frame. */
export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="grid gap-10 px-5 py-12 md:px-10 lg:grid-cols-[1fr_auto]">
        <div>
          <AtmosLogo className="w-40" />
          <p className="mt-5 max-w-[36ch] text-[14px] text-white/60">
            Immersive electronic music events in Pōneke, Wellington.
          </p>
          <div className="mt-6 flex gap-1">
            {socials.map(({ label, Icon }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="flex size-11 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon className="size-[18px]" />
              </a>
            ))}
          </div>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-12 gap-y-4 sm:grid-cols-3">
            {[...navLinks, "Equipment", "About", "Tickets help"].map((l) => (
              <li key={l}>
                <a
                  href="#"
                  className="mx-label text-[12px] text-white/75 hover:text-white"
                >
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 px-5 py-5 text-[12px] text-white/50 md:px-10">
        <p>© 2026 ATMOS</p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white">
            Terms
          </a>
          <a href="#" className="hover:text-white">
            Privacy
          </a>
          <a href={`mailto:${CONTACT.email}`} className="hover:text-white">
            {CONTACT.email}
          </a>
        </div>
      </div>
      {/* Oversized logo sign-off, cropped by the page edge. */}
      <div
        aria-hidden
        className="h-[clamp(4rem,14vw,13rem)] overflow-hidden px-5 opacity-[0.07] select-none md:px-10"
      >
        <AtmosLogo className="w-full" />
      </div>
    </footer>
  );
}

export function ClosingSection() {
  return (
    <div className="space-y-14">
      <div>
        <VariantTag>Newsletter · inline</VariantTag>
        <NewsletterInline />
      </div>
      <div>
        <VariantTag>Newsletter · popup</VariantTag>
        <NewsletterPopup />
      </div>
      <div>
        <VariantTag>Live gig popup · dismissible</VariantTag>
        <LivePopup />
      </div>
      <div>
        <VariantTag>Footer</VariantTag>
        <Footer />
      </div>
    </div>
  );
}
