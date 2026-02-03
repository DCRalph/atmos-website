"use client";

import { use } from "react";
import { StaticBackground } from "~/components/static-background";
import { api } from "~/trpc/react";
import { formatDate, formatTime, isGigPast } from "~/lib/date-utils";
import { MediaGallery } from "../../../../components/gigs/media-gallery";
import { MarkdownContent } from "../../../../components/markdown-content";
import Link from "next/link";
import { authClient } from "~/lib/auth-client";
import { ArrowLeft, Calendar, Clock, Loader2, Pencil, Ticket } from "lucide-react";
import { GigTagList } from "~/components/gig-tag-list";
import Image from "next/image";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function GigPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: gig, isLoading } = api.gigs.getById.useQuery({ id });
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  if (isLoading) {
    return (
      <main className="bg-black text-white">
        <StaticBackground imageSrc="/home/atmos-6.jpg" />
        <section className="relative z-10 min-h-dvh px-4 pb-8 pt-2">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-center border-2 border-white/10 bg-black/80 py-12 backdrop-blur-sm">
              <Loader2 className="text-accent-muted h-6 w-6 animate-spin" />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!gig) {
    return (
      <main className="bg-black text-white">
        <StaticBackground imageSrc="/home/atmos-6.jpg" />
        <section className="relative z-10 min-h-dvh px-4 pb-8 pt-2">
          <div className="mx-auto max-w-6xl">
            <div className="border-2 border-white/10 bg-black/80 p-8 text-center backdrop-blur-sm">
              <h2 className="text-2xl font-black tracking-wider uppercase sm:text-3xl">
                Gig not found
              </h2>
              <p className="mt-2 text-sm text-white/60">
                The event you are looking for may have been removed.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const isTba = gig.mode === "TO_BE_ANNOUNCED";
  const displayTitle = isTba ? "TBA..." : gig.title;
  const upcoming = !isGigPast(gig);
  const hasMedia = !isTba && gig.media && gig.media.length > 0;
  const hasPoster = !!gig.posterFileUpload?.url;

  if (isTba) {
    return (
      <main className="bg-black text-white">
        <StaticBackground imageSrc="/home/atmos-6.jpg" />

        <section className="relative z-10 min-h-dvh px-4 py-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex gap-4">
              <Link
                href="/gigs"
                className="group flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-sm font-black tracking-wider text-white uppercase transition-all hover:border-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Back to Gigs
              </Link>
              {isAdmin && (
                <Link
                  href={`/admin/gigs/${id}`}
                  className="group flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-sm font-black tracking-wider text-white uppercase transition-all hover:border-white hover:bg-white/10"
                >
                  <Pencil className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                  Manage Gig
                </Link>
              )}
            </div>

            <div className="hover:border-accent-muted/50 group relative overflow-hidden border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all sm:p-8 md:p-10">
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="from-accent-muted/10 absolute inset-0 bg-linear-to-br via-transparent to-transparent" />
                <div className="bg-accent-muted/20 absolute top-0 -right-24 h-72 w-72 rounded-full blur-3xl" />
              </div>

              <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
                <div>
                  <h1 className="text-3xl font-black tracking-tight uppercase sm:text-4xl md:text-5xl">
                    {displayTitle}
                  </h1>
                </div>
                {hasPoster && (
                  <div className="hover:border-accent-muted/50 relative aspect-3/4 w-full overflow-hidden rounded-none border-2 border-white/10 bg-black/20 transition-all">
                    <Image
                      src={gig.posterFileUpload!.url}
                      alt="TBA poster"
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover blur-md"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-6.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-10">
        <div className="mx-auto max-w-6xl">
          {/* Navigation */}
          <div className="mb-8 flex gap-4">
            <Link
              href="/gigs"
              className="group flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-sm font-black tracking-wider text-white uppercase transition-all hover:border-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to Gigs
            </Link>
            {isAdmin && (
              <Link
                href={`/admin/gigs/${id}`}
                className="group flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-sm font-black tracking-wider text-white uppercase transition-all hover:border-white hover:bg-white/10"
              >
                <Pencil className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Manage Gig
              </Link>
            )}
          </div>

          {/* Gig Header Card */}
          <div className="hover:border-accent-muted/50 group relative mb-8 overflow-hidden border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all sm:p-8 md:p-10">
            {/* Glow effect */}
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="from-accent-muted/10 absolute inset-0 bg-linear-to-br via-transparent to-transparent" />
              <div className="bg-accent-muted/20 absolute top-0 -right-24 h-72 w-72 rounded-full blur-3xl" />
            </div>

            <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
              {/* Left side - Details */}
              <div>
                <div className="text-accent-muted mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <span className="text-xl font-black tracking-wider uppercase sm:text-2xl">
                    {formatDate(gig.gigStartTime, "long")}
                  </span>
                </div>

                <h1 className="mb-4 text-3xl font-black tracking-tight uppercase sm:text-4xl md:text-5xl">
                  {displayTitle}
                </h1>

                <p className="mb-6 text-lg font-medium text-white/70 sm:text-xl">
                  {gig.subtitle}
                </p>

                {/* Tags */}
                <GigTagList gigTags={gig.gigTags} className="mb-6" size="md" />

                {/* Description */}
                {gig.longDescription && (
                  <div className="border-accent-strong border-l-4 py-2 pl-4">
                    <MarkdownContent content={String(gig.longDescription)} />
                  </div>
                )}
              </div>

              {/* Right side - Poster + Featured Photos Carousel */}
              <div className="flex flex-col gap-4">
                {hasPoster && (
                  <div className="hover:border-accent-muted/50 relative aspect-3/4 w-full overflow-hidden rounded-none border-2 border-white/10 bg-black/20 transition-all">
                    <Image
                      src={gig.posterFileUpload!.url}
                      alt={`${gig.title} poster`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                )}


              </div>
            </div>
          </div>

          {/* Event Details Section */}
          {upcoming && (
            <div className="hover:border-accent-muted/50 mb-8 border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all sm:p-8">
              <h2 className="border-accent-strong mb-6 border-l-4 pl-4 text-2xl font-black tracking-wider uppercase sm:text-3xl">
                Event Details
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
                    <Calendar className="text-accent-muted h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-wider text-white/60 uppercase">
                      Date
                    </h3>
                    <p className="text-lg font-bold">
                      {formatDate(gig.gigStartTime, "long")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
                    <Clock className="text-accent-muted h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-wider text-white/60 uppercase">
                      Time
                    </h3>
                    <p className="text-lg font-bold">
                      {gig.gigEndTime
                        ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                        : `Starts at ${formatTime(gig.gigStartTime)}`}
                    </p>
                  </div>
                </div>

                {gig.ticketLink && (
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
                      <Ticket className="text-accent-muted h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-sm font-bold tracking-wider text-white/60 uppercase">
                        Tickets
                      </h3>
                      <Link
                        href={gig.ticketLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-accent-muted text-white underline underline-offset-4 transition-colors"
                      >
                        {gig.ticketLink}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Past Gig Without Media */}
          {!upcoming && !hasMedia && (
            <div className="space-y-6">
              <div className="hover:border-accent-muted/50 border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all sm:p-8">
                <h2 className="border-accent-strong mb-6 border-l-4 pl-4 text-2xl font-black tracking-wider uppercase sm:text-3xl">
                  Event Details
                </h2>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
                      <Calendar className="text-accent-muted h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-wider text-white/60 uppercase">
                        Date
                      </h3>
                      <p className="text-lg font-bold">
                        {formatDate(gig.gigStartTime, "long")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
                      <Clock className="text-accent-muted h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-wider text-white/60 uppercase">
                        Time
                      </h3>
                      <p className="text-lg font-bold">
                        {gig.gigEndTime
                          ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                          : `Started at ${formatTime(gig.gigStartTime)}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coming Soon Message */}
              <div className="border-2 border-white/10 bg-black/80 p-8 text-center backdrop-blur-sm">
                <h2 className="mb-4 text-2xl font-black tracking-wider uppercase sm:text-3xl">
                  Photos & Videos
                </h2>
                <p className="text-lg font-bold tracking-wider text-white/60 uppercase">
                  Coming Soon
                </p>
              </div>
            </div>
          )}

          {/* Past Gig With Media */}
          {!upcoming && hasMedia && (
            <div className="space-y-8">
              <div className="hover:border-accent-muted/50 border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all sm:p-8">
                <h2 className="border-accent-strong mb-4 border-l-4 pl-4 text-2xl font-black tracking-wider uppercase sm:text-3xl">
                  Event Details
                </h2>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-accent-muted h-4 w-4" />
                    <span className="text-sm font-bold tracking-wider text-white/60 uppercase">
                      Date:
                    </span>
                    <span className="text-base font-bold">
                      {formatDate(gig.gigStartTime, "long")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="text-accent-muted h-4 w-4" />
                    <span className="text-sm font-bold tracking-wider text-white/60 uppercase">
                      Time:
                    </span>
                    <span className="text-base font-bold">
                      {gig.gigEndTime
                        ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                        : `Started at ${formatTime(gig.gigStartTime)}`}
                    </span>
                  </div>
                </div>
              </div>

              <MediaGallery media={gig.media} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
