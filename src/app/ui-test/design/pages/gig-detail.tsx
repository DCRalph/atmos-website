"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarPlus,
  Check,
  Clock,
  Expand,
  MapPin,
  Pencil,
  Share2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useBoard } from "../board-state";
import { Lightbox, useLightbox } from "../overlays";
import { Button, Media } from "../primitives";
import { BuyPanel, type BuyScenario } from "./gigs-buy-panel";
import {
  adminOnlyUpcoming,
  flagship,
  fmtLong,
  fmtTime,
  isPast,
  isTba,
  pastList,
  ticketVariants,
  upcomingList,
  type Gig,
} from "./gigs-data";
import {
  AdminStrip,
  CountdownTiles,
  CtaPill,
  Skeleton,
  TbaPoster,
} from "./gigs-parts";
import type { PageSpec } from "./types";

type Resolved =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "gig"; gig: Gig; scenario: BuyScenario; admin: boolean };

const withEvent = (
  event: (typeof ticketVariants)[keyof typeof ticketVariants],
): Gig => ({ ...flagship, tickets: { kind: "onsite", event } });

/** Maps a board state to the gig (and buy-panel starting point) it shows. */
function resolve(state: string): Resolved {
  const gig = (
    g: Gig,
    scenario: BuyScenario = "select",
    admin = false,
  ): Resolved => ({ kind: "gig", gig: g, scenario, admin });
  switch (state) {
    case "loading":
      return { kind: "loading" };
    case "not-found":
      return { kind: "not-found" };
    case "low-stock":
    case "not-on-sale":
    case "sold-out":
    case "cancelled":
    case "free-approval":
      return gig(withEvent(ticketVariants[state]));
    case "external":
      return gig({
        ...flagship,
        tickets: { kind: "external", url: "https://example.com/tickets" },
      });
    case "no-tickets":
      return gig({ ...flagship, tickets: { kind: "none" } });
    case "tba":
      return gig(upcomingList.find(isTba) ?? flagship);
    case "past-media":
      return gig(pastList.find((g) => g.media.length >= 5) ?? pastList[0]!);
    case "past-no-media":
      return gig(pastList.find((g) => g.media.length === 0) ?? pastList[0]!);
    case "admin-draft":
      return gig(adminOnlyUpcoming[0]!, "select", true);
    case "admin-affiliated":
      return gig(adminOnlyUpcoming[1]!, "select", true);
    case "held":
    case "hold-expiring":
    case "declined":
    case "paid":
      return gig(flagship, state);
    default:
      return gig(flagship);
  }
}

// ---------------------------------------------------------------------------
// Shared blocks

function Lineup({ gig, size = "md" }: { gig: Gig; size?: "sm" | "md" }) {
  if (!gig.lineup.length) return null;
  return (
    <ul
      className={cn(
        "flex flex-wrap",
        size === "sm" ? "gap-x-4 gap-y-2" : "gap-x-6 gap-y-4",
      )}
    >
      {gig.lineup.map((a, i) => (
        <li key={a.name} className="flex items-center gap-2.5">
          {a.image ? (
            <Image
              src={a.image}
              alt=""
              width={40}
              height={40}
              className={cn(
                "rounded-full object-cover",
                size === "sm" ? "size-8" : "size-10",
              )}
            />
          ) : null}
          <span
            className={cn(
              "mx-display",
              i === 0 ? "text-lg" : "text-base text-white/80",
            )}
          >
            {a.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Tags({ gig }: { gig: Gig }) {
  if (!gig.tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {gig.tags.map((t) => (
        <li
          key={t}
          className="mx-label rounded-[var(--mx-r-chip)] border border-white/25 px-2 py-1 text-[10px] text-white/75"
        >
          {t}
        </li>
      ))}
    </ul>
  );
}

function MetaLine({ gig }: { gig: Gig }) {
  if (isTba(gig))
    return (
      <p className="mx-label text-[12px] text-white/70">
        Date and venue to be announced
      </p>
    );
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-white/80">
      <div>
        <dt className="sr-only">Date</dt>
        <dd className="mx-label text-[12px]">{fmtLong(gig.start)}</dd>
      </div>
      {!isPast(gig) ? (
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-white/55" />
          <dt className="sr-only">Time</dt>
          <dd className="mx-label text-[12px]">
            {gig.end
              ? `${fmtTime(gig.start)} to ${fmtTime(gig.end)}`
              : `Starts ${fmtTime(gig.start)}`}
          </dd>
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        <MapPin className="size-3.5 text-white/55" />
        <dt className="sr-only">Venue</dt>
        <dd className="mx-label text-[12px]">{gig.subtitle}</dd>
      </div>
    </dl>
  );
}

function Actions({
  gig,
  admin,
  onPoster,
}: {
  gig: Gig;
  admin: boolean;
  onPoster?: () => void;
}) {
  const { toast } = useBoard();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        `https://atmosmedia.co.nz/gigs/${gig.slug}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy the link", tone: "error" });
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {onPoster && !isTba(gig) ? (
        <Button variant="outline" size="sm" className="h-10" onClick={onPoster}>
          <Expand className="size-4" /> Poster
        </Button>
      ) : null}
      {!isTba(gig) ? (
        <Button variant="outline" size="sm" className="h-10" onClick={share}>
          {copied ? (
            <>
              <Check className="size-4" /> Copied
            </>
          ) : (
            <>
              <Share2 className="size-4" /> Share
            </>
          )}
        </Button>
      ) : null}
      {!isTba(gig) && !isPast(gig) ? (
        <Button
          variant="outline"
          size="sm"
          className="h-10"
          onClick={() =>
            toast({ title: "Calendar file downloaded", tone: "success" })
          }
        >
          <CalendarPlus className="size-4" /> Calendar
        </Button>
      ) : null}
      {admin ? (
        <Button
          variant="outline"
          size="sm"
          className="h-10 border-[#ffcc4d]/60 text-[#ffcc4d]"
        >
          <Pencil className="size-4" /> Edit
        </Button>
      ) : null}
    </div>
  );
}

/** Whatever sits where tickets go: the buy panel, an outbound link, or nothing to sell. */
function TicketsBlock({
  gig,
  scenario,
  glass,
}: {
  gig: Gig;
  scenario: BuyScenario;
  glass?: boolean;
}) {
  const t = gig.tickets;
  if (isPast(gig) || isTba(gig)) return null;
  if (t.kind === "onsite")
    return (
      <BuyPanel
        key={scenario}
        event={t.event}
        scenario={scenario}
        glass={glass}
      />
    );
  if (t.kind === "external") {
    return (
      <div
        className={cn(
          "space-y-4 rounded-[var(--mx-r-panel)] rounded-tl-none p-5",
          glass ? "mx-glass-dark" : "border border-white/12 bg-white/[0.03]",
        )}
      >
        <p className="mx-label text-[12px]">Tickets</p>
        <p className="text-[14px] text-white/70">
          Tickets for this one are sold by the promoter. You&apos;ll finish
          buying on their site.
        </p>
        <Button size="lg" className="w-full">
          Get tickets <ArrowUpRight className="size-4" />
        </Button>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-[var(--mx-r-panel)] rounded-tl-none p-5",
        glass ? "mx-glass-dark" : "border border-white/12 bg-white/[0.03]",
      )}
    >
      <p className="mx-label text-[12px]">Tickets</p>
      <p className="mt-2 text-[14px] text-white/70">
        Tickets aren&apos;t sold here. Check with the venue for entry.
      </p>
    </div>
  );
}

function Description({ gig }: { gig: Gig }) {
  if (!gig.description?.length) return null;
  return (
    <div className="max-w-[62ch] space-y-4 text-[16px] leading-relaxed text-white/75 md:text-[17px]">
      {gig.description.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}

/** Past gig photos, uneven grid, opens the lightbox. */
function Gallery({ gig }: { gig: Gig }) {
  const lb = useLightbox();
  if (!isPast(gig)) return null;
  if (!gig.media.length) {
    return (
      <p className="border border-white/10 px-6 py-10 text-center text-[15px] text-white/60">
        No photos from this one yet.
      </p>
    );
  }
  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="mx-display text-[clamp(1.75rem,3.5vw,2.75rem)]">
          Photos
        </h2>
        <span className="mx-label mx-num text-[11px] text-white/60">
          {gig.media.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {gig.media.map((m, i) => (
          <button
            key={m.src}
            type="button"
            onClick={() => lb.open(i)}
            aria-label={`Open photo ${i + 1}`}
            className={cn(
              "relative overflow-hidden",
              i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square",
            )}
          >
            <Image
              src={m.src}
              alt=""
              fill
              sizes="(min-width: 768px) 25vw, 50vw"
              className="object-cover transition-transform duration-500 ease-out hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>
      <Lightbox images={gig.media} {...lb.props} />
    </div>
  );
}

function TbaNotify() {
  const { toast } = useBoard();
  const [done, setDone] = useState(false);
  return done ? (
    <p role="status" className="flex items-center gap-2 text-[15px]">
      <Check className="size-4 text-[var(--mx-accent-text)]" /> We&apos;ll email
      you when it&apos;s announced.
    </p>
  ) : (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
        toast({ title: "You're on the list", tone: "success" });
      }}
      className="flex h-13 w-full max-w-[440px] items-center rounded-full border border-white/25 bg-black/30 p-1.5 pl-5"
    >
      <label htmlFor="tba-email" className="sr-only">
        Email
      </label>
      <input
        id="tba-email"
        type="email"
        placeholder="Email address"
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/50"
      />
      <Button type="submit" className="h-10">
        Tell me first
      </Button>
    </form>
  );
}

function LoadingView() {
  return (
    <div
      aria-busy
      className="grid gap-10 px-5 pt-10 pb-20 md:px-10 lg:grid-cols-[minmax(0,420px)_1fr]"
    >
      <Skeleton className="aspect-[4/5]" />
      <div className="space-y-5">
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-4 w-1/2 rounded-full" />
        <Skeleton className="h-4 w-1/3 rounded-full" />
        <Skeleton className="mt-10 h-64 w-full max-w-[420px] rounded-[var(--mx-r-panel)] rounded-tl-none" />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-5 py-24 text-center">
      <p className="mx-display text-[clamp(2.5rem,7vw,5rem)]">Gig not found</p>
      <p className="max-w-[40ch] text-[15px] text-white/60">
        The event you&apos;re looking for may have been removed, or the link is
        wrong.
      </p>
      <Button variant="outline">
        <ArrowLeft className="size-4" /> Back to gigs
      </Button>
    </div>
  );
}

function BackLink() {
  return (
    <a
      href="#"
      className="mx-label inline-flex items-center gap-2 text-[11px] text-white/70 hover:text-white"
    >
      <ArrowLeft className="size-4" /> All gigs
    </a>
  );
}

// ---------------------------------------------------------------------------
// A · Split

function DraftSplit({ state }: { state: string }) {
  const r = resolve(state);
  const lb = useLightbox();
  if (r.kind === "loading") return <LoadingView />;
  if (r.kind === "not-found") return <NotFound />;
  const { gig, scenario, admin } = r;
  const tba = isTba(gig);

  return (
    <>
      {admin ? <AdminStrip gig={gig} className="py-2 text-[10px]" /> : null}
      <div className="px-5 pt-8 md:px-10">
        <BackLink />
      </div>
      <section className="grid grid-cols-1 gap-8 px-5 pt-6 pb-14 md:px-10 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-14">
        <div className="lg:sticky lg:top-8 lg:self-start">
          {tba ? (
            <TbaPoster gig={gig} className="aspect-[4/5]" size="text-7xl" />
          ) : (
            <button
              type="button"
              onClick={() => lb.open(0)}
              aria-label="View poster full screen"
              className="group relative block w-full"
            >
              <Media
                src={gig.poster}
                alt={`${gig.title} poster`}
                sizes="440px"
                className="aspect-[4/5]"
                priority
              />
              <span className="mx-glass absolute right-3 bottom-3 flex size-10 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Expand className="size-4" />
              </span>
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <div className="space-y-5">
            <h1 className="mx-display text-[clamp(1.9rem,6vw,5.5rem)]">
              {tba ? "TBA" : gig.title}
            </h1>
            <MetaLine gig={gig} />
            <Tags gig={gig} />
            {!tba && !isPast(gig) ? (
              <div className="flex flex-wrap items-center gap-3">
                <a href="#tickets" className="group">
                  <CtaPill gig={gig} size="md" />
                </a>
                <Actions gig={gig} admin={admin} onPoster={() => lb.open(0)} />
              </div>
            ) : (
              <Actions gig={gig} admin={admin} onPoster={() => lb.open(0)} />
            )}
          </div>

          {tba ? (
            <div className="space-y-4 border-t border-white/10 pt-8">
              <p className="max-w-[44ch] text-[16px] text-white/70">
                Something&apos;s coming. The line-up, date and venue drop here
                first, then to the list.
              </p>
              <TbaNotify />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-10 border-t border-white/10 pt-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
              <div className="space-y-10">
                <Description gig={gig} />
                {gig.lineup.length ? (
                  <div>
                    <h2 className="mx-label mb-4 text-[12px] text-white/60">
                      Line-up
                    </h2>
                    <Lineup gig={gig} />
                  </div>
                ) : null}
              </div>
              <div
                id="tickets"
                className="scroll-mt-6 xl:sticky xl:top-8 xl:self-start"
              >
                <TicketsBlock gig={gig} scenario={scenario} />
              </div>
            </div>
          )}
        </div>
      </section>
      {isPast(gig) ? (
        <section className="px-5 pb-20 md:px-10">
          <Gallery gig={gig} />
        </section>
      ) : null}
      {!tba ? (
        <Lightbox
          images={[{ src: gig.poster, alt: `${gig.title} poster` }]}
          {...lb.props}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// B · Immersive

function DraftImmersive({ state }: { state: string }) {
  const r = resolve(state);
  const lb = useLightbox();
  if (r.kind === "loading") {
    return (
      <>
        <div
          aria-busy
          className="relative h-[70vh] min-h-[560px] bg-white/[0.04]"
        >
          <div className="absolute bottom-10 left-5 space-y-4 md:left-10">
            <Skeleton className="h-20 w-[60vw] bg-white/10" />
            <Skeleton className="h-4 w-60 rounded-full bg-white/10" />
          </div>
        </div>
      </>
    );
  }
  if (r.kind === "not-found")
    return (
      <div className="pt-20">
        <NotFound />
      </div>
    );
  const { gig, scenario, admin } = r;
  const tba = isTba(gig);
  const upcoming = !tba && !isPast(gig);

  return (
    <>
      <section className="relative overflow-hidden">
        {/* The poster lights the whole hero; a sharp copy sits inside it. */}
        <Media
          src={gig.poster}
          alt=""
          sizes="100vw"
          className={cn(
            "absolute inset-0 scale-125 blur-3xl",
            tba ? "opacity-70" : "opacity-60",
          )}
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
        {admin ? (
          <AdminStrip
            gig={gig}
            className="relative z-10 mt-16 py-2 text-[10px] md:mt-20"
          />
        ) : null}
        <div
          className={cn(
            "relative grid grid-cols-1 gap-10 px-5 pb-12 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start",
            admin ? "pt-10" : "pt-28 md:pt-32",
          )}
        >
          <div className="flex min-w-0 flex-col gap-6">
            <BackLink />
            <div className="flex flex-col items-start gap-6">
              {tba ? null : (
                <button
                  type="button"
                  onClick={() => lb.open(0)}
                  aria-label="View poster full screen"
                  className="hidden shrink-0 md:block"
                >
                  <Media
                    src={gig.poster}
                    alt=""
                    sizes="200px"
                    className="aspect-[4/5] w-32 xl:w-40"
                  />
                </button>
              )}
              <h1 className="mx-display max-w-full min-w-0 text-[clamp(1.9rem,4.4vw,4.75rem)] leading-[0.9]">
                {tba ? "TBA" : gig.title}
              </h1>
            </div>
            <MetaLine gig={gig} />
            {gig.lineup.length ? <Lineup gig={gig} size="sm" /> : null}
            <div className="flex flex-wrap items-center gap-3">
              <Tags gig={gig} />
              <Actions gig={gig} admin={admin} onPoster={() => lb.open(0)} />
            </div>
            {upcoming ? (
              <div className="w-fit">
                <CountdownTiles target={gig.start} compact />
              </div>
            ) : null}
            {tba ? <TbaNotify /> : null}
          </div>
          {upcoming ? (
            <div>
              <TicketsBlock gig={gig} scenario={scenario} glass />
            </div>
          ) : null}
        </div>
      </section>
      {!tba ? (
        <section className="space-y-16 px-5 pt-6 pb-20 md:px-10">
          <Description gig={gig} />
          <Gallery gig={gig} />
        </section>
      ) : null}
      {!tba ? (
        <Lightbox
          images={[{ src: gig.poster, alt: `${gig.title} poster` }]}
          {...lb.props}
        />
      ) : null}
    </>
  );
}

export const gigDetailPage: PageSpec = {
  id: "gig-detail",
  title: "Gig page",
  route: "/gigs/[slug]",
  nav: "Gigs",
  states: [
    {
      id: "on-sale",
      label: "On sale",
      hint: "Early bird sold out, General on sale, Final release not open yet. Try ATMOS10 and a card ending 0000.",
    },
    {
      id: "low-stock",
      label: "Low stock",
      hint: "General shows “Only 6 left”.",
    },
    { id: "not-on-sale", label: "Not on sale yet" },
    { id: "sold-out", label: "Sold out" },
    { id: "cancelled", label: "Cancelled" },
    {
      id: "free-approval",
      label: "Free, approval",
      hint: "Free event where staff approve each request (“Get my ticket”).",
    },
    {
      id: "external",
      label: "External tickets",
      hint: "Legacy ticket link to another site.",
    },
    { id: "no-tickets", label: "No tickets" },
    {
      id: "held",
      label: "Checkout: held",
      hint: "Terms ticked, seats held, paying.",
    },
    {
      id: "hold-expiring",
      label: "Hold lapsing",
      hint: "45 seconds left; let it run out to see the reset.",
    },
    { id: "declined", label: "Card declined" },
    { id: "paid", label: "Paid" },
    { id: "tba", label: "TBA" },
    { id: "past-media", label: "Past, photos" },
    { id: "past-no-media", label: "Past, no photos" },
    { id: "admin-draft", label: "Admin: draft" },
    { id: "admin-affiliated", label: "Admin: affiliated" },
    { id: "loading", label: "Loading" },
    { id: "not-found", label: "Not found" },
  ],
  drafts: [
    {
      id: "a",
      label: "A · Split",
      note: "Poster held on the left, details and a sticky buy panel on the right. Calm, easy to scan.",
      Component: DraftSplit,
    },
    {
      id: "b",
      label: "B · Immersive",
      note: "The poster lights a full-bleed hero; the buy panel floats on it as glass.",
      Component: DraftImmersive,
      heroUnderHeader: true,
    },
  ],
};
