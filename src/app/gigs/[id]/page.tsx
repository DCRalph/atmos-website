import { notFound } from "next/navigation";
import { StaticBackground } from "~/app/_components/static-background";
import { api } from "~/trpc/server";
import { formatDate, formatTime, isGigPast } from "~/lib/date-utils";
import { MediaGallery } from "../_components/media-gallery";
import { MarkdownContent } from "../_components/markdown-content";
import Link from "next/link";
import { Button } from "~/components/ui/button";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function GigPage({ params }: PageProps) {
  const { id } = await params;
  const gig = await api.gigs.getById({ id });

  if (!gig) {
    notFound();
  }

  const upcoming = !isGigPast(gig);

  const hasMedia = gig.media && gig.media.length > 0;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-6.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <Link
                href="/gigs"
                className="text-white/60 hover:text-white transition-colors inline-flex items-center gap-2"
              >
                ← Back to Gigs
              </Link>
            </Button>
          </div>

          {/* Gig Header */}
          <div className="mb-12">
            <div className="mb-4">
              <span className="text-xl sm:text-2xl font-bold text-white/80">
                {formatDate(gig.date, "long")}
              </span>
            </div>
            <h1 className="mb-4 text-4xl sm:text-5xl font-bold tracking-wider md:text-6xl">
              {gig.title}
            </h1>
            <p className="text-xl sm:text-2xl text-white/80 mb-6">{gig.subtitle}</p>
            {gig.description && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-sm">
                <MarkdownContent content={String(gig.description)} />
              </div>
            )}
          </div>

          {/* Upcoming Gig - Detailed Information */}
          {upcoming && (
            <div className="space-y-8">
              <div className="rounded-lg border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-sm">
                <h2 className="mb-6 text-2xl sm:text-3xl font-bold tracking-wide">
                  Event Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                      Date
                    </h3>
                    <p className="text-lg">{formatDate(gig.date, "long")}</p>
                  </div>

                  {(gig.gigStartTime ?? gig.gigEndTime) && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                        Time
                      </h3>
                      <p className="text-lg">
                        {gig.gigStartTime && gig.gigEndTime
                          ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                          : gig.gigStartTime
                            ? `Starts at ${formatTime(gig.gigStartTime)}`
                            : gig.gigEndTime
                              ? `Ends at ${formatTime(gig.gigEndTime)}`
                              : ""}
                      </p>
                    </div>
                  )}

                  {gig.ticketLink && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                        Tickets
                      </h3>
                      <a
                        href={gig.ticketLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded-md bg-white px-6 py-3 text-center font-semibold text-black transition-all hover:bg-white/90"
                      >
                        Get Tickets
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Past Gig Without Media - Show Most Details */}
          {!upcoming && !hasMedia && (
            <div className="space-y-8">
              <div className="rounded-lg border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-sm">
                <h2 className="mb-6 text-2xl sm:text-3xl font-bold tracking-wide">
                  Event Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                      Date
                    </h3>
                    <p className="text-lg">{formatDate(gig.date, "long")}</p>
                  </div>

                  {(gig.gigStartTime ?? gig.gigEndTime) && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                        Time
                      </h3>
                      <p className="text-lg">
                        {gig.gigStartTime && gig.gigEndTime
                          ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                          : gig.gigStartTime
                            ? `Started at ${formatTime(gig.gigStartTime)}`
                            : gig.gigEndTime
                              ? `Ended at ${formatTime(gig.gigEndTime)}`
                              : ""}
                      </p>
                    </div>
                  )}

                  {gig.ticketLink && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                        Ticket Link
                      </h3>
                      <a
                        href={gig.ticketLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/80 hover:text-white underline"
                      >
                        View Original Ticket Link
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Coming Soon Message */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-sm text-center">
                <h2 className="mb-4 text-2xl sm:text-3xl font-bold tracking-wide">
                  Photos and Videos
                </h2>
                <p className="text-lg text-white/80">Coming Soon</p>
              </div>
            </div>
          )}

          {/* Past Gig With Media - Show Media Gallery */}
          {!upcoming && hasMedia && (
            <div className="space-y-8">
              <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-sm">
                <h2 className="mb-4 text-2xl sm:text-3xl font-bold tracking-wide">
                  Event Details
                </h2>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-semibold uppercase tracking-wide text-white/60">
                      Date:{" "}
                    </span>
                    <span className="text-lg">{formatDate(gig.date, "long")}</span>
                  </div>
                  {(gig.gigStartTime ?? gig.gigEndTime) && (
                    <div>
                      <span className="text-sm font-semibold uppercase tracking-wide text-white/60">
                        Time:{" "}
                      </span>
                      <span className="text-lg">
                        {gig.gigStartTime && gig.gigEndTime
                          ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                          : gig.gigStartTime
                            ? `Started at ${formatTime(gig.gigStartTime)}`
                            : gig.gigEndTime
                              ? `Ended at ${formatTime(gig.gigEndTime)}`
                              : ""}
                      </span>
                    </div>
                  )}
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

