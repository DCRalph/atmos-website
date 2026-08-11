"use client";

import Link from "next/link";
import { Ticket } from "lucide-react";

import { api } from "~/trpc/react";
import { BuyPanel } from "./buy-panel";
import { formatNZDCompact } from "~/lib/ticketing/money";

/**
 * Ticketing on a gig page.
 *
 * A gig can be ticketed here, ticketed somewhere else via the legacy
 * `ticketLink`, or not ticketed at all. These two components resolve that:
 * when a `TicketEvent` is linked it wins, and the external link is the
 * fallback.
 *
 * React Query dedupes the shared `forGig` fetch, so having both the hero
 * button and the panel on one page costs a single request.
 */

/** Hero call to action. Returns null when there's nothing to sell. */
export function GigTicketCta({
  gigId,
  fallbackLink,
  className,
}: {
  gigId: string;
  fallbackLink?: string | null;
  className?: string;
}) {
  const event = api.ticketEvents.forGig.useQuery({ gigId });

  if (event.isPending) return null;

  if (event.data) {
    const soldOut = event.data.status === "SOLD_OUT";
    const cancelled = event.data.status === "CANCELLED";

    if (cancelled) {
      return (
        <span className={`${className} cursor-default opacity-60`}>
          <Ticket className="h-4 w-4" />
          Cancelled
        </span>
      );
    }

    return (
      <Link href={`/events/${event.data.slug}`} className={className}>
        <Ticket className="h-4 w-4" />
        {soldOut
          ? "Sold out"
          : event.data.fromPriceCents === 0
            ? "Free tickets"
            : `Tickets from ${formatNZDCompact(event.data.fromPriceCents ?? 0)}`}
      </Link>
    );
  }

  if (fallbackLink) {
    return (
      <Link
        href={fallbackLink}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <Ticket className="h-4 w-4" />
        Get Tickets
      </Link>
    );
  }

  return null;
}

/** The full buy panel, for the body of the gig page. */
export function GigTicketPanel({ gigId }: { gigId: string }) {
  const event = api.ticketEvents.forGig.useQuery({ gigId });

  if (!event.data) return null;

  return (
    <section className="mx-auto max-w-md">
      <BuyPanel event={event.data} />
    </section>
  );
}
