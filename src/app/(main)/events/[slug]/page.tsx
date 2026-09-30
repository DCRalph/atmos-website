"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock, EyeOff, MapPin } from "lucide-react";
import { api } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";
import { formatEventDateLong, formatEventTime } from "~/lib/ticketing/dates";
import { formatNZD } from "~/lib/ticketing/money";
import { BuyPanel } from "~/components/ticketing/buy-panel";
import { LexicalContent } from "~/components/lexical";
import { Media, Skeleton, buttonVariants } from "~/components/site/ui";
import { usePageMetadata } from "~/hooks/use-page-metadata";
import { gigPath } from "~/lib/gig-url";
import { SITE_URL } from "~/lib/seo-constants";
import {
  OnNowPanel,
  nightPhase,
  useMinuteClock,
} from "~/components/site/on-now";

/** Public event page. The buy panel sticks to the side on desktop. */
export default function EventPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params.slug;
  // A private event's share link carries its key here. Public and unlisted
  // events ignore it entirely.
  const key = searchParams.get("k") ?? undefined;

  const event = api.ticketEvents.bySlug.useQuery(
    { slug, key },
    { enabled: !!slug },
  );

  usePageMetadata({
    title: event.data?.name ?? "Event",
    description:
      event.data?.shortDescription ?? "Tickets to an Atmos event in Pōneke.",
    canonical: `${SITE_URL}/events/${slug}`,
    // An event nobody can find without a link shouldn't turn up in a search.
    noindex: event.data ? event.data.visibility !== "PUBLIC" : true,
  });

  if (event.isPending) {
    return (
      <div
        aria-busy
        className="grid grid-cols-1 gap-10 px-5 py-12 md:px-10 lg:grid-cols-[minmax(0,1fr)_400px]"
      >
        <div className="space-y-5">
          <Skeleton className="h-14 w-2/3" />
          <Skeleton className="aspect-square max-w-md" />
        </div>
        <Skeleton className="h-80 rounded-[var(--site-r-panel)] rounded-tl-none" />
      </div>
    );
  }

  if (!event.data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-5 py-24 text-center">
        <h1 className="t-heading text-[clamp(2.25rem,7vw,5rem)]">
          Event not found
        </h1>
        <p className="max-w-[40ch] text-[15px] text-white/60">
          This event might have finished, or the link is wrong.
        </p>
        <Link href="/events" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="size-4" /> See what&apos;s on
        </Link>
      </div>
    );
  }

  const data = event.data;
  const hasFee =
    data.bookingFee.fixedCents > 0 || data.bookingFee.percentBp > 0;
  const details = [
    {
      Icon: CalendarDays,
      label: "Date",
      value: formatEventDateLong(data.startsAt, data.timezone),
    },
    {
      Icon: Clock,
      label: "Time",
      value: data.doorsAt
        ? `Doors ${formatEventTime(data.doorsAt, data.timezone)} · Starts ${formatEventTime(data.startsAt, data.timezone)}`
        : formatEventTime(data.startsAt, data.timezone),
    },
    ...(data.venueName
      ? [
          {
            Icon: MapPin,
            label: "Venue",
            value: data.venueName,
            sub: data.venueAddress,
          },
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-1 gap-10 px-5 pt-10 pb-20 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16 lg:pt-14">
      <div className="min-w-0 space-y-8">
        {data.visibility !== "PUBLIC" ? (
          <p className="flex items-start gap-3 rounded-[var(--site-r-chip)] border border-white/15 px-4 py-3 text-[14px] text-white/70">
            <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden /> This event
            isn&apos;t listed. You can see it because you have the link, so
            share it with care.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-end">
          {data.posterFileUploadId ? (
            <Media
              src={buildMediaUrl(data.posterFileUploadId)}
              alt={`${data.name} poster`}
              sizes="180px"
              className="aspect-square"
              priority
            />
          ) : null}
          <div>
            <EventOnNow start={data.startsAt} end={data.endsAt} />
            <h1 className="t-display text-[clamp(1.9rem,4.6vw,4.25rem)] [overflow-wrap:anywhere]">
              {data.name}
            </h1>
          </div>
        </div>
        {data.shortDescription ? (
          <p className="max-w-[60ch] text-[17px] text-white/70">
            {data.shortDescription}
          </p>
        ) : null}
        <dl className="divide-y divide-white/10 border-y border-white/10">
          {details.map(({ Icon, label, value, ...rest }) => (
            <div key={label} className="flex gap-4 py-4">
              <Icon
                className="mt-0.5 size-4 shrink-0 text-white/50"
                aria-hidden
              />
              <div>
                <dt className="sr-only">{label}</dt>
                <dd className="text-[15px] text-white/85">
                  {value}
                  {"sub" in rest && rest.sub ? (
                    <span className="mt-1 block text-[13px] text-white/55">
                      {rest.sub}
                    </span>
                  ) : null}
                </dd>
              </div>
            </div>
          ))}
        </dl>
        {data.descriptionLexical != null ? (
          <LexicalContent
            value={data.descriptionLexical}
            namespace={`event-description-${data.id}`}
            contentClassName="max-w-[62ch] text-[16px] leading-relaxed text-white/70 [&_a]:text-white [&_a]:underline [&_a]:underline-offset-4 [&_p]:mb-4 [&_strong]:text-white"
          />
        ) : null}
        {data.gig ? (
          <Link
            href={gigPath(data.gig)}
            className="inline-block text-[14px] text-white/60 underline underline-offset-4 hover:text-white"
          >
            More about this gig
          </Link>
        ) : null}
        {/* Fees disclosed on the page itself, not just at the payment step. */}
        {hasFee ? (
          <p className="text-[13px] text-white/50">
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
        ) : null}
      </div>
      <div className="lg:sticky lg:top-28 lg:self-start">
        <BuyPanel event={data} />
      </div>
    </div>
  );
}

/** The on-now panel above the title, only while the event is running. */
function EventOnNow({ start, end }: { start: Date; end: Date | null }) {
  const now = useMinuteClock();
  if (now === null || nightPhase({ start, end }, now) !== "on") return null;
  return (
    <div className="mb-5">
      <OnNowPanel night={{ start, end }} now={now} compact />
    </div>
  );
}
