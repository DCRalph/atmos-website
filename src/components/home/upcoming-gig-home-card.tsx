"use client";

import Link from "next/link";
import { formatDate, formatTime } from "~/lib/date-utils";
import { AccentGlowCard } from "~/components/ui/accent-glow-card";
import Image from "next/image";

type Gig = {
  id: string;
  gigStartTime: Date;
  title: string;
  subtitle: string;
  gigEndTime?: Date | null;
  ticketLink?: string | null;
  posterFileUpload?: { url: string } | null;
  gigTags?: Array<{
    gigTag: { id: string; name: string; color: string };
  }> | null;
};

type UpcomingGigCardProps = {
  gig: Gig;
};


export function UpcomingGigHomeCard({ gig }: UpcomingGigCardProps) {
  const posterUrl = gig.posterFileUpload?.url ?? null;

  return (
    <AccentGlowCard
      // className="p-6 flex w-full h-full flex-col gap-4 md:flex-row"
      innerClassName="flex w-full h-full flex-col gap-4 md:flex-row"
      // motionClassName="w-full"
      motionProps={{
        initial: { opacity: 0, y: "200px" },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.1 },
        transition: { duration: 0.5, ease: "easeOut" },
      }}
    >
      {posterUrl && (
        <Link href={`/gigs/${gig.id}`} className="hidden md:block">
          <div className="flex flex-col gap-6 md:flex-row md:items-stretch">
            <div className="relative min-h-56 w-full shrink-0 overflow-hidden rounded-none border-2 border-white/10 bg-black/20 md:w-48">
              <Image
                src={posterUrl}
                alt={`${gig.title} poster`}
                fill
                sizes="(max-width: 768px) 100vw, 192px"
                className="object-contain"
              />
            </div>
          </div>
        </Link>
      )}

      <div className="flex w-full flex-col justify-between gap-4">
        <div className="flex flex-1 flex-col gap-6 md:flex-row md:items-start">
          <div className="flex shrink-0 flex-col items-start md:w-40">
            <div className="text-4xl leading-none font-black tracking-tight text-white uppercase md:text-5xl">
              {formatDate(gig.gigStartTime)}
            </div>
            <div className="text-accent-strong mt-2 text-sm font-bold tracking-wider uppercase">
              {gig.gigEndTime
                ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                : `${formatTime(gig.gigStartTime)}`}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-2xl leading-tight font-black tracking-tight text-white uppercase md:text-3xl">
                {gig.title}
              </h3>
              <p className="mt-2 text-base font-medium text-white/70 md:text-lg">
                {gig.subtitle}
              </p>
            </div>

            {/* <GigTagList gigTags={gig.gigTags} size="sm" /> */}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
          <Link
            href={`/gigs/${gig.id}`}
            className="flex-1 rounded-none border-2 border-white/30 bg-transparent px-6 py-3 text-center text-sm font-black tracking-wider text-white uppercase transition-all hover:border-white hover:bg-white/10 sm:flex-none"
          >
            View Details
          </Link>
          {gig.ticketLink && (
            <a
              href={gig.ticketLink}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-accent-strong hover:bg-accent-muted flex-1 rounded-none px-6 py-3 text-center text-sm font-black tracking-wider text-white uppercase transition-all hover:shadow-[0_0_20px_var(--accent-muted)] sm:flex-none"
              onClick={(e) => e.stopPropagation()}
            >
              Get Tickets
            </a>
          )}
        </div>
      </div>

      {posterUrl && (
        <Link href={`/gigs/${gig.id}`} className="block md:hidden">
          <div className="relative min-h-96 w-full shrink-0 overflow-hidden rounded-none border-2 border-white/10 bg-black/20">
            <Image
              src={posterUrl}
              alt={`${gig.title} poster`}
              fill
              sizes="(max-width: 768px) 100vw, 192px"
              className="object-contain"
            />
          </div>
        </Link>
      )}

    </AccentGlowCard >
  );
}
