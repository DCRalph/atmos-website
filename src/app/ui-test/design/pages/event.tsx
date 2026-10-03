"use client";

import { ArrowLeft, CalendarDays, Clock, EyeOff, MapPin } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button, Media } from "../primitives";
import { BuyPanel, type BuyScenario } from "./gigs-buy-panel";
import {
  flagship,
  fmtLong,
  fmtTime,
  moneyExact,
  ticketVariants,
  type TicketEvent,
} from "./gigs-data";
import { Skeleton } from "./gigs-parts";
import type { PageSpec } from "./types";

type Resolved =
  | { kind: "loading" }
  | { kind: "not-found" }
  | {
      kind: "event";
      event: TicketEvent;
      scenario: BuyScenario;
      privateLink: boolean;
    };

/** Maps a board state to the event and buy-panel starting point. */
function resolve(state: string): Resolved {
  switch (state) {
    case "loading":
      return { kind: "loading" };
    case "not-found":
      return { kind: "not-found" };
    case "sold-out":
    case "not-on-sale":
    case "cancelled":
    case "free-approval":
      return {
        kind: "event",
        event: ticketVariants[state],
        scenario: "select",
        privateLink: false,
      };
    case "held":
    case "declined":
    case "paid":
      return {
        kind: "event",
        event: ticketVariants["on-sale"],
        scenario: state,
        privateLink: false,
      };
    case "private":
      return {
        kind: "event",
        event: ticketVariants["on-sale"],
        scenario: "select",
        privateLink: true,
      };
    default:
      return {
        kind: "event",
        event: ticketVariants["on-sale"],
        scenario: "select",
        privateLink: false,
      };
  }
}

function Details({ event }: { event: TicketEvent }) {
  const rows = [
    { Icon: CalendarDays, label: "Date", value: fmtLong(flagship.start) },
    {
      Icon: Clock,
      label: "Time",
      value: event.doorsAt
        ? `Doors ${fmtTime(event.doorsAt)} · Starts ${fmtTime(flagship.start)}`
        : fmtTime(flagship.start),
    },
    {
      Icon: MapPin,
      label: "Venue",
      value: event.venueName,
      sub: event.venueAddress,
    },
  ];
  return (
    <dl className="divide-y divide-white/10 border-y border-white/10">
      {rows.map(({ Icon, label, value, sub }) => (
        <div key={label} className="flex gap-4 py-4">
          <Icon className="mt-0.5 size-4 shrink-0 text-white/50" aria-hidden />
          <div>
            <dt className="sr-only">{label}</dt>
            <dd className="text-[15px] text-white/85">
              {value}
              {sub ? (
                <span className="mt-1 block text-[13px] text-white/55">
                  {sub}
                </span>
              ) : null}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

/** Fees disclosed on the page, not just at payment (as the real page does). */
function FeeNote({ event }: { event: TicketEvent }) {
  if (!event.bookingFee.fixedCents && !event.bookingFee.percentBp) return null;
  return (
    <p className="text-[13px] text-white/50">
      Prices include GST. A booking fee of{" "}
      {moneyExact(event.bookingFee.fixedCents)} per ticket is added at checkout.
    </p>
  );
}

function PrivateNote() {
  return (
    <p className="flex items-start gap-3 rounded-[var(--mx-r-chip)] border border-white/15 px-4 py-3 text-[14px] text-white/70">
      <EyeOff className="mt-0.5 size-4 shrink-0" /> This event isn&apos;t
      listed. You can see it because you have the link, so share it with care.
    </p>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-5 py-24 text-center">
      <p className="mx-display text-[clamp(2.5rem,7vw,5rem)]">
        Event not found
      </p>
      <p className="max-w-[40ch] text-[15px] text-white/60">
        This event might have finished, or the link is wrong.
      </p>
      <Button variant="outline">
        <ArrowLeft className="size-4" /> See what&apos;s on
      </Button>
    </div>
  );
}

function Loading() {
  return (
    <div
      aria-busy
      className="grid gap-10 px-5 py-12 md:px-10 lg:grid-cols-[1fr_400px]"
    >
      <div className="space-y-5">
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="aspect-square max-w-md" />
      </div>
      <Skeleton className="h-80 rounded-[var(--mx-r-panel)] rounded-tl-none" />
    </div>
  );
}

// A · Details + panel

function DraftDetails({ state }: { state: string }) {
  const r = resolve(state);
  if (r.kind === "loading") return <Loading />;
  if (r.kind === "not-found") return <NotFound />;
  const { event, scenario, privateLink } = r;
  return (
    <div className="grid grid-cols-1 gap-10 px-5 pt-10 pb-20 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16 lg:pt-14">
      <div className="min-w-0 space-y-8">
        {privateLink ? <PrivateNote /> : null}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-end">
          <Media
            src={flagship.poster}
            alt={`${flagship.title} poster`}
            sizes="180px"
            className="aspect-square"
          />
          <h1 className="mx-display text-[clamp(2.25rem,5vw,4.5rem)]">
            {flagship.title}
          </h1>
        </div>
        <p className="max-w-[60ch] text-[17px] text-white/70">
          broderbeats brings the Intuition tour home to San Fran for the third
          volume.
        </p>
        <Details event={event} />
        <div className="max-w-[62ch] space-y-4 text-[16px] leading-relaxed text-white/70">
          {flagship.description?.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <a
          href="#"
          className="inline-block text-[14px] text-white/60 underline underline-offset-4 hover:text-white"
        >
          More about this gig
        </a>
        <FeeNote event={event} />
      </div>
      <div className="lg:sticky lg:top-8 lg:self-start">
        <BuyPanel key={state} event={event} scenario={scenario} />
      </div>
    </div>
  );
}

// B · Ticket first

/** Phone-first: the buy panel is the page; details fold under it. */
function DraftTicketFirst({ state }: { state: string }) {
  const r = resolve(state);
  if (r.kind === "loading") return <Loading />;
  if (r.kind === "not-found") return <NotFound />;
  const { event, scenario, privateLink } = r;
  return (
    <div className="mx-auto max-w-[1100px] px-5 pt-8 pb-20 md:px-10">
      {privateLink ? (
        <div className="mb-6">
          <PrivateNote />
        </div>
      ) : null}
      <header className="flex items-center gap-5 border-b border-white/10 pb-6">
        <Media
          src={flagship.poster}
          alt=""
          sizes="96px"
          className="aspect-square w-20 shrink-0 md:w-24"
        />
        <div className="min-w-0">
          <p className="mx-label text-[11px] text-white/60">
            {fmtLong(flagship.start)}
          </p>
          <h1 className="mx-display mt-2 truncate text-[clamp(1.5rem,4vw,2.75rem)]">
            {flagship.title}
          </h1>
          <p className="mt-1.5 text-[14px] text-white/60">
            {event.venueName} · Doors{" "}
            {event.doorsAt ? fmtTime(event.doorsAt) : fmtTime(flagship.start)}
          </p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-10 pt-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <BuyPanel
          key={state}
          event={event}
          scenario={scenario}
          className={cn("md:order-2")}
        />
        <div className="space-y-8 md:order-1">
          <Details event={event} />
          <div className="max-w-[60ch] space-y-4 text-[15px] leading-relaxed text-white/70">
            {flagship.description?.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <FeeNote event={event} />
        </div>
      </div>
    </div>
  );
}

export const eventPage: PageSpec = {
  id: "event",
  title: "Event page",
  route: "/events/[slug]",
  states: [
    {
      id: "on-sale",
      label: "On sale",
      hint: "Try ATMOS10, then tick the terms to hold and pay.",
    },
    { id: "held", label: "Checkout: held" },
    { id: "declined", label: "Card declined" },
    { id: "paid", label: "Paid" },
    { id: "sold-out", label: "Sold out" },
    { id: "not-on-sale", label: "Not on sale yet" },
    { id: "cancelled", label: "Cancelled" },
    { id: "free-approval", label: "Free, approval" },
    {
      id: "private",
      label: "Private link",
      hint: "Unlisted event opened from its share link.",
    },
    { id: "loading", label: "Loading" },
    { id: "not-found", label: "Not found" },
  ],
  drafts: [
    {
      id: "a",
      label: "A · Details + panel",
      note: "Poster, facts and description on the left; the buy panel sticks on the right.",
      Component: DraftDetails,
    },
    {
      id: "b",
      label: "B · Ticket first",
      note: "Compact header, then the buy panel leads. Built for people arriving from a phone link.",
      Component: DraftTicketFirst,
    },
  ],
};
