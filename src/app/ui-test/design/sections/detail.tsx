"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CalendarPlus,
  ChevronDown,
  Clock,
  Expand,
  MapPin,
  Minus,
  Plus,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useBoard } from "../board-state";
import {
  formatDay,
  formatTime,
  gigFaq,
  lineup,
  ticketTiers,
  upcomingGigs,
} from "../fixtures";
import { GlassDialog, Lightbox, useLightbox } from "../overlays";
import { Button, Media, VariantTag } from "../primitives";
import { CheckoutFlow } from "./checkout";
import { SharePopover } from "./overlays-demo";

const gig = upcomingGigs[0];

function TicketPanel() {
  const [qty, setQty] = useState<Record<string, number>>({ General: 2 });
  const total = ticketTiers.reduce(
    (sum, t) => sum + (qty[t.name] ?? 0) * t.price,
    0,
  );
  const count = Object.values(qty).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-glass-dark rounded-[var(--mx-r-panel)] rounded-tl-none">
      <h3 className="mx-label border-b border-white/10 px-5 py-4 text-[12px]">
        Tickets
      </h3>
      <ul>
        {ticketTiers.map((t) => {
          const n = qty[t.name] ?? 0;
          const available = t.state === "on-sale";
          return (
            <li
              key={t.name}
              className="flex items-center gap-4 border-b border-white/10 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "mx-display text-base",
                    !available && "text-white/45",
                  )}
                >
                  {t.name}
                </p>
                <p className="mt-1.5 text-[13px] text-white/60">
                  ${t.price}{" "}
                  {t.state === "sold-out"
                    ? "· Sold out"
                    : t.state === "upcoming"
                      ? "· Opens when General sells out"
                      : "+ fees"}
                </p>
              </div>
              {available ? (
                <div className="inline-flex h-10 items-center rounded-full border border-white/20">
                  <button
                    type="button"
                    aria-label={`Fewer ${t.name}`}
                    disabled={n === 0}
                    onClick={() => setQty((q) => ({ ...q, [t.name]: n - 1 }))}
                    className="flex size-10 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span
                    className="mx-display mx-num w-5 text-center"
                    aria-live="polite"
                  >
                    {n}
                  </span>
                  <button
                    type="button"
                    aria-label={`More ${t.name}`}
                    disabled={n >= 8}
                    onClick={() => setQty((q) => ({ ...q, [t.name]: n + 1 }))}
                    className="flex size-10 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[13px] text-white/60">
            {count} {count === 1 ? "ticket" : "tickets"}
          </p>
          <p className="mx-display mx-num mt-1 text-2xl">${total}</p>
        </div>
        <GlassDialog
          title="Get tickets"
          description={`${gig.headline} · ${formatDay(gig.date)}`}
          trigger={
            <Button variant="accent" size="lg" disabled={count === 0}>
              Checkout
            </Button>
          }
          className="max-w-[560px] overflow-y-auto"
        >
          <CheckoutFlow initialQty={qty} initialStep="Details" compact />
        </GlassDialog>
      </div>
    </div>
  );
}

function PosterButton() {
  const lb = useLightbox();
  const images = [{ src: gig.poster, alt: `${gig.title} poster` }];
  return (
    <>
      <button
        type="button"
        onClick={() => lb.open(0)}
        aria-label="View poster full screen"
        className="group relative block w-full max-w-[420px]"
      >
        <Media
          src={gig.poster}
          alt={`${gig.title} poster`}
          sizes="420px"
          className="aspect-[4/5] w-full"
          priority
        />
        <span className="mx-glass absolute right-3 bottom-3 flex size-10 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Expand className="size-4" />
        </span>
      </button>
      <Lightbox images={images} {...lb.props} />
    </>
  );
}

/** Downloads a real .ics for the gig, so "add to calendar" can be tested end to end. */
function CalendarButton() {
  const { toast } = useBoard();
  const add = () => {
    if (!gig.date) return;
    const stamp = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const end = new Date(gig.date.getTime() + 5 * 3600_000);
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Atmos//Design mock//EN",
      "BEGIN:VEVENT",
      `UID:${gig.slug}@atmosmedia.co.nz`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(gig.date)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${gig.title}`,
      `LOCATION:${gig.venue}, Cuba St, Wellington`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${gig.slug}.ics`,
    });
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Calendar file downloaded", tone: "success" });
  };
  return (
    <Button variant="outline" onClick={add}>
      <CalendarPlus className="size-4" /> Add to calendar
    </Button>
  );
}

/** Native disclosure: works without JS, animates the chevron only. */
function Faq() {
  return (
    <div className="border-t border-white/10">
      {gigFaq.map((item) => (
        <details key={item.q} className="group border-b border-white/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown className="size-4 shrink-0 text-white/60 transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <p className="max-w-[60ch] pb-5 text-[14px] leading-relaxed text-white/65">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}

export function DetailSection() {
  return (
    <div className="pb-16">
      <VariantTag>
        Gig page · poster lights the header, glass carries the buy
      </VariantTag>
      <div className="relative overflow-hidden">
        {/* The poster itself, blurred, is the only backdrop: hero-only imagery. */}
        <Media
          src={gig.poster}
          alt=""
          sizes="100vw"
          className="absolute inset-0 scale-125 opacity-60 blur-3xl"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black" />

        <div className="relative grid gap-8 px-5 pt-12 pb-16 md:px-10 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-14 lg:pt-16">
          <PosterButton />

          <div className="flex flex-col gap-10">
            <div>
              <h2 className="mx-display text-[clamp(2.5rem,6vw,5rem)]">
                {gig.headline}
              </h2>
              <p className="mt-4 text-lg text-white/75">
                broderbeats presents, with Sunday, Special K and Taiji
              </p>
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Date</dt>
                  <dd className="mx-label text-[12px]">
                    {formatDay(gig.date)}
                  </dd>
                </div>
                <div className="flex items-center gap-2 text-white/75">
                  <MapPin className="size-4" />
                  <dt className="sr-only">Venue</dt>
                  <dd className="mx-label text-[12px]">{gig.venue}, Cuba St</dd>
                </div>
                <div className="flex items-center gap-2 text-white/75">
                  <Clock className="size-4" />
                  <dt className="sr-only">Doors</dt>
                  <dd className="mx-label text-[12px]">
                    Doors {formatTime(gig.date)}
                  </dd>
                </div>
              </dl>
              <div className="mt-8 flex flex-wrap gap-3">
                <SharePopover />
                <CalendarButton />
              </div>
            </div>

            <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
              <div>
                <h3 className="mx-label mb-2 text-[12px] text-white/55">
                  Lineup
                </h3>
                <ul>
                  {lineup.map((a, i) => (
                    <li
                      key={a.name}
                      className="flex items-center gap-4 border-b border-white/10 py-3"
                    >
                      <Image
                        src={a.image}
                        alt=""
                        width={48}
                        height={48}
                        className="size-12 rounded-full object-cover"
                      />
                      <p
                        className={cn(
                          "mx-display flex-1",
                          i === 0 ? "text-2xl" : "text-lg",
                        )}
                      >
                        {a.name}
                      </p>
                      <span className="mx-label text-[10px] text-white/50">
                        {a.role}
                      </span>
                    </li>
                  ))}
                </ul>
                <h3 className="mx-label mt-10 mb-2 text-[12px] text-white/55">
                  Good to know
                </h3>
                <Faq />
              </div>
              <TicketPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
