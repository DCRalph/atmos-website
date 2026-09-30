"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarPlus,
  Check,
  Clock,
  Expand,
  MapPin,
  Pencil,
  Play,
  Share2,
} from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { getMediaDisplayUrl } from "~/lib/media-url";
import { LexicalContent } from "~/components/lexical";
import { Lineup } from "./lineup";
import { BuyPanel } from "~/components/ticketing/buy-panel";
import { NewsletterForm } from "../newsletter-form";
import { Lightbox, useLightbox } from "../overlays";
import { Button, Media, Skeleton, buttonVariants } from "../ui";
import {
  AdminStrip,
  CtaPill,
  TbaPoster,
  fmtLong,
  fmtTime,
  gigTitle,
  isPast,
  isTba,
  ticketCta,
  type DetailGig,
} from "./gig-parts";
import { OnNowPanel, nightOf, nightPhase, useMinuteClock } from "../on-now";

/** Date, time (upcoming only) and venue. */
function MetaLine({ gig, past }: { gig: DetailGig; past: boolean }) {
  if (isTba(gig))
    return (
      <p className="t-label text-[12px] text-white/70">
        Date and venue to be announced
      </p>
    );
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-white/80">
      <div>
        <dt className="sr-only">Date</dt>
        <dd className="t-label text-[12px]">{fmtLong(gig.gigStartTime)}</dd>
      </div>
      {!past ? (
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-white/55" aria-hidden />
          <dt className="sr-only">Time</dt>
          <dd className="t-label text-[12px]">
            {gig.gigEndTime
              ? `${fmtTime(gig.gigStartTime)} to ${fmtTime(gig.gigEndTime)}`
              : `Starts ${fmtTime(gig.gigStartTime)}`}
          </dd>
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        <MapPin className="size-3.5 text-white/55" aria-hidden />
        <dt className="sr-only">Venue</dt>
        <dd className="t-label text-[12px]">{gig.subtitle}</dd>
      </div>
    </dl>
  );
}

function Tags({ gig }: { gig: DetailGig }) {
  if (!gig.gigTags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {gig.gigTags.map(({ gigTag }) => (
        <li
          key={gigTag.id}
          className="t-label flex items-center gap-1.5 rounded-[var(--site-r-chip)] border border-white/25 px-2 py-1 text-[10px] text-white/75"
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: gigTag.color }}
            aria-hidden
          />
          {gigTag.name}
        </li>
      ))}
    </ul>
  );
}

/** Downloads an .ics for the gig, in UTC so every calendar places it right. */
function downloadIcs(gig: DetailGig) {
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const end =
    gig.gigEndTime ?? new Date(gig.gigStartTime.getTime() + 5 * 3600_000);
  const escape = (text: string) => text.replace(/[,;\\]/g, (c) => `\\${c}`);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atmos//Gig//EN",
    "BEGIN:VEVENT",
    `UID:${gig.id}@atmosmedia.co.nz`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(gig.gigStartTime)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(gig.title)}`,
    `LOCATION:${escape(gig.subtitle)}`,
    `URL:${window.location.href.split("#")[0]}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: "atmos-gig.ics",
  });
  a.click();
  URL.revokeObjectURL(url);
}

function Actions({
  gig,
  past,
  isAdmin,
  onPoster,
}: {
  gig: DetailGig;
  past: boolean;
  isAdmin: boolean;
  onPoster?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href.split("#")[0] ?? window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: gig.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // A cancelled share sheet lands here too; only a failed copy is worth saying.
      if (!navigator.share) toast.error("Couldn't copy the link");
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {onPoster ? (
        <Button variant="outline" size="sm" className="h-10" onClick={onPoster}>
          <Expand className="size-4" /> Poster
        </Button>
      ) : null}
      {!isTba(gig) ? (
        <Button
          variant="outline"
          size="sm"
          className="h-10"
          onClick={() => void share()}
        >
          {copied ? (
            <Check className="size-4" />
          ) : (
            <Share2 className="size-4" />
          )}{" "}
          {copied ? "Copied" : "Share"}
        </Button>
      ) : null}
      {!isTba(gig) && !past ? (
        <Button
          variant="outline"
          size="sm"
          className="h-10"
          onClick={() => downloadIcs(gig)}
        >
          <CalendarPlus className="size-4" /> Calendar
        </Button>
      ) : null}
      {isAdmin ? (
        <Link
          href={`/admin/gigs/${gig.id}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-10 border-[var(--site-warn)]/60 text-[var(--site-warn)]",
          )}
        >
          <Pencil className="size-4" /> Edit
        </Link>
      ) : null}
    </div>
  );
}

/** What sits where tickets go: the buy panel, an outbound link, or nothing. */
function TicketsBlock({ gig }: { gig: DetailGig }) {
  const event = api.ticketEvents.forGig.useQuery({ gigId: gig.id });
  if (event.isPending)
    return (
      <Skeleton className="h-72 rounded-[var(--site-r-panel)] rounded-tl-none" />
    );
  if (event.data) return <BuyPanel event={event.data} />;
  if (gig.ticketLink) {
    return (
      <section
        aria-label="Tickets"
        className="space-y-4 rounded-[var(--site-r-panel)] rounded-tl-none border border-white/12 bg-white/[0.03] p-5"
      >
        <p className="t-label text-[12px]">Tickets</p>
        <p className="text-[14px] text-white/70">
          Tickets for this one are sold on another site.
        </p>
        <a
          href={gig.ticketLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Get tickets <ArrowUpRight className="size-4" />
        </a>
      </section>
    );
  }
  return null;
}

/** Past gig photos and videos; photos open the lightbox. */
function Gallery({ gig }: { gig: DetailGig }) {
  const lb = useLightbox();
  const photos = gig.media
    .filter((m) => m.type === "photo")
    .map((m, i) => ({
      id: m.id,
      src: getMediaDisplayUrl(m),
      alt: `${gig.title}, photo ${i + 1}`,
    }));
  const videos = gig.media
    .filter((m) => m.type === "video")
    .map((m) => ({ id: m.id, src: getMediaDisplayUrl(m) }));

  if (!photos.length && !videos.length) {
    return (
      <p className="border border-white/10 px-6 py-10 text-center text-[15px] text-white/60">
        No photos from this one yet.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="t-heading text-[clamp(1.75rem,3.5vw,2.75rem)]">
          Photos
        </h2>
        <span className="t-label text-[11px] text-white/60 tabular-nums">
          {photos.length + videos.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {photos.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => lb.open(i)}
            aria-label={`Open photo ${i + 1}`}
            className={cn(
              "relative overflow-hidden bg-white/5",
              i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square",
            )}
          >
            <Image
              src={m.src}
              alt=""
              fill
              sizes="(min-width: 768px) 25vw, 50vw"
              className="object-cover transition-transform duration-500 ease-out hover:scale-[1.03]"
            />
          </button>
        ))}
        {videos.map((v) => (
          <div
            key={v.id}
            className="relative col-span-2 aspect-video bg-white/5"
          >
            <video
              src={v.src}
              controls
              playsInline
              preload="metadata"
              className="size-full object-cover"
            />
            <Play
              className="pointer-events-none absolute top-3 left-3 size-4 text-white/70"
              aria-hidden
            />
          </div>
        ))}
      </div>
      <Lightbox images={photos} {...lb.props} />
    </div>
  );
}

function LoadingView() {
  return (
    <div
      aria-busy
      className="grid grid-cols-1 gap-10 px-5 pt-10 pb-20 md:px-10 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]"
    >
      <Skeleton className="aspect-[4/5]" />
      <div className="space-y-5">
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-4 w-1/2 rounded-full" />
        <Skeleton className="h-4 w-1/3 rounded-full" />
        <Skeleton className="mt-10 h-64 w-full max-w-[420px] rounded-[var(--site-r-panel)] rounded-tl-none" />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-5 py-24 text-center">
      <h1 className="t-heading text-[clamp(2.25rem,7vw,5rem)]">
        Gig not found
      </h1>
      <p className="max-w-[40ch] text-[15px] text-white/60">
        The event you&apos;re looking for may have been removed, or the link is
        wrong.
      </p>
      <Link href="/gigs" className={buttonVariants({ variant: "outline" })}>
        <ArrowLeft className="size-4" /> Back to gigs
      </Link>
    </div>
  );
}

/**
 * A gig's public page: poster held on the left, facts and tickets on the
 * right, the recap gallery once it's over. TBA gigs keep their secret.
 */
export function GigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: gig, isPending } = api.gigs.getById.useQuery({ id });
  const { data: viewer } = api.user.me.useQuery();
  const isAdmin = viewer?.effectivePermissions.includes("ADMIN") ?? false;
  const lb = useLightbox();

  if (isPending) return <LoadingView />;
  if (!gig) return <NotFound />;

  const tba = isTba(gig);
  const past = isPast(gig);
  const poster = gig.posterFileUpload?.url ?? null;

  return (
    <>
      {isAdmin ? <AdminStrip gig={gig} className="py-2 text-[10px]" /> : null}
      <div className="px-5 pt-8 md:px-10">
        <Link
          href="/gigs"
          className="t-label inline-flex items-center gap-2 text-[11px] text-white/70 hover:text-white"
        >
          <ArrowLeft className="size-4" /> All gigs
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-8 px-5 pt-6 pb-14 md:px-10 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-14">
        <div className="lg:sticky lg:top-28 lg:self-start">
          {tba ? (
            <TbaPoster src={poster} className="aspect-[4/5]" size="text-7xl" />
          ) : poster ? (
            <button
              type="button"
              onClick={() => lb.open(0)}
              aria-label="View poster full screen"
              className="group relative block w-full"
            >
              <Media
                src={poster}
                alt={`${gig.title} poster`}
                sizes="440px"
                className="aspect-[4/5]"
                priority
              />
              <span className="glass absolute right-3 bottom-3 flex size-10 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Expand className="size-4" />
              </span>
            </button>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <div className="space-y-5">
            <h1 className="t-display text-[clamp(1.9rem,5.2vw,5rem)] [overflow-wrap:anywhere]">
              {gigTitle(gig)}
            </h1>
            <MetaLine gig={gig} past={past} />
            {!tba ? <OnNowIfRunning gig={gig} /> : null}
            <Tags gig={gig} />
            <div className="flex flex-wrap items-center gap-3">
              {!tba && !past ? <TicketCta gig={gig} /> : null}
              <Actions
                gig={gig}
                past={past}
                isAdmin={isAdmin}
                onPoster={poster && !tba ? () => lb.open(0) : undefined}
              />
            </div>
          </div>

          {tba ? (
            <div className="space-y-4 border-t border-white/10 pt-8">
              <p className="max-w-[44ch] text-[16px] text-white/70">
                Something&apos;s coming. The line-up, date and venue drop here
                first, then to the list.
              </p>
              <NewsletterForm cta="Tell me first" className="max-w-[440px]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-10 border-t border-white/10 pt-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
              <div className="min-w-0 space-y-10">
                {gig.descriptionLexical ? (
                  <LexicalContent
                    value={gig.descriptionLexical}
                    namespace={`gig-description-${gig.id}`}
                    contentClassName="max-w-[62ch] text-[16px] leading-relaxed text-white/75 md:text-[17px] [&_a]:text-white [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_li]:mb-1 [&_p]:mb-4 [&_strong]:text-white [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
                  />
                ) : gig.shortDescription ? (
                  <p className="max-w-[62ch] text-[16px] leading-relaxed text-white/75 md:text-[17px]">
                    {gig.shortDescription}
                  </p>
                ) : null}
                <Lineup gig={gig} />
              </div>
              {!past ? (
                <div
                  id="tickets"
                  className="scroll-mt-28 xl:sticky xl:top-28 xl:self-start"
                >
                  <TicketsBlock gig={gig} />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {past ? (
        <section className="px-5 pb-20 md:px-10">
          <Gallery gig={gig} />
        </section>
      ) : null}

      {poster && !tba ? (
        <Lightbox
          images={[{ src: poster, alt: `${gig.title} poster` }]}
          {...lb.props}
        />
      ) : null}
    </>
  );
}

/** Hero call to action: jumps to the buy panel, or out to the external seller. */
function TicketCta({ gig }: { gig: DetailGig }) {
  const event = api.ticketEvents.forGig.useQuery({ gigId: gig.id });
  if (event.isPending) return null;
  const cta = ticketCta(gig, event.data ?? undefined);
  if (!cta.href)
    return cta.tone === "muted" ? <CtaPill cta={cta} size="md" /> : null;
  const external = cta.tone === "external";
  return (
    <a
      href={external ? cta.href : "#tickets"}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group"
    >
      <CtaPill cta={cta} size="md" />
    </a>
  );
}

/** The on-now panel, only while the gig is running. */
function OnNowIfRunning({ gig }: { gig: DetailGig }) {
  const now = useMinuteClock();
  const night = nightOf(gig);
  if (now === null || nightPhase(night, now) !== "on") return null;
  return <OnNowPanel night={night} now={now} />;
}
