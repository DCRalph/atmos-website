"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CalendarX2,
  Check,
  Info,
  Search,
  Ticket,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useBoard } from "../board-state";
import { pastGigs, upcomingGigs, formatDay } from "../fixtures";
import { Button, Media, VariantTag } from "../primitives";
import { inputClass } from "./checkout";

const banners = [
  {
    id: "info",
    tone: "info",
    Icon: Info,
    title: "Doors moved to 9:30pm",
    body: "San Fran asked for a later start. Your ticket still works.",
  },
  {
    id: "success",
    tone: "success",
    Icon: Check,
    title: "Tickets transferred",
    body: "Your mate has an email with their new QR code.",
  },
  {
    id: "warn",
    tone: "warn",
    Icon: AlertTriangle,
    title: "Final release is nearly gone",
    body: "Fewer than 20 left. Door sales aren't guaranteed.",
  },
  {
    id: "error",
    tone: "error",
    Icon: X,
    title: "We couldn't load your tickets",
    body: "Check your connection, then try again.",
  },
] as const;

const toneClass = {
  info: "border-white/20 [&_svg]:text-white",
  success: "border-[var(--mx-accent)]/60 [&_svg]:text-[var(--mx-accent-text)]",
  warn: "border-[#ffcc4d]/50 [&_svg]:text-[#ffcc4d]",
  error: "border-[#ff6b6b]/50 [&_svg]:text-[#ff8a8a]",
};

function Banners() {
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = banners.filter((b) => !hidden.includes(b.id));
  return (
    <div className="space-y-3">
      {visible.map(({ id, tone, Icon, title, body }) => (
        <div
          key={id}
          role={tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-start gap-4 rounded-[var(--mx-r-chip)] border bg-white/[0.03] p-4",
            toneClass[tone],
          )}
        >
          <Icon className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="mx-label text-[12px]">{title}</p>
            <p className="mt-1.5 text-[14px] text-white/70">{body}</p>
            {tone === "error" ? (
              <Button size="sm" variant="outline" className="mt-3">
                Try again
              </Button>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={`Dismiss: ${title}`}
            onClick={() => setHidden((h) => [...h, id])}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/55 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      {hidden.length ? (
        <Button variant="ghost" size="sm" onClick={() => setHidden([])}>
          Restore {hidden.length} dismissed
        </Button>
      ) : null}
    </div>
  );
}

/** Static skeleton: no shimmer, just the shape of what's coming. */
function SkeletonCard() {
  return (
    <div aria-hidden className="space-y-3">
      <div className="aspect-[4/5] bg-white/[0.06]" />
      <div className="h-5 w-3/4 rounded-full bg-white/[0.08]" />
      <div className="h-3.5 w-1/2 rounded-full bg-white/[0.05]" />
    </div>
  );
}

function LoadingToggle() {
  const [loading, setLoading] = useState(true);
  const gigs = pastGigs.slice(0, 3);
  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Button
          size="sm"
          variant={loading ? "solid" : "outline"}
          onClick={() => setLoading(true)}
        >
          Loading
        </Button>
        <Button
          size="sm"
          variant={loading ? "outline" : "solid"}
          onClick={() => setLoading(false)}
        >
          Loaded
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-3 *:min-w-0" aria-busy={loading}>
        {loading
          ? gigs.map((g) => <SkeletonCard key={g.slug} />)
          : gigs.map((g) => (
              <div
                key={g.slug}
                className="animate-in fade-in-0 space-y-3 duration-300"
              >
                <Media
                  src={g.poster}
                  alt={`${g.title} poster`}
                  sizes="200px"
                  className="aspect-[4/5]"
                />
                <p className="mx-display truncate text-sm">{g.headline}</p>
                <p className="mx-label text-[9px] text-white/55">
                  {formatDay(g.date).slice(4)}
                </p>
              </div>
            ))}
      </div>
    </div>
  );
}

function EmptyStates() {
  return (
    <div className="grid gap-px bg-white/10 sm:grid-cols-3">
      {[
        {
          Icon: Search,
          title: "No gigs match",
          body: "Nothing for “jungle” at Meow. Try another venue.",
          action: "Clear filters",
        },
        {
          Icon: Ticket,
          title: "No tickets yet",
          body: "Tickets you buy show up here and in your email.",
          action: "See upcoming gigs",
        },
        {
          Icon: CalendarX2,
          title: "Nothing announced",
          body: "We're booking the next one. Get told first.",
          action: "Join the list",
        },
      ].map(({ Icon, title, body, action }) => (
        <div
          key={title}
          className="flex flex-col items-center gap-4 bg-black px-6 py-10 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full border border-white/15">
            <Icon className="size-5 text-white/60" />
          </span>
          <p className="mx-display text-xl">{title}</p>
          <p className="max-w-[28ch] text-[14px] text-white/60">{body}</p>
          <Button variant="outline" size="sm">
            {action}
          </Button>
        </div>
      ))}
    </div>
  );
}

function Waitlist() {
  const { toast } = useBoard();
  const gig = upcomingGigs[0];
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError(true);
    setJoined(true);
    toast({ title: "You're on the waitlist", tone: "success" });
  };
  return (
    <div className="grid overflow-hidden border border-white/10 sm:grid-cols-[160px_1fr]">
      <div className="relative">
        <Media
          src={gig.poster}
          alt=""
          sizes="160px"
          className="aspect-[4/5] h-full grayscale"
        />
        <span className="mx-label absolute top-3 left-3 rounded-[var(--mx-r-chip)] bg-white px-2 py-1.5 text-[10px] text-black">
          Sold out
        </span>
      </div>
      <div className="flex flex-col gap-4 p-6">
        <p className="mx-display text-2xl">{gig.headline}</p>
        <div>
          <div className="mb-2 flex justify-between text-[13px] text-white/60">
            <span>Capacity</span>
            <span className="mx-num">400 / 400</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-full bg-white/70" />
          </div>
        </div>
        {joined ? (
          <p role="status" className="flex items-center gap-2 text-[15px]">
            <Check className="size-4 text-[var(--mx-accent-text)]" /> We&apos;ll
            email {email} if tickets come back.
          </p>
        ) : (
          <form
            onSubmit={submit}
            noValidate
            className="flex flex-col gap-2 sm:flex-row"
          >
            <label htmlFor="wl-email" className="sr-only">
              Email
            </label>
            <input
              id="wl-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(false);
              }}
              aria-invalid={error}
              className={inputClass}
              placeholder="Email for returns"
            />
            <Button type="submit" variant="accent" className="h-12">
              Join waitlist
            </Button>
          </form>
        )}
        {error ? (
          <p className="-mt-2 pl-5 text-[13px] text-[#ff8a8a]">
            Enter an email we can reach you on.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function FeedbackSection() {
  return (
    <div className="grid gap-14 px-5 pb-16 md:px-10 lg:grid-cols-2">
      <div>
        <VariantTag className="px-0 md:px-0">
          Banners · dismiss and restore
        </VariantTag>
        <Banners />
      </div>
      <div>
        <VariantTag className="px-0 md:px-0">
          Loading · static skeleton, no shimmer
        </VariantTag>
        <LoadingToggle />
      </div>
      <div className="lg:col-span-2">
        <VariantTag className="px-0 md:px-0">Empty states</VariantTag>
        <EmptyStates />
      </div>
      <div className="lg:col-span-2">
        <VariantTag className="px-0 md:px-0">Sold out · waitlist</VariantTag>
        <Waitlist />
      </div>
    </div>
  );
}
