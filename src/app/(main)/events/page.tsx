"use client";

import Link from "next/link";
import { api, type RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { buildMediaUrl } from "~/lib/media-url";
import { formatEventDate, formatEventTime } from "~/lib/ticketing/dates";
import { formatNZDCompact } from "~/lib/ticketing/money";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";
import { Media, PageTitle, Skeleton } from "~/components/site/ui";
import { OnNowChip, useIsOnNow } from "~/components/site/on-now";

type PublicEvent = RouterOutputs["ticketEvents"]["upcoming"][number];

/** Price or sale-state pill, following the event's status. */
function StatusPill({ event }: { event: PublicEvent }) {
  if (
    event.status === "SOLD_OUT" ||
    event.status === "SALES_PAUSED" ||
    !event.onSale
  ) {
    return (
      <span className="t-label rounded-full border border-white/20 px-3 py-2 text-[10px] text-white/60">
        {event.status === "SOLD_OUT" ? "Sold out" : "Not on sale"}
      </span>
    );
  }
  return (
    <span className="t-label rounded-full bg-white px-3 py-2 text-[10px] text-black transition-colors group-hover:bg-[var(--site-accent)] group-hover:text-[var(--site-accent-ink)]">
      {event.fromPriceCents === 0
        ? "Free"
        : `From ${formatNZDCompact(event.fromPriceCents ?? 0)}`}
    </span>
  );
}

/** Chip on an event that's running right now. */
function EventOnNow({ event }: { event: PublicEvent }) {
  const on = useIsOnNow({ start: event.startsAt, end: event.endsAt });
  return on ? <OnNowChip className="mb-3" /> : null;
}

function R18() {
  return (
    <span className="t-label rounded-[var(--site-r-chip)] border border-white/20 px-2 py-1 text-[9px] text-white/60">
      R18
    </span>
  );
}

/** What's on: every event with tickets currently available. */
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
      <div className="space-y-3 px-5 pb-20 md:px-10">
        {events.isPending ? (
          Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))
        ) : events.data?.length === 0 ? (
          <p className="border border-white/10 px-6 py-16 text-center text-[15px] text-white/60">
            Nothing on sale at the moment. Check back soon.
          </p>
        ) : (
          events.data?.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.slug}`}
              className="group grid grid-cols-1 gap-5 border border-white/10 p-4 transition-colors hover:border-white/25 sm:grid-cols-[160px_minmax(0,1fr)] md:grid-cols-[200px_minmax(0,1fr)_auto] md:items-center md:gap-8"
            >
              {event.posterFileUploadId ? (
                <Media
                  src={buildMediaUrl(event.posterFileUploadId)}
                  alt=""
                  sizes="200px"
                  className={cn(
                    "aspect-square",
                    event.status === "SOLD_OUT" && "opacity-60 grayscale",
                  )}
                />
              ) : (
                <div className="aspect-square bg-white/[0.06]" />
              )}
              <div className="min-w-0">
                <EventOnNow event={event} />
                <p className="t-label text-[11px] text-white/60">
                  {formatEventDate(event.startsAt, event.timezone)} ·{" "}
                  {formatEventTime(event.startsAt, event.timezone)}
                </p>
                <h2 className="t-display mt-3 text-[clamp(1.4rem,3vw,2.25rem)] [overflow-wrap:anywhere] normal-case">
                  {event.name}
                </h2>
                {event.venueName ? (
                  <p className="mt-2 text-[14px] text-white/65">
                    {event.venueName}
                  </p>
                ) : null}
                {event.shortDescription ? (
                  <p className="mt-2 line-clamp-2 text-[14px] text-white/55">
                    {event.shortDescription}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2 md:hidden">
                  <StatusPill event={event} />
                  {event.isR18 ? <R18 /> : null}
                </div>
              </div>
              <div className="hidden flex-col items-end gap-3 md:flex">
                <StatusPill event={event} />
                {event.isR18 ? <R18 /> : null}
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
