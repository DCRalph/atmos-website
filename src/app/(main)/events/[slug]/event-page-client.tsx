"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, EyeOff, X } from "lucide-react";
import { api } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";
import {
  formatEventDate,
  formatEventDateLong,
  formatEventTime,
} from "~/lib/ticketing/dates";
import { formatNZD, formatNZDCompact } from "~/lib/ticketing/money";
import { readAttribution, visitId } from "~/lib/ticketing/attribution";
import { BuyPanel } from "~/components/ticketing/buy-panel";
import { LexicalContent } from "~/components/lexical";
import { IconButton, Skeleton, buttonVariants } from "~/components/site/ui";
import { gigPath } from "~/lib/gig-url";
import {
  OnNowPanel,
  nightPhase,
  useMinuteClock,
} from "~/components/site/on-now";
import { cn } from "~/lib/utils";

const DESKTOP = "(min-width: 1024px)";
const subscribeToDesktop = (onChange: () => void) => {
  const query = matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** True from `lg` up, where the buy panel sits in the page instead of a sheet. */
const useDesktop = () =>
  useSyncExternalStore(
    subscribeToDesktop,
    () => matchMedia(DESKTOP).matches,
    () => false,
  );

/**
 * Public event page. The poster sits whole on a blur of itself, so a small or
 * oddly shaped upload never gets stretched across the screen. Under it: what,
 * when, where, who's playing.
 *
 * Buying: on desktop the panel sticks beside the details. On a phone it's a
 * bottom sheet behind a buy bar that's always in thumb reach. It's one
 * `BuyPanel` either way, kept mounted while the sheet is shut, so closing it
 * to check the lineup doesn't drop a basket or a hold. The meta tags are
 * `page.tsx`'s.
 */
export function EventPageClient() {
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
  const gigId = event.data?.gig?.id;
  const gig = api.gigs.getById.useQuery(
    { id: gigId ?? "" },
    { enabled: !!gigId },
  );

  // One view per tab per event, with the tags the visit arrived on, so the
  // funnel starts here rather than at checkout. Fire and forget: the server
  // drops repeats and never fails the page.
  const eventId = event.data?.id;
  const { mutate: sendVisit } = api.ticketEvents.recordVisit.useMutation();
  useEffect(() => {
    const visit = eventId ? visitId() : undefined;
    if (!eventId || !visit) return;
    sendVisit({
      eventId,
      visitId: visit,
      checkpoint: "view",
      utm: readAttribution(),
    });
  }, [eventId, sendVisit]);

  const desktop = useDesktop();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (event.isPending) {
    return (
      <div aria-busy>
        <Skeleton className="h-[460px] md:h-[560px]" />
        <div className="grid grid-cols-1 gap-10 px-5 pt-8 md:px-10 lg:grid-cols-[minmax(0,1fr)_400px]">
          <Skeleton className="h-40" />
          <Skeleton className="hidden h-80 rounded-[var(--site-r-panel)] rounded-tl-none lg:block" />
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
  const feeNote =
    fees.length > 0
      ? `Prices include GST. At checkout we add ${fees.join(" and ")}.`
      : null;

  const startTime = formatEventTime(data.startsAt, data.timezone);
  // Doors and start are often the same moment; saying it twice reads as a typo.
  const doorsTime =
    data.doorsAt && data.doorsAt.getTime() !== data.startsAt.getTime()
      ? formatEventTime(data.doorsAt, data.timezone)
      : null;
  const endTime = data.endsAt
    ? formatEventTime(data.endsAt, data.timezone)
    : null;
  const facts = [
    { label: "When", value: formatEventDateLong(data.startsAt, data.timezone) },
    {
      label: "Time",
      value: [
        doorsTime ? `Doors ${doorsTime}` : null,
        endTime ? `${startTime} till ${endTime}` : `Starts ${startTime}`,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    ...(data.venueName
      ? [
          {
            label: "Where",
            value: data.venueName,
            sub: data.venueAddress,
            logo: data.venueLogoFileId,
          },
        ]
      : []),
    ...(data.isR18
      ? [{ label: "Age", value: "R18, photo ID at the door" }]
      : []),
  ];

  const lineUp = gig.data?.lineUp ?? [];
  // The bar only sells: an event that can't be bought from has nothing to put there.
  const buyable =
    data.status !== "CANCELLED" && data.status !== "SOLD_OUT" && data.onSale;

  return (
    <>
      <section className="relative overflow-hidden pt-24 pb-10 md:pt-28 md:pb-14">
        {poster ? (
          <>
            <Image
              src={poster}
              alt=""
              fill
              sizes="50vw"
              aria-hidden
              className="scale-125 object-cover opacity-55 blur-3xl saturate-150"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black" />
            {/* Its own shape, portrait or landscape, capped so the title
                still shows on a phone. */}
            <div className="relative flex justify-center px-5">
              <Image
                src={poster}
                alt={`${data.name} poster`}
                width={1200}
                height={1500}
                priority
                sizes="(min-width: 768px) 560px, 90vw"
                className="h-auto max-h-[min(52dvh,520px)] w-auto max-w-full shadow-[0_24px_48px_-12px_rgb(0_0_0/0.9)]"
              />
            </div>
          </>
        ) : null}
      </section>

      {/* DOM order is the phone order: details, then lineup, then the rest. */}
      <div className="grid grid-cols-1 gap-10 px-5 pb-36 md:px-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:pb-20">
        <div className="min-w-0 space-y-8">
          <header className="space-y-5">
            <Link
              href="/events"
              className="t-label -my-3 inline-flex items-center gap-2 py-3 text-[11px] text-white/75 hover:text-white"
            >
              <ArrowLeft className="size-4" /> All tickets
            </Link>
            {data.visibility !== "PUBLIC" ? (
              <p className="glass-dark flex w-fit items-start gap-3 rounded-[var(--site-r-chip)] px-4 py-3 text-[14px] text-white/75">
                <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden /> This
                event isn&apos;t listed. You can see it because you have the
                link, so share it with care.
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
          </header>

          <dl className="grid grid-cols-1 border-t border-white/10 sm:grid-cols-2 sm:gap-x-8">
            {facts.map(({ label, value, ...rest }) => (
              <div key={label} className="border-b border-white/10 py-4">
                <dt className="t-label text-[10px] text-white/55">{label}</dt>
                <dd className="mt-2 flex items-center gap-3 text-[15px] text-white/90">
                  {"logo" in rest && rest.logo ? (
                    // A plain img: a small, already-cached /api/media response.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={buildMediaUrl(rest.logo)}
                      alt=""
                      className="size-9 shrink-0 rounded-[var(--site-r-chip)] object-contain"
                    />
                  ) : null}
                  <span>
                    {value}
                    {"sub" in rest && rest.sub ? (
                      <span className="mt-1 block text-[13px] text-white/55">
                        {rest.sub}
                      </span>
                    ) : null}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          {lineUp.length > 0 ? (
            <section aria-labelledby="lineup-heading">
              <h2
                id="lineup-heading"
                className="t-label text-[10px] text-white/55"
              >
                Lineup
              </h2>
              <ul className="mt-4 space-y-2.5">
                {lineUp.map(({ id, artistProfile }) => (
                  <li
                    key={id}
                    className="t-display text-[clamp(1.375rem,3vw,2rem)] normal-case"
                  >
                    {artistProfile.isPublished ? (
                      <Link
                        href={`/artist/${artistProfile.handle}`}
                        className="hover:text-site-accent-text"
                      >
                        {artistProfile.displayName}
                      </Link>
                    ) : (
                      artistProfile.displayName
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

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
          {feeNote ? (
            <p className="text-[13px] text-white/50">{feeNote}</p>
          ) : null}
        </div>

        <TicketsDock
          inline={desktop || !buyable}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={`${data.name} · ${formatEventDate(data.startsAt, data.timezone)}`}
        >
          <BuyPanel
            event={data}
            className={
              desktop || !buyable ? undefined : "border-0 bg-transparent"
            }
          />
        </TicketsDock>
      </div>

      {buyable && !desktop ? (
        <div
          className={cn(
            "glass-dark fixed inset-x-0 bottom-0 z-40 flex items-center gap-4 border-x-0 border-b-0 px-5 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] transition-opacity duration-200",
            sheetOpen && "pointer-events-none opacity-0",
          )}
        >
          <div className="min-w-0">
            <p className="t-display text-[22px] whitespace-nowrap tabular-nums">
              {data.fromPriceCents === 0
                ? "Free"
                : `From ${formatNZDCompact(data.fromPriceCents ?? 0)}`}
            </p>
            <p className="mt-1.5 truncate text-[12px] text-white/60">
              {feeNote ? "Includes GST, plus fees" : "Includes GST"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
            aria-controls="tickets"
            className={cn(buttonVariants({ variant: "accent" }), "ml-auto")}
          >
            Get tickets <ArrowRight className="size-4" />
          </button>
        </div>
      ) : null}
    </>
  );
}

/**
 * Where the buy panel lives. From `lg` up it's a sticky column, and so is a
 * panel with nothing to sell (sold out, cancelled), which has to be seen
 * rather than opened. Otherwise it's a bottom sheet that stays mounted while
 * shut (inert and off screen), so the panel's basket and hold survive closing
 * it.
 */
function TicketsDock({
  inline,
  open,
  onClose,
  title,
  children,
}: {
  inline: boolean;
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !inline) sheet.current?.focus();
  }, [open, inline]);

  if (inline) {
    return (
      <div id="tickets" className="relative z-10 scroll-mt-28">
        <div className="lg:sticky lg:top-28">{children}</div>
      </div>
    );
  }

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        id="tickets"
        ref={sheet}
        role="dialog"
        aria-modal={open}
        aria-label={title}
        tabIndex={-1}
        inert={!open}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className={cn(
          "glass-dark glass-float fixed inset-x-0 bottom-0 z-[71] max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[var(--site-r-panel)] border-x-0 border-b-0 bg-black/80 pb-[env(safe-area-inset-bottom)] outline-none",
          "transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex items-center justify-between gap-4 px-5 pt-4">
          <p className="truncate text-[13px] text-white/60">{title}</p>
          <IconButton label="Close" className="size-10" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        {children}
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
