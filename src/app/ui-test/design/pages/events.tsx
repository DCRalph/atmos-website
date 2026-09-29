"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { pastGigs } from "../fixtures";
import { Media } from "../primitives";
import { PageTitle } from "./chrome";
import {
  flagship,
  fmtDay,
  fmtTime,
  fromPrice,
  money,
  ticketVariants,
  upcomingList,
  type TicketEvent,
} from "./gigs-data";
import { Skeleton } from "./gigs-parts";
import type { PageSpec } from "./types";

/** A ticketed event as the /events list sees it (TicketEvent + display fields). */
type EventRow = {
  id: string;
  name: string;
  start: Date;
  poster: string;
  blurb: string;
  event: TicketEvent;
};

const caged = pastGigs[6];
const rows: EventRow[] = [
  {
    id: "e1",
    name: flagship.title,
    start: flagship.start,
    poster: flagship.poster,
    blurb: "The Intuition tour comes home to San Fran.",
    event: ticketVariants["on-sale"],
  },
  {
    id: "e2",
    name: "FOVOS",
    start: upcomingList[1]!.start,
    poster: upcomingList[1]!.poster,
    blurb: "House all night at Meow.",
    event: { ...ticketVariants["sold-out"], venueName: "Meow" },
  },
  {
    id: "e3",
    name: "Daffodil Dancefloor",
    start: upcomingList[2]!.start,
    poster: upcomingList[2]!.poster,
    blurb: "Day party, free with an approved request.",
    event: { ...ticketVariants["free-approval"], isR18: false },
  },
  {
    id: "e4",
    name: "Caged V3",
    start: new Date("2026-12-12T21:00:00+13:00"),
    poster: caged.poster,
    blurb: "The cage is back.",
    event: {
      ...ticketVariants["not-on-sale"],
      venueName: "Pōneke",
      salesOpenAt: new Date("2026-11-01T12:00:00+13:00"),
    },
  },
];

/** Status pill, following the real `StatusPill`. */
function Status({ event }: { event: TicketEvent }) {
  if (event.status === "SOLD_OUT")
    return (
      <span className="mx-label rounded-full border border-white/20 px-3 py-2 text-[10px] text-white/60">
        Sold out
      </span>
    );
  if (event.status !== "ON_SALE") {
    return (
      <span className="mx-label rounded-full border border-white/20 px-3 py-2 text-[10px] text-white/60">
        {event.salesOpenAt
          ? `On sale ${fmtDay(event.salesOpenAt).slice(4)}`
          : "Not on sale"}
      </span>
    );
  }
  const from = fromPrice(event);
  return (
    <span className="mx-label rounded-full bg-white px-3 py-2 text-[10px] text-black transition-colors group-hover:bg-[var(--mx-accent)] group-hover:text-[var(--mx-accent-ink)]">
      {from === 0 ? "Free" : `From ${money(from ?? 0)}`}
    </span>
  );
}

function Empty() {
  return (
    <p className="border border-white/10 px-6 py-16 text-center text-[15px] text-white/60">
      Nothing on sale at the moment. Check back soon.
    </p>
  );
}

// A · Rows

function DraftRows({ state }: { state: string }) {
  return (
    <>
      <PageTitle title="Tickets" intro="Everything on sale right now." />
      <div className="space-y-3 px-5 pb-20 md:px-10">
        {state === "loading" ? (
          Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))
        ) : state === "empty" ? (
          <Empty />
        ) : (
          rows.map((r) => (
            <a
              key={r.id}
              href="#"
              className="group grid gap-5 border border-white/10 p-4 transition-colors hover:border-white/25 sm:grid-cols-[160px_1fr] md:grid-cols-[200px_1fr_auto] md:items-center md:gap-8"
            >
              <Media
                src={r.poster}
                alt=""
                sizes="200px"
                className={cn(
                  "aspect-square",
                  r.event.status === "SOLD_OUT" && "opacity-60 grayscale",
                )}
              />
              <div className="min-w-0">
                <p className="mx-label text-[11px] text-white/60">
                  {fmtDay(r.start)} · {fmtTime(r.start)}
                </p>
                <h2 className="mx-display mt-3 text-[clamp(1.5rem,3vw,2.25rem)]">
                  {r.name}
                </h2>
                <p className="mt-2 text-[14px] text-white/65">
                  {r.event.venueName} · {r.blurb}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 md:hidden">
                  <Status event={r.event} />
                  {r.event.isR18 ? (
                    <span className="mx-label rounded-[var(--mx-r-chip)] border border-white/20 px-2 py-1 text-[9px] text-white/60">
                      R18
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="hidden flex-col items-end gap-3 md:flex">
                <Status event={r.event} />
                {r.event.isR18 ? (
                  <span className="mx-label rounded-[var(--mx-r-chip)] border border-white/20 px-2 py-1 text-[9px] text-white/60">
                    R18
                  </span>
                ) : null}
              </div>
            </a>
          ))
        )}
      </div>
    </>
  );
}

// B · Board

/** Departure-board list: date, name, price. The poster only appears on hover. */
function DraftBoard({ state }: { state: string }) {
  return (
    <div className="px-5 pb-20 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4 pt-12 pb-10 md:pt-20">
        <h1 className="mx-display text-[clamp(3rem,11vw,9rem)] leading-[0.85]">
          Tickets
        </h1>
        <p className="max-w-[30ch] text-[15px] text-white/60">
          Everything on sale right now. Prices include GST; a booking fee is
          added at checkout.
        </p>
      </div>
      {state === "loading" ? (
        <div aria-busy className="border-t border-white/15">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="border-b border-white/15 py-7">
              <Skeleton className="h-8 w-2/3" />
            </div>
          ))}
        </div>
      ) : state === "empty" ? (
        <Empty />
      ) : (
        <ol className="border-t border-white/15">
          {rows.map((r) => (
            <li key={r.id}>
              <a
                href="#"
                className="group relative grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 border-b border-white/15 py-6 md:grid-cols-[170px_1fr_auto_auto]"
              >
                <p className="mx-label text-[12px] text-white/60 md:text-[13px]">
                  {fmtDay(r.start)}
                </p>
                <p
                  className={cn(
                    "mx-display col-span-2 text-[clamp(1.5rem,4vw,3rem)] leading-[0.95] transition-colors group-hover:text-[var(--mx-accent-text)] md:col-span-1",
                    r.event.status === "SOLD_OUT" &&
                      "text-white/45 line-through decoration-2",
                  )}
                >
                  {r.name}
                </p>
                <p className="hidden text-[14px] text-white/60 md:block">
                  {r.event.venueName}
                </p>
                <div className="col-start-2 row-start-1 md:col-start-auto md:row-start-auto">
                  <Status event={r.event} />
                </div>
                <div className="pointer-events-none absolute top-1/2 right-48 hidden w-40 -translate-y-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 xl:block">
                  <Media
                    src={r.poster}
                    alt=""
                    sizes="160px"
                    className="aspect-square"
                  />
                </div>
              </a>
            </li>
          ))}
        </ol>
      )}
      {state === "loaded" ? (
        <a
          href="#"
          className="mx-label mt-8 inline-flex items-center gap-2 text-[11px] text-white/65 hover:text-white"
        >
          All gigs, including ones without tickets{" "}
          <ArrowRight className="size-4" />
        </a>
      ) : null}
    </div>
  );
}

export const eventsPage: PageSpec = {
  id: "events",
  title: "Tickets",
  route: "/events",
  states: [
    {
      id: "loaded",
      label: "Loaded",
      hint: "On sale, sold out, free and not-yet-on-sale events together.",
    },
    { id: "loading", label: "Loading" },
    { id: "empty", label: "Nothing on sale" },
  ],
  drafts: [
    {
      id: "a",
      label: "A · Rows",
      note: "Poster, date, venue and a price pill per event. Closest to today's page, in the new system.",
      Component: DraftRows,
    },
    {
      id: "b",
      label: "B · Board",
      note: "Departure-board list led by the name; posters appear on hover on wide screens.",
      Component: DraftBoard,
    },
  ],
};
