import { StaticBackground } from "~/app/_components/static-background";
import { api } from "~/trpc/server";
import { formatDate, formatTime } from "~/lib/date-utils";
import Link from "next/link";



export default async function GigsPage() {
  const [upcomingGigs, pastGigs] = await Promise.all([
    api.gigs.getUpcoming(),
    api.gigs.getPast(),
  ]);
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-6.jpg" />

      <section className="relative z-10 min-h-screen px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          {/* <div className="mb-12">
            <Link href="/" className="text-white/60 hover:text-white transition-colors">
              ← Back
            </Link>
          </div> */}

          <h1 className="mb-12 sm:mb-16 text-center text-4xl sm:text-5xl font-bold tracking-wider md:text-7xl">
            GIGS
          </h1>

          {/* Upcoming Gigs */}
          <div className="mb-16 sm:mb-20">
            <h2 className="mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4">
              Upcoming Gigs
            </h2>
            <div className="space-y-4">
              {upcomingGigs.map((gig) => (
                <div
                  key={gig.id}
                  className="group flex flex-col gap-4 rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10 md:flex-row md:items-center md:justify-between"
                >
                  <Link href={`/gigs/${gig.id}`} className="flex-1">
                    <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <span className="text-xl sm:text-2xl font-bold">
                        {formatDate(gig.date)}
                      </span>
                      <div>
                        <h3 className="text-lg sm:text-xl font-semibold">{gig.title}</h3>
                        <p className="text-white/60 text-sm sm:text-base">{gig.subtitle}</p>
                      </div>
                    </div>
                    {(gig.gigStartTime ?? gig.gigEndTime) && (
                      <p className="text-xs sm:text-sm text-white/60">
                        {gig.gigStartTime && gig.gigEndTime
                          ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                          : gig.gigStartTime
                            ? `Starts at ${formatTime(gig.gigStartTime)}`
                            : gig.gigEndTime
                              ? `Ends at ${formatTime(gig.gigEndTime)}`
                              : ""}
                      </p>
                    )}
                  </Link>
                  <div className="flex gap-2">
                    <Link
                      href={`/gigs/${gig.id}`}
                      className="rounded-md border border-white/30 bg-white/10 px-4 sm:px-6 py-2 sm:py-3 text-center font-semibold text-white transition-all hover:bg-white/20 text-sm sm:text-base"
                    >
                      View Details
                    </Link>
                    {gig.ticketLink && (
                      <a
                        href={gig.ticketLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md bg-white px-4 sm:px-6 py-2 sm:py-3 text-center font-semibold text-black transition-all hover:bg-white/90 text-sm sm:text-base"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Get Tickets
                      </a>
                    )}
                  </div>
                </div>
              ))}



            </div>
          </div>

          {/* Past Gigs */}
          <div>
            <h2 className="mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4">
              Past Gigs
            </h2>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pastGigs.map((gig) => (
                <Link
                  key={gig.id}
                  href={`/gigs/${gig.id}`}
                  className="group rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
                >
                  <h3 className="text-base sm:text-lg font-semibold mb-2">{gig.title}</h3>
                  <p className="text-white/60 text-sm sm:text-base mb-2">{gig.subtitle}</p>
                  <div className="text-lg sm:text-xl font-bold mb-2">
                    {formatDate(gig.date)}
                  </div>
                  {gig.media && (gig.media as Array<unknown>).length > 0 && (
                    <p className="text-xs sm:text-sm text-white/60">
                      {(gig.media as Array<unknown>).length} {(gig.media as Array<unknown>).length === 1 ? "media item" : "media items"}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

