"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { eventDateParts, formatEventTime } from "~/lib/ticketing/dates";
import { formatNZDCompact } from "~/lib/ticketing/money";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";
import { PageTitle, Skeleton } from "~/components/site/ui";
import { MonthBadge } from "~/components/site/home/parts";
import { OnNowChip, useIsOnNow } from "~/components/site/on-now";

type PublicEvent = RouterOutputs["ticketEvents"]["upcoming"][number];

const isBuyable = (event: PublicEvent) =>
  event.onSale &&
  event.status !== "SOLD_OUT" &&
  event.status !== "SALES_PAUSED";

/** Consecutive events sharing a month (in their own timezone), in date order. */
function groupByMonth(events: PublicEvent[]) {
  const groups: { key: string; events: PublicEvent[] }[] = [];
  for (const event of events) {
    const { month, year } = eventDateParts(event.startsAt, event.timezone);
    const key = `${month} ${year}`;
    const last = groups.at(-1);
    if (last?.key === key) last.events.push(event);
    else groups.push({ key, events: [event] });
  }
  return groups;
}

/** What's on: every event with tickets, grouped by month like the home page. */
export default function EventsPage() {
  usePageMetadata({
    title: "Tickets",
    description: "Buy tickets to upcoming Atmos events.",
    canonical: `${SITE_URL}/events`,
  });

  const events = api.ticketEvents.upcoming.useQuery();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Tickets", url: "/events" },
        ]}
      />
      <PageTitle title="Tickets" intro="Everything on sale right now." />
      <div className="px-5 pb-20 md:px-10">
        {events.isPending ? (
          <ListSkeleton />
        ) : events.data?.length === 0 ? (
          <p className="border border-white/10 px-6 py-16 text-center text-[15px] text-white/60">
            Nothing on sale at the moment. Check back soon.
          </p>
        ) : (
          <div className="space-y-12">
            {groupByMonth(events.data ?? []).map(({ key, events }) => (
              <MonthGroup key={key} events={events} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function MonthGroup({ events }: { events: PublicEvent[] }) {
  const first = events[0];
  if (!first) return null;
  const { shortMonth, month, year } = eventDateParts(
    first.startsAt,
    first.timezone,
  );
  return (
    <section>
      <header className="flex items-center gap-4 border-b border-white/10 pb-4">
        <MonthBadge month={shortMonth} year={year} />
        <h2 className="t-display text-2xl">{month}</h2>
      </header>
      <ul>
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </ul>
    </section>
  );
}

/** Big day number, name and venue, then the price. Sold out rows go quiet. */
function EventRow({ event }: { event: PublicEvent }) {
  const onNow = useIsOnNow({ start: event.startsAt, end: event.endsAt });
  const buyable = isBuyable(event);
  const { day, weekday } = eventDateParts(event.startsAt, event.timezone);
  const time = formatEventTime(event.doorsAt ?? event.startsAt, event.timezone);
  const meta = [
    event.venueName,
    event.doorsAt ? `Doors ${time}` : time,
    event.isR18 ? "R18" : null,
  ].filter(Boolean);

  return (
    <li>
      <Link
        href={`/events/${event.slug}`}
        className="group grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 py-5 transition-colors hover:bg-white/[0.03] md:grid-cols-[112px_minmax(0,1fr)_auto_40px] md:gap-6 md:px-3"
      >
        <div className={cn(!buyable && "text-white/35")}>
          <p
            className={cn(
              "t-heading text-[2.75rem] tabular-nums md:text-6xl",
              buyable &&
                "transition-colors group-hover:text-[var(--site-accent-text)]",
            )}
          >
            {day}
          </p>
          <p className="t-label mt-2 text-[10px] text-white/55">{weekday}</p>
        </div>
        <div className="min-w-0">
          {onNow ? <OnNowChip className="mb-2" /> : null}
          <p
            className={cn(
              "t-display line-clamp-2 text-lg leading-[1.05] [overflow-wrap:anywhere] normal-case md:text-3xl",
              !buyable && "text-white/45",
            )}
          >
            {event.name}
          </p>
          <p className="mt-2 text-[13px] text-white/60 md:truncate">
            {meta.join(" · ")}
          </p>
        </div>
        <Price event={event} buyable={buyable} />
        <span className="hidden size-10 items-center justify-center rounded-full border border-white/20 text-white/70 transition-colors group-hover:border-white group-hover:text-white md:flex">
          <ArrowRight className="size-4" />
        </span>
      </Link>
    </li>
  );
}

function Price({ event, buyable }: { event: PublicEvent; buyable: boolean }) {
  if (!buyable) {
    return (
      <p className="t-display text-right text-base text-white/35 md:text-2xl">
        {event.status === "SOLD_OUT" ? "Sold out" : "Not on sale"}
      </p>
    );
  }
  const free = event.fromPriceCents === 0;
  return (
    <div className="text-right">
      <p className="t-display text-xl tabular-nums md:text-3xl">
        {free ? "Free" : formatNZDCompact(event.fromPriceCents ?? 0)}
      </p>
      <p className="t-label mt-1.5 text-[10px] text-white/55">
        {free ? "Entry" : "From"}
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy>
      <div className="flex items-center gap-4 border-b border-white/10 pb-4">
        <Skeleton className="h-[52px] w-14 rounded-[var(--site-r-chip)]" />
        <Skeleton className="h-6 w-40 rounded-full" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="grid grid-cols-[64px_1fr] items-center gap-4 border-b border-white/10 py-5 md:grid-cols-[112px_1fr] md:gap-6 md:px-3"
        >
          <Skeleton className="h-12 w-14 md:h-14 md:w-20" />
          <div className="space-y-2.5">
            <Skeleton className="h-6 w-1/2 rounded-full" />
            <Skeleton className="h-3.5 w-1/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
