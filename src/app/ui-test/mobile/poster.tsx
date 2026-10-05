/* eslint-disable @next/next/no-img-element -- static mocks, see phone.tsx */
"use client";

import {
  ArrowLeft,
  Clock,
  MapPin,
  Share2,
  Ticket,
  User,
  Wallet,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { CountdownTiles, buttonVariants } from "~/components/site/ui";
import {
  contentItems,
  formatDay,
  formatTime,
  laterGigs,
  lineup,
  nextGig,
  currentOrder,
  laterOrder,
  fromPrice,
  whenLine,
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
import { DoorResult, DoorScan, Facts, MonthGroups, MoreBody } from "./shared";

/**
 * Direction A, Poster: the website, ported straight. Home opens on the next
 * gig's poster with the countdown in glass, the tab bar is a floating glass
 * capsule (iOS's own Liquid Glass bar), and everything below a hero sits on
 * true black in the site's month-grouped rows.
 */

function TabBar({ active }: { active: TabId }) {
  return (
    <nav className="glass-dark glass-float absolute inset-x-5 bottom-7 z-40 flex h-16 items-center gap-1 rounded-full px-1.5">
      {tabs.map(({ id, label, Icon }) => (
        <span
          key={id}
          className={cn(
            "flex h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-full",
            id === active ? "bg-white/[0.12] text-white" : "text-white/55",
          )}
        >
          <Icon className="size-5" strokeWidth={id === active ? 2.25 : 1.75} />
          <span className="t-label text-[8px]">{label}</span>
        </span>
      ))}
    </nav>
  );
}

function Home() {
  const gig = nextGig;
  return (
    <>
      <Scroll>
        <section className="relative h-[640px]">
          <Poster gig={gig} className="absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black via-black/85 to-transparent" />
          <div
            className="absolute inset-x-0 flex items-center justify-between px-5"
            style={{ top: STATUS + 8 }}
          >
            <img src="/logo/atmos-white.png" alt="Atmos" className="w-24" />
            <span className="glass flex size-10 items-center justify-center rounded-full">
              <User className="size-[18px]" />
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-5 pb-2">
            <Label className="text-white/75">Next up · {whenLine(gig)}</Label>
            <h1 className="t-display mt-3 text-[36px]">{gig.headline}</h1>
            <p className="mt-2.5 flex items-center gap-1.5 text-[14px] text-white/70">
              <MapPin className="size-3.5" /> {gig.venue}
            </p>
            <div className="mt-5">
              <CountdownTiles target={gig.date!} compact />
            </div>
            <div className="mt-3 flex gap-2">
              <span
                className={cn(
                  buttonVariants({ variant: "accent", size: "md" }),
                  "h-12 flex-1",
                )}
              >
                <Ticket className="size-4" /> Your 2 tickets
              </span>
              <span
                className={cn(
                  buttonVariants({ variant: "glass", size: "md" }),
                  "h-12",
                )}
              >
                Gig info
              </span>
            </div>
          </div>
        </section>

        <section className="px-5 pt-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="t-heading text-[30px]">Upcoming</h2>
            <span className={buttonVariants({ variant: "outline", size: "sm" })}>
              All gigs
            </span>
          </div>
          <MonthGroups gigs={laterGigs} />
        </section>

        <section className="pt-12">
          <h2 className="t-heading px-5 text-[30px]">Latest</h2>
          <div className="no-scrollbar mt-6 flex gap-3 overflow-x-auto px-5">
            {contentItems.slice(0, 4).map((item) => (
              <article key={item.id} className="w-[250px] shrink-0">
                <div className="aspect-[16/10] overflow-hidden bg-white/5">
                  <Img src={item.image} />
                </div>
                <Label className="mt-3 text-[9px]">{item.platform}</Label>
                <p className="mt-1.5 line-clamp-2 text-[15px] leading-snug">
                  {item.title}
                </p>
              </article>
            ))}
          </div>
        </section>
      </Scroll>
      <TabBar active="home" />
    </>
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
        <div className="px-5 pt-8">
          <MonthGroups gigs={[nextGig, ...laterGigs]} />
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
      <Scroll pad={140}>
        <div className="relative">
          <Poster gig={gig} className="aspect-[4/5] w-full" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />
        </div>
        <div className="-mt-10 relative px-5">
          <Label className="text-white/75">{formatDay(gig.date)}</Label>
          <h1 className="t-display mt-3 text-[32px]">{gig.headline}</h1>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-white/80">
            <span className="t-label flex items-center gap-1.5 text-[11px]">
              <Clock className="size-3.5 text-white/55" />
              {formatTime(gig.date)} to 3:00am
            </span>
            <span className="t-label flex items-center gap-1.5 text-[11px]">
              <MapPin className="size-3.5 text-white/55" />
              {gig.venue}
            </span>
          </div>
          <ul className="mt-5 flex flex-wrap gap-1.5">
            {[
              ["DnB", "#c6ff33"],
              ["18+", "#ff6b6b"],
            ].map(([tag, colour]) => (
              <li
                key={tag}
                className="t-label flex items-center gap-1.5 rounded-[var(--site-r-chip)] border border-white/25 px-2 py-1 text-[10px] text-white/75"
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: colour }}
                />
                {tag}
              </li>
            ))}
          </ul>

          <h2 className="t-heading mt-10 text-[24px]">Line up</h2>
          <ul className="mt-4">
            {lineup.map((act) => (
              <li
                key={act.name}
                className="flex items-center gap-4 border-b border-white/10 py-3"
              >
                <span className="size-11 shrink-0 overflow-hidden rounded-full bg-white/10">
                  <Img src={act.image} />
                </span>
                <span className="t-display flex-1 text-[16px] normal-case">
                  {act.name}
                </span>
                <Label className="text-[9px]">{act.role}</Label>
              </li>
            ))}
          </ul>

          <h2 className="t-heading mt-10 text-[24px]">About</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            broderbeats brings the INTUITION Vol.3 tour to San Fran. Doors at
            9pm, headline set from around 12:30am. Bring ID: this is an 18+
            event.
          </p>
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

      <div className="glass-dark glass-float absolute inset-x-3 bottom-6 flex items-center justify-between gap-3 rounded-[var(--site-r-panel)] rounded-bl-none py-3 pr-3 pl-5">
        <div>
          <Label className="text-[9px]">General · from</Label>
          <p className="t-display mt-1.5 text-[24px] tabular-nums">
            ${fromPrice}
          </p>
        </div>
        <span className={buttonVariants({ variant: "accent", size: "lg" })}>
          Get tickets
        </span>
      </div>
    </>
  );
}

function Tickets() {
  const order = currentOrder;
  const other = laterOrder;
  const ticket = order.tickets[0]!;
  return (
    <>
      <Ambient src={order.gig.poster} />
      <Scroll>
        <div className="px-5" style={{ paddingTop: STATUS + 28 }}>
          <h1 className="t-heading text-[48px]">Tickets</h1>
          <div className="mt-6 flex gap-2">
            <span className={buttonVariants({ variant: "solid", size: "sm" })}>
              Upcoming
            </span>
            <span className={buttonVariants({ variant: "glass", size: "sm" })}>
              Past
            </span>
          </div>
        </div>

        <div className="mt-8 px-5">
          <article className="glass-dark glass-float overflow-hidden rounded-[var(--site-r-panel)] rounded-tl-none bg-black/60">
            <header className="relative flex h-40 items-end">
              <Img src={order.gig.poster} className="absolute inset-0" />
              <div className="scrim-bottom absolute inset-0" />
              <div className="relative px-5 pb-4">
                <Label className="text-white/75">{whenLine(order.gig)}</Label>
                <h2 className="t-display mt-2 text-[26px]">
                  {order.gig.headline}
                </h2>
              </div>
            </header>
            <div className="border-b border-white/10 px-5 py-4">
              <Facts
                items={[
                  ["Tier", ticket.tier],
                  ["Name", ticket.holder],
                  ["Venue", order.gig.venue],
                  ["Doors", formatTime(order.gig.date)],
                ]}
              />
            </div>
            <div className="px-5 py-5 text-center">
              <MockQr seed={ticket.number} className="mx-auto w-52 p-0" />
              <p className="mt-3 font-mono text-[13px] text-white/55">
                {ticket.number}
              </p>
              <div className="mt-3 flex justify-center gap-1.5">
                <span className="size-1.5 rounded-full bg-white" />
                <span className="size-1.5 rounded-full bg-white/30" />
              </div>
            </div>
          </article>
          <span className="t-label mt-3 flex h-12 items-center justify-center gap-2 rounded-full bg-black text-[12px] ring-1 ring-white/25">
            <Wallet className="size-4" /> Add to Apple Wallet
          </span>

          <article className="glass-dark mt-6 flex h-24 overflow-hidden rounded-[var(--site-r-panel)] rounded-tl-none bg-black/60">
            <Poster gig={other.gig} className="aspect-[4/5] h-full" />
            <div className="flex min-w-0 flex-1 flex-col justify-center px-4">
              <Label className="text-[9px]">{whenLine(other.gig)}</Label>
              <p className="t-display mt-2 truncate text-[17px] normal-case">
                {other.gig.headline}
              </p>
              <p className="mt-1.5 text-[13px] text-white/60">1 ticket</p>
            </div>
          </article>
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

export const poster: Direction = {
  key: "poster",
  name: "Poster",
  pitch:
    "The site, ported straight: poster hero with glass countdown, floating glass tab bar, month rows on black.",
  native:
    "expo-blur for glass, NativeTabs for the Liquid Glass tab bar, a static Anybody width instance (RN can't set font-stretch).",
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
