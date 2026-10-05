/* eslint-disable @next/next/no-img-element -- static mocks, see phone.tsx */
"use client";

import { ArrowLeft, Minus, Plus, Share2, Wallet } from "lucide-react";
import { cn } from "~/lib/utils";
import { CountdownTiles, buttonVariants } from "~/components/site/ui";
import { MonthBadge } from "~/components/site/home/parts";
import {
  account,
  currentOrder,
  formatDay,
  formatMonth,
  formatTime,
  formatYear,
  fromPrice,
  groupByMonth,
  laterGigs,
  laterOrder,
  lineup,
  nextGig,
  pastOrders,
  statusLabel,
  ticketTiers,
  whenLine,
  type MockGig,
} from "./fixtures";
import {
  Ambient,
  Img,
  Label,
  MockQr,
  Poster,
  STATUS,
  Scroll,
  tabs,
  type Direction,
  type TabId,
} from "./phone";
import { DoorResult, DoorScan, Facts, MoreBody } from "./shared";

/**
 * Direction C, Deck: posters are the interface. Home is a swipeable deck of
 * posters over the current one blurred out (the ticket pages' backdrop, so
 * the whole app takes on the gig's colour), gigs are a poster grid, and
 * tickets stack like Wallet. The tab bar is a small glass capsule that only
 * labels the active tab. The most atmospheric, and the most imagery-dependent.
 */

function TabBar({ active }: { active: TabId }) {
  return (
    <nav className="glass-dark glass-float absolute bottom-7 left-1/2 z-40 flex h-14 -translate-x-1/2 items-center gap-1 rounded-full p-1.5">
      {tabs.map(({ id, label, Icon }) =>
        id === active ? (
          <span
            key={id}
            className="t-label flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[10px] text-black"
          >
            <Icon className="size-[18px]" strokeWidth={2.25} />
            {label}
          </span>
        ) : (
          <span
            key={id}
            className="flex size-11 items-center justify-center rounded-full text-white/65"
          >
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
        ),
      )}
    </nav>
  );
}

/** Poster with a notched glass caption hanging off its bottom edge. */
function DeckCard({ gig, active }: { gig: MockGig; active?: boolean }) {
  return (
    <article
      className={cn(
        "relative w-[290px] shrink-0 snap-center",
        !active && "opacity-60",
      )}
    >
      <Poster gig={gig} className="aspect-[4/5] w-full" tbaClassName="text-4xl" />
      <div className="glass-dark absolute inset-x-3 bottom-3 rounded-[var(--site-r-panel)] rounded-tl-none px-4 py-3">
        <Label className="text-[9px] text-white/70">
          {gig.date ? formatDay(gig.date) : "Date TBA"}
        </Label>
        <p className="t-display mt-2 truncate text-[20px]">{gig.headline}</p>
        <p className="mt-1 truncate text-[13px] text-white/65">{gig.venue}</p>
      </div>
    </article>
  );
}

function Home() {
  const gig = nextGig;
  return (
    <>
      <Ambient src={gig.poster} dim={0.6} />
      <Scroll>
        <div
          className="flex items-center justify-between px-5"
          style={{ paddingTop: STATUS + 10 }}
        >
          <img src="/logo/atmos-white.png" alt="Atmos" className="w-24" />
          <span className="glass t-label flex size-10 items-center justify-center rounded-full text-[13px]">
            {account.name.slice(0, 1)}
          </span>
        </div>

        <div className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[50px]">
          <DeckCard gig={gig} active />
          {laterGigs.map((g) => (
            <DeckCard key={g.slug} gig={g} />
          ))}
        </div>

        <div className="px-5 pt-6">
          <CountdownTiles target={gig.date!} compact />
          <span
            className={cn(
              buttonVariants({ variant: "accent", size: "lg" }),
              "mt-3 w-full",
            )}
          >
            Your 2 tickets
          </span>
        </div>

        <section className="pt-12">
          <h2 className="t-heading px-5 text-[26px]">Later</h2>
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 px-5">
            {laterGigs.map((g) => (
              <PosterTile key={g.slug} gig={g} />
            ))}
          </div>
        </section>
      </Scroll>
      <TabBar active="home" />
    </>
  );
}

/** Grid tile: poster with a notched status chip, name and date under it. */
function PosterTile({ gig }: { gig: MockGig }) {
  const status = statusLabel[gig.status];
  return (
    <article className="min-w-0">
      <div className="relative">
        <Poster gig={gig} className="aspect-[4/5] w-full" />
        {status && gig.status !== "tba" ? (
          <span
            className={cn(
              "t-label absolute top-0 left-0 px-2.5 py-1.5 text-[9px]",
              gig.status === "free"
                ? "bg-[var(--site-accent)] text-[var(--site-accent-ink)]"
                : "glass-dark",
            )}
          >
            {status}
          </span>
        ) : null}
      </div>
      <p className="t-display mt-3 line-clamp-2 text-[14px] normal-case">
        {gig.status === "tba" ? "TBA" : gig.headline}
      </p>
      <Label className="mt-1.5 text-[9px]">
        {gig.date ? `${formatDay(gig.date)} · ${gig.venue}` : "Date TBA"}
      </Label>
    </article>
  );
}

function Gigs() {
  return (
    <>
      <Scroll>
        <div className="px-5" style={{ paddingTop: STATUS + 28 }}>
          <h1 className="t-heading text-[48px]">Gigs</h1>
          <div className="mt-6 flex gap-2">
            <span className={buttonVariants({ variant: "solid", size: "sm" })}>
              Upcoming
            </span>
            <span className={buttonVariants({ variant: "outline", size: "sm" })}>
              Past
            </span>
          </div>
        </div>
        <div className="space-y-10 px-5 pt-8">
          {groupByMonth([nextGig, ...laterGigs]).map(({ key, date, gigs }) => (
            <section key={key}>
              <header className="flex items-center gap-4 pb-4">
                {date ? (
                  <MonthBadge month={formatMonth(date)} year={formatYear(date)} />
                ) : (
                  <MonthBadge />
                )}
                <h2 className="t-display text-[20px]">
                  {date ? key.split(" ")[0] : "To be announced"}
                </h2>
              </header>
              <div className="grid grid-cols-2 gap-x-3 gap-y-6">
                {gigs.map((g) => (
                  <PosterTile key={g.slug} gig={g} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </Scroll>
      <TabBar active="gigs" />
    </>
  );
}

function Gig() {
  const gig = nextGig;
  return (
    <>
      <Ambient src={gig.poster} dim={0.6} />
      <Scroll pad={120}>
        <div style={{ paddingTop: STATUS + 64 }}>
          <Poster gig={gig} className="mx-auto aspect-[4/5] w-[270px]" />
        </div>
        <div className="px-5 pt-6 text-center">
          <Label className="text-white/75">{whenLine(gig)}</Label>
          <h1 className="t-display mt-3 text-[30px]">{gig.headline}</h1>
          <p className="mt-2 text-[14px] text-white/70">{gig.venue}</p>
        </div>

        <div className="no-scrollbar mt-7 flex gap-4 overflow-x-auto px-5">
          {lineup.map((act) => (
            <div key={act.name} className="w-16 shrink-0 text-center">
              <span className="block size-16 overflow-hidden rounded-full bg-white/10">
                <Img src={act.image} />
              </span>
              <p className="mt-2 truncate text-[12px]">{act.name}</p>
            </div>
          ))}
        </div>

        <div className="glass-dark mx-5 mt-7 rounded-[var(--site-r-panel)] rounded-tl-none p-1.5">
          {ticketTiers.map((tier) => {
            const live = tier.state === "on-sale";
            return (
              <div
                key={tier.name}
                className={cn(
                  "flex h-14 items-center gap-3 rounded-[10px] px-3.5",
                  live ? "bg-white/[0.08]" : "text-white/40",
                )}
              >
                <span className="t-label flex-1 text-[11px]">{tier.name}</span>
                {live ? (
                  <span className="flex items-center gap-2.5">
                    <Minus className="size-4 text-white/60" />
                    <span className="t-display text-[16px] tabular-nums">2</span>
                    <Plus className="size-4" />
                  </span>
                ) : (
                  <span className="t-label text-[9px]">
                    {tier.state === "sold-out" ? "Sold out" : "Soon"}
                  </span>
                )}
                <span className="t-display w-12 text-right text-[15px] tabular-nums">
                  ${tier.price}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mx-5 mt-7">
          <Facts
            items={[
              ["Doors", formatTime(gig.date)],
              ["Age", "18+"],
            ]}
          />
        </div>
      </Scroll>

      <div
        className="absolute inset-x-5 flex justify-between"
        style={{ top: STATUS + 6 }}
      >
        <span className="glass flex size-11 items-center justify-center rounded-full">
          <ArrowLeft className="size-5" />
        </span>
        <span className="glass flex size-11 items-center justify-center rounded-full">
          <Share2 className="size-[18px]" />
        </span>
      </div>
      <div className="absolute inset-x-5 bottom-7">
        <span
          className={cn(
            buttonVariants({ variant: "accent", size: "lg" }),
            "glass-float w-full",
          )}
        >
          Checkout · ${fromPrice * 2}
        </span>
      </div>
    </>
  );
}

/** A pass tucked behind the front one: only its poster strip shows. */
function PassStrip({ gig, note }: { gig: MockGig; note: string }) {
  return (
    <div className="glass-dark relative -mb-6 flex h-[84px] overflow-hidden rounded-[var(--site-r-panel)] rounded-tl-none bg-black/60 pb-6">
      <Img src={gig.poster} className="absolute inset-0 opacity-45" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />
      <div className="relative flex w-full items-center justify-between px-5">
        <p className="t-display truncate text-[16px] normal-case">
          {gig.headline}
        </p>
        <Label className="shrink-0 text-[9px] text-white/70">{note}</Label>
      </div>
    </div>
  );
}

function Tickets() {
  const order = currentOrder;
  const ticket = order.tickets[0]!;
  return (
    <>
      <Ambient src={order.gig.poster} />
      <Scroll>
        <div
          className="flex items-end justify-between px-5"
          style={{ paddingTop: STATUS + 28 }}
        >
          <h1 className="t-heading text-[48px]">Tickets</h1>
          <span className={buttonVariants({ variant: "glass", size: "sm" })}>
            Past {pastOrders.length}
          </span>
        </div>

        <div className="mt-8 px-4">
          <PassStrip gig={laterOrder.gig} note={formatDay(laterOrder.gig.date)} />
          <PassStrip gig={order.gig} note="Ticket 2 of 2" />
          <article className="glass-dark glass-float relative overflow-hidden rounded-[var(--site-r-panel)] rounded-tl-none bg-black/70">
            <header className="relative flex h-36 items-end">
              <Img src={order.gig.poster} className="absolute inset-0" />
              <div className="scrim-bottom absolute inset-0" />
              <div className="relative flex w-full items-end justify-between gap-3 px-5 pb-4">
                <div className="min-w-0">
                  <Label className="text-white/75">{whenLine(order.gig)}</Label>
                  <h2 className="t-display mt-2 text-[24px]">
                    {order.gig.headline}
                  </h2>
                </div>
                <Label className="shrink-0 text-[9px] text-white/70">1 of 2</Label>
              </div>
            </header>
            <div className="px-5 py-6 text-center">
              <MockQr seed={ticket.number} className="mx-auto w-56" />
              <p className="mt-3 font-mono text-[13px] text-white/55">
                {ticket.number}
              </p>
            </div>
            <div className="border-t border-white/10 px-5 py-4">
              <Facts
                items={[
                  ["Name", ticket.holder],
                  ["Tier", ticket.tier],
                ]}
              />
            </div>
          </article>
          <span className="t-label mt-3 flex h-12 items-center justify-center gap-2 rounded-full bg-black text-[12px] ring-1 ring-white/25">
            <Wallet className="size-4" /> Add to Apple Wallet
          </span>
        </div>
      </Scroll>
      <TabBar active="tickets" />
    </>
  );
}

function More() {
  return (
    <>
      <Scroll>
        <div className="px-5" style={{ paddingTop: STATUS + 28 }}>
          <h1 className="t-heading mb-8 text-[48px]">More</h1>
        </div>
        <MoreBody />
      </Scroll>
      <TabBar active="more" />
    </>
  );
}

export const deck: Direction = {
  key: "deck",
  name: "Deck",
  pitch:
    "Posters are the interface: a swipeable deck over the gig's blurred poster, poster grids, Wallet-style stacked passes.",
  native:
    "expo-blur plus a snapping FlatList deck. Needs a fallback for gigs without a poster, since the whole screen takes its colour from one.",
  screens: {
    home: Home,
    gigs: Gigs,
    gig: Gig,
    tickets: Tickets,
    more: More,
    scan: DoorScan,
    door: DoorResult,
  },
};
