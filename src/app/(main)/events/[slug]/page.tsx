"use client";

import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock, MapPin } from "lucide-react";

import { api } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";
import {
  formatEventDateLong,
  formatEventTime,
} from "~/lib/ticketing/dates";
import { formatNZD } from "~/lib/ticketing/money";
import { BuyPanel } from "~/components/ticketing/buy-panel";
import { LexicalContent } from "~/components/lexical";
import { Skeleton } from "~/components/ui/skeleton";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { SITE_URL } from "~/lib/seo-constants";

/** Public event page. The buy panel sticks to the side on desktop. */
export default function EventPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const event = api.ticketEvents.bySlug.useQuery({ slug }, { enabled: !!slug });

  usePageMetadata({
    title: event.data?.name ?? "Event",
    description:
      event.data?.shortDescription ?? "Tickets to an Atmos event in Pōneke.",
    canonical: `${SITE_URL}/events/${slug}`,
  });

  if (event.isPending) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="mt-6 h-96 w-full" />
      </main>
    );
  }

  if (!event.data) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-24 text-center md:px-8">
        <h1 className="text-3xl font-bold text-white">Event not found</h1>
        <p className="mt-3 text-white/50">
          This event might have finished, or the link is wrong.
        </p>
        <Link
          href="/events"
          className="mt-6 inline-block border-2 border-white/20 px-5 py-2.5 text-white transition-colors hover:bg-white hover:text-black"
        >
          See what&apos;s on
        </Link>
      </main>
    );
  }

  const data = event.data;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14">
        <div className="min-w-0">
          {data.posterFileUploadId && (
            <div className="relative mb-8 aspect-square w-full max-w-md overflow-hidden border-2 border-white/10 bg-black/20">
              <Image
                src={buildMediaUrl(data.posterFileUploadId)}
                alt={`${data.name} poster`}
                fill
                sizes="(max-width: 1024px) 100vw, 448px"
                className="object-cover"
                priority
              />
            </div>
          )}

          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            {data.name}
          </h1>

          {data.shortDescription && (
            <p className="mt-3 text-lg text-white/60">{data.shortDescription}</p>
          )}

          <dl className="mt-8 space-y-3 border-y-2 border-white/10 py-6">
            <DetailRow icon={CalendarDays} label="Date">
              {formatEventDateLong(data.startsAt, data.timezone)}
            </DetailRow>
            <DetailRow icon={Clock} label="Time">
              {data.doorsAt
                ? `Doors ${formatEventTime(data.doorsAt, data.timezone)} · Starts ${formatEventTime(data.startsAt, data.timezone)}`
                : formatEventTime(data.startsAt, data.timezone)}
            </DetailRow>
            {data.venueName && (
              <DetailRow icon={MapPin} label="Venue">
                {data.venueName}
                {data.venueAddress && (
                  <span className="block text-white/40">
                    {data.venueAddress}
                  </span>
                )}
              </DetailRow>
            )}
          </dl>

          {data.descriptionLexical != null && (
            <LexicalContent
              value={data.descriptionLexical}
              namespace={`event-description-${data.id}`}
              className="mt-8"
              contentClassName="prose prose-invert max-w-none"
            />
          )}

          {data.gig && (
            <Link
              href={`/gigs/${data.gig.id}`}
              className="mt-8 inline-block text-sm text-white/50 underline underline-offset-4 hover:text-white"
            >
              More about this gig
            </Link>
          )}

          {/* Fees disclosed on the page itself, not just at the payment step. */}
          {(data.bookingFee.fixedCents > 0 || data.bookingFee.percentBp > 0) && (
            <p className="mt-8 text-xs text-white/40">
              Prices include GST. A booking fee of{" "}
              {data.bookingFee.fixedCents > 0 &&
                `${formatNZD(data.bookingFee.fixedCents)} per ticket`}
              {data.bookingFee.fixedCents > 0 && data.bookingFee.percentBp > 0
                ? " plus "
                : ""}
              {data.bookingFee.percentBp > 0 &&
                `${data.bookingFee.percentBp / 100}%`}{" "}
              is added at checkout.
            </p>
          )}
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <BuyPanel event={data} />
        </div>
      </div>
    </main>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarDays;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-white/40" aria-hidden />
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="text-white/80">{children}</dd>
      </div>
    </div>
  );
}
