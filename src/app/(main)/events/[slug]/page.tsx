"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, EyeOff } from "lucide-react";
import { api } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";
import {
  formatEventDate,
  formatEventDateLong,
  formatEventTime,
} from "~/lib/ticketing/dates";
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
import { cn } from "~/lib/utils";

/**
 * Public event page. Opens on the poster full bleed; on desktop the buy panel
 * is glass lifting up over the bottom of it, then sticks as you scroll.
 */
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
    description: event.data?.shortDescription ?? "Tickets to an Atmos event.",
    canonical: `${SITE_URL}/events/${slug}`,
    // An event nobody can find without a link shouldn't turn up in a search.
    noindex: event.data ? event.data.visibility !== "PUBLIC" : true,
  });

  if (event.isPending) {
    return (
      <div aria-busy>
        <Skeleton className="h-[520px] md:h-[620px]" />
        <div className="grid grid-cols-1 gap-10 px-5 pt-8 md:px-10 lg:grid-cols-[minmax(0,1fr)_400px]">
          <Skeleton className="h-40" />
          <Skeleton className="h-80 rounded-[var(--site-r-panel)] rounded-tl-none" />
        </div>
      </div>
    );
  }

  if (!event.data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-5 pt-40 pb-24 text-center">
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
  const poster = data.posterFileUploadId
    ? buildMediaUrl(data.posterFileUploadId)
    : null;
  // Every unavoidable fee, disclosed on the page and not just at checkout.
  const { fixedCents, percentBp } = data.bookingFee;
  const fees: string[] = [];
  if (data.venueFeePerTicketCents > 0) {
    fees.push(
      `a ${formatNZD(data.venueFeePerTicketCents)} venue booking fee per ticket`,
    );
  }
  if (fixedCents > 0 || percentBp > 0) {
    const parts: string[] = [];
    if (fixedCents > 0) parts.push(`${formatNZD(fixedCents)} per ticket`);
    if (percentBp > 0) parts.push(`${percentBp / 100}%`);
    fees.push(`a booking fee of ${parts.join(" plus ")}`);
  }
  const startTime = formatEventTime(data.startsAt, data.timezone);
  const doorsTime = data.doorsAt
    ? formatEventTime(data.doorsAt, data.timezone)
    : null;
  const facts = [
    { label: "When", value: formatEventDateLong(data.startsAt, data.timezone) },
    {
      label: "Time",
      value: doorsTime ? `Doors ${doorsTime} · Starts ${startTime}` : startTime,
    },
    ...(data.venueName
      ? [{ label: "Where", value: data.venueName, sub: data.venueAddress }]
      : []),
    ...(data.isR18
      ? [{ label: "Age", value: "R18, photo ID at the door" }]
      : []),
  ];

  return (
    <>
      <section
        className={cn(
          "relative flex flex-col justify-end overflow-hidden",
          poster ? "min-h-[520px] md:min-h-[620px]" : "pt-32 md:pt-40",
        )}
      >
        {poster ? (
          <>
            <Media
              src={poster}
              alt={`${data.name} poster`}
              sizes="100vw"
              className="absolute inset-0"
              priority
            />
            <div className="scrim-bottom absolute inset-0" />
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
          </>
        ) : null}
        {/* Clear of the panel that lifts into the bottom right on desktop. */}
        <div
          className={cn(
            "relative space-y-5 px-5 pt-28 pb-10 md:px-10 md:pb-14",
            poster && "lg:pr-[496px]",
          )}
        >
          <Link
            href="/events"
            className="t-label inline-flex items-center gap-2 text-[11px] text-white/75 hover:text-white"
          >
            <ArrowLeft className="size-4" /> All tickets
          </Link>
          {data.visibility !== "PUBLIC" ? (
            <p className="glass-dark flex w-fit items-start gap-3 rounded-[var(--site-r-chip)] px-4 py-3 text-[14px] text-white/75">
              <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden /> This
              event isn&apos;t listed. You can see it because you have the link,
              so share it with care.
            </p>
          ) : null}
          <EventOnNow start={data.startsAt} end={data.endsAt} />
          <h1 className="t-display max-w-[16ch] text-[clamp(2rem,6.4vw,5.5rem)] [overflow-wrap:anywhere] normal-case">
            {data.name}
          </h1>
          <p className="t-label text-[12px] text-white/85 md:text-[13px]">
            {[
              formatEventDate(data.startsAt, data.timezone),
              data.venueName,
              doorsTime ? `Doors ${doorsTime}` : startTime,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </section>

      {/* DOM order is the phone order: facts, then tickets, then the rest. */}
      <div className="grid grid-cols-1 gap-10 px-5 pt-8 pb-20 md:px-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14">
        <dl className="grid grid-cols-1 border-t border-white/10 sm:grid-cols-2 sm:gap-x-8 lg:col-start-1 lg:row-start-1">
          {facts.map(({ label, value, ...rest }) => (
            <div key={label} className="border-b border-white/10 py-4">
              <dt className="t-label text-[10px] text-white/55">{label}</dt>
              <dd className="mt-2 text-[15px] text-white/90">
                {value}
                {"sub" in rest && rest.sub ? (
                  <span className="mt-1 block text-[13px] text-white/55">
                    {rest.sub}
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>

        <div
          id="tickets"
          className={cn(
            "relative z-10 scroll-mt-28 lg:col-start-2 lg:row-span-2 lg:row-start-1",
            poster && "lg:-mt-64",
          )}
        >
          <div className="lg:sticky lg:top-28">
            <BuyPanel
              event={data}
              className={
                poster ? "glass-dark glass-float bg-black/60" : undefined
              }
            />
          </div>
        </div>

        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
          {data.shortDescription ? (
            <p className="max-w-[60ch] text-[17px] text-white/75">
              {data.shortDescription}
            </p>
          ) : null}
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
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              More about this gig <ArrowRight className="size-4" />
            </Link>
          ) : null}
          {fees.length > 0 ? (
            <p className="text-[13px] text-white/50">
              Prices include GST. At checkout we add {fees.join(" and ")}.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** The on-now panel above the title, only while the event is running. */
function EventOnNow({ start, end }: { start: Date; end: Date | null }) {
  const now = useMinuteClock();
  if (now === null || nightPhase({ start, end }, now) !== "on") return null;
  return (
    <div>
      <OnNowPanel night={{ start, end }} now={now} compact />
    </div>
  );
}
