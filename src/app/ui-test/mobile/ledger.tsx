/* eslint-disable @next/next/no-img-element -- static mocks, see phone.tsx */
"use client";

import {
  ArrowLeft,
  ChevronRight,
  Minus,
  Plus,
  Search,
  Share2,
  Wallet,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { buttonVariants, inputClass } from "~/components/site/ui";
import {
  account,
  currentOrder,
  formatDay,
  formatTime,
  laterGigs,
  laterOrder,
  lineup,
  nextGig,
  pastOrders,
  ticketTiers,
  whenLine,
  type MockOrder,
} from "./fixtures";
import {
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
 * Direction B, Ledger: the site's typography doing all the work. No hero:
 * every tab opens on an Orbitron large title, lists are the site's rows
 * tightened for a thumb, glass only appears over the camera, and the tab bar
 * is solid black with an accent tick on the active tab. The quickest to
 * build and the densest to read.
 */

function TabBar({ active }: { active: TabId }) {
  return (
    <nav className="absolute inset-x-0 bottom-0 z-40 flex h-[84px] border-t border-white/10 bg-black px-2 pb-[30px]">
      {tabs.map(({ id, label, Icon }) => (
        <span
          key={id}
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-1.5",
            id === active ? "text-white" : "text-white/45",
          )}
        >
          {id === active ? (
            <span className="absolute top-0 h-[2px] w-6 bg-[var(--site-accent)]" />
          ) : null}
          <Icon className="size-5" strokeWidth={id === active ? 2.25 : 1.75} />
          <span className="t-label text-[8px]">{label}</span>
        </span>
      ))}
    </nav>
  );
}

/** iOS large title, set in Orbitron. */
function LargeTitle({ children }: { children: string }) {
  return (
    <h1
      className="t-heading px-5 pb-5 text-[40px]"
      style={{ paddingTop: STATUS + 20 }}
    >
      {children}
    </h1>
  );
}

/** One track, two segments, white on the active one. */
function Segmented({ options }: { options: string[] }) {
  return (
    <div className="flex rounded-full bg-white/[0.06] p-1">
      {options.map((option, i) => (
        <span
          key={option}
          className={cn(
            "t-label flex h-8 flex-1 items-center justify-center rounded-full text-[10px]",
            i === 0 ? "bg-white text-black" : "text-white/60",
          )}
        >
          {option}
        </span>
      ))}
    </div>
  );
}

function Home() {
  const gig = nextGig;
  return (
    <>
      <Scroll pad={100}>
        <div
          className="flex items-center justify-between px-5"
          style={{ paddingTop: STATUS + 10 }}
        >
          <img src="/logo/atmos-white.png" alt="Atmos" className="w-20" />
          <span className="t-label flex size-8 items-center justify-center rounded-full bg-white/10 text-[12px]">
            {account.name.slice(0, 1)}
          </span>
        </div>

        <section className="px-5 pt-8">
          <Label>Next up</Label>
          <article className="mt-3 overflow-hidden rounded-[var(--site-r-panel)] rounded-tl-none border border-white/10 bg-[var(--site-raised)]">
            <div className="flex gap-4 p-3">
              <Poster gig={gig} className="aspect-[4/5] w-[112px] shrink-0" />
              <div className="flex min-w-0 flex-col py-1">
                <p className="t-label text-[10px] text-[var(--site-accent-text)]">
                  In 4 days
                </p>
                <h2 className="t-display mt-2.5 text-[24px]">{gig.headline}</h2>
                <p className="mt-auto text-[13px] text-white/60">
                  {formatDay(gig.date)} · {formatTime(gig.date)}
                  <br />
                  {gig.venue}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 py-2.5 pr-2.5 pl-4">
              <span className="text-[14px]">
                2 tickets <span className="text-white/50">· General</span>
              </span>
              <span className={buttonVariants({ variant: "solid", size: "sm" })}>
                Show
              </span>
            </div>
          </article>
        </section>

        <section className="px-5 pt-10">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="t-heading text-[26px]">Upcoming</h2>
            <span className="t-label flex items-center gap-1 text-[10px] text-white/60">
              All <ChevronRight className="size-3.5" />
            </span>
          </div>
          <MonthGroups gigs={laterGigs} dense />
        </section>
      </Scroll>
      <TabBar active="home" />
    </>
  );
}

function Gigs() {
  return (
    <>
      <Scroll pad={100}>
        <LargeTitle>Gigs</LargeTitle>
        <div className="space-y-3 px-5">
          <div className="relative">
            <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-white/40" />
            <div className={cn(inputClass, "flex items-center pl-11 text-white/40")}>
              Search gigs and artists
            </div>
          </div>
          <Segmented options={["Upcoming", "Past"]} />
        </div>
        <div className="px-5 pt-8">
          <MonthGroups gigs={[nextGig, ...laterGigs]} dense />
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
      <header
        className="absolute inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-black px-4 pb-3"
        style={{ paddingTop: STATUS + 6 }}
      >
        <ArrowLeft className="size-5" />
        <p className="t-label flex-1 truncate text-[11px]">{gig.headline}</p>
        <Share2 className="size-[18px] text-white/70" />
      </header>
      <Scroll pad={120} className="pt-[106px]">
        <div className="flex gap-4 px-5">
          <Poster gig={gig} className="aspect-[4/5] w-[132px] shrink-0" />
          <div className="flex min-w-0 flex-col justify-end">
            <Label className="text-white/70">{formatDay(gig.date)}</Label>
            <h1 className="t-display mt-2.5 text-[26px]">{gig.headline}</h1>
            <p className="mt-2 text-[13px] text-white/60">broderbeats</p>
          </div>
        </div>

        <div className="mx-5 mt-6 border-y border-white/10 py-5">
          <Facts
            items={[
              ["Doors", formatTime(gig.date)],
              ["Ends", "3:00am"],
              ["Venue", gig.venue],
              ["Age", "18+"],
            ]}
          />
        </div>

        <section className="px-5 pt-8">
          <h2 className="t-heading text-[22px]">Tickets</h2>
          <ul className="mt-3">
            {ticketTiers.map((tier) => (
              <li
                key={tier.name}
                className={cn(
                  "flex items-center gap-3 border-b border-white/10 py-4",
                  tier.state !== "on-sale" && "text-white/40",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="t-display text-[16px] normal-case">
                    {tier.name}
                  </p>
                  <p className="mt-1 text-[13px]">
                    {tier.state === "sold-out"
                      ? "Sold out"
                      : tier.state === "upcoming"
                        ? "From Sat 17 Oct"
                        : `$${tier.price} + fees`}
                  </p>
                </div>
                {tier.state === "on-sale" ? (
                  <span className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full border border-white/25">
                      <Minus className="size-4" />
                    </span>
                    <span className="t-display w-4 text-center text-[18px] tabular-nums">
                      2
                    </span>
                    <span className="flex size-9 items-center justify-center rounded-full bg-white text-black">
                      <Plus className="size-4" />
                    </span>
                  </span>
                ) : (
                  <span className="t-display text-[16px] tabular-nums line-through">
                    ${tier.price}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="px-5 pt-8">
          <h2 className="t-heading text-[22px]">Line up</h2>
          <ul className="mt-3">
            {lineup.map((act) => (
              <li
                key={act.name}
                className="flex items-center justify-between border-b border-white/10 py-3"
              >
                <span className="t-display text-[15px] normal-case">
                  {act.name}
                </span>
                <Label className="text-[9px]">{act.role}</Label>
              </li>
            ))}
          </ul>
        </section>
      </Scroll>

      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-white/10 bg-black px-5 pt-3 pb-9">
        <div>
          <Label className="text-[9px]">2 × General</Label>
          <p className="t-display mt-1.5 text-[22px] tabular-nums">$70</p>
        </div>
        <span
          className={cn(
            buttonVariants({ variant: "accent", size: "lg" }),
            "flex-1",
          )}
        >
          Checkout
        </span>
      </div>
    </>
  );
}

/** One order as a row: poster, name, date and count. */
function OrderRow({ order }: { order: MockOrder }) {
  const n = order.tickets.length;
  return (
    <li className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 py-3">
      <Poster gig={order.gig} className="aspect-[4/5] w-11" />
      <div className="min-w-0">
        <p className="t-display truncate text-[15px] normal-case">
          {order.gig.headline}
        </p>
        <p className="mt-1.5 truncate text-[13px] text-white/60">
          {formatDay(order.gig.date)} · {n} {n === 1 ? "ticket" : "tickets"}
        </p>
      </div>
      <ChevronRight className="size-4 text-white/40" />
    </li>
  );
}

function Tickets() {
  const order = currentOrder;
  return (
    <>
      <Scroll pad={100}>
        <LargeTitle>Tickets</LargeTitle>

        <section className="px-5">
          <Label>Next · {whenLine(order.gig)}</Label>
          <p className="t-display mt-2.5 text-[22px]">{order.gig.headline}</p>
          <div className="no-scrollbar -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5">
            {order.tickets.map((ticket, i) => (
              <article
                key={ticket.number}
                className="flex w-[318px] shrink-0 snap-start gap-4 rounded-[var(--site-r-panel)] rounded-tl-none border border-white/10 bg-[var(--site-raised)] p-3"
              >
                <MockQr seed={ticket.number} className="size-[124px] shrink-0" />
                <div className="flex min-w-0 flex-col py-1">
                  <Label className="text-[9px]">
                    Ticket {i + 1} of {order.tickets.length}
                  </Label>
                  <p className="mt-2 truncate text-[15px]">{ticket.holder}</p>
                  <p className="text-[13px] text-white/60">{ticket.tier}</p>
                  <p className="mt-auto font-mono text-[11px] text-white/45">
                    {ticket.number}
                  </p>
                </div>
              </article>
            ))}
          </div>
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "md" }),
              "mt-3 w-full",
            )}
          >
            <Wallet className="size-4" /> Add both to Apple Wallet
          </span>
        </section>

        <section className="px-5 pt-10">
          <Label className="pb-1">Upcoming</Label>
          <ul>
            <OrderRow order={laterOrder} />
          </ul>
          <Label className="pt-8 pb-1">Past</Label>
          <ul>
            {pastOrders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        </section>
      </Scroll>
      <TabBar active="tickets" />
    </>
  );
}

function More() {
  return (
    <>
      <Scroll pad={100}>
        <LargeTitle>More</LargeTitle>
        <MoreBody />
      </Scroll>
      <TabBar active="more" />
    </>
  );
}

export const ledger: Direction = {
  key: "ledger",
  name: "Ledger",
  pitch:
    "Type does the work: Orbitron large titles, tight site rows, solid tab bar with an accent tick. Glass only over the camera.",
  native:
    "Nothing beyond the shared fonts and tokens. Closest to today's screen structure, so mostly a restyle of ui.tsx.",
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
