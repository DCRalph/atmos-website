"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";

import { api } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";
import { formatEventDate, formatEventTime } from "~/lib/ticketing/dates";
import { formatNZDCompact } from "~/lib/ticketing/money";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";
import { Skeleton } from "~/components/ui/skeleton";

/** What's on — every event with tickets currently available. */
export default function EventsPage() {
  usePageMetadata({
    title: "Tickets",
    description: "Buy tickets to upcoming Atmos events in Pōneke.",
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

      <main className="mx-auto w-full max-w-5xl px-5 py-16 md:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          Tickets
        </h1>
        <p className="mt-2 text-white/50">
          Everything on sale right now.
        </p>

        <div className="mt-10 space-y-4">
          {events.isPending && (
            <>
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </>
          )}

          {events.data?.length === 0 && (
            <p className="border-2 border-white/10 bg-black/60 p-8 text-center text-white/50">
              Nothing on sale at the moment. Check back soon.
            </p>
          )}

          {events.data?.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.04 }}
            >
              <Link
                href={`/events/${event.slug}`}
                className="group hover:border-accent-muted/50 flex flex-col gap-5 border-2 border-white/10 bg-black/80 p-5 backdrop-blur-sm transition-all hover:shadow-[0_0_15px_var(--accent-muted)] md:flex-row"
              >
                {event.posterFileUploadId && (
                  <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-black/20 md:w-48">
                    <Image
                      src={buildMediaUrl(event.posterFileUploadId)}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, 192px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm tracking-[0.14em] text-white/50 uppercase">
                    {formatEventDate(event.startsAt, event.timezone)} ·{" "}
                    {formatEventTime(event.startsAt, event.timezone)}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">
                    {event.name}
                  </h2>
                  {event.venueName && (
                    <p className="mt-1 text-white/60">{event.venueName}</p>
                  )}
                  {event.shortDescription && (
                    <p className="mt-3 line-clamp-2 text-sm text-white/50">
                      {event.shortDescription}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <StatusPill event={event} />
                    {event.isR18 && (
                      <span className="border border-white/15 px-2 py-1 text-xs text-white/50">
                        R18
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </main>
    </>
  );
}

function StatusPill({
  event,
}: {
  event: { status: string; onSale: boolean; fromPriceCents: number | null };
}) {
  if (event.status === "SOLD_OUT") {
    return (
      <span className="bg-white/10 px-3 py-1 text-sm font-medium text-white/70">
        Sold out
      </span>
    );
  }
  if (event.status === "SALES_PAUSED" || !event.onSale) {
    return (
      <span className="bg-white/10 px-3 py-1 text-sm font-medium text-white/70">
        Not on sale
      </span>
    );
  }
  return (
    <span className="bg-white px-3 py-1 text-sm font-semibold text-black">
      {event.fromPriceCents === 0
        ? "Free"
        : `From ${formatNZDCompact(event.fromPriceCents ?? 0)}`}
    </span>
  );
}
