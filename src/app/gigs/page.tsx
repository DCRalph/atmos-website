import { StaticBackground } from "~/app/_components/static-background";
import { api } from "~/trpc/server";



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
                  <div className="flex-1">
                    <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <span className="text-xl sm:text-2xl font-bold">
                        {gig.date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <div>
                        <h3 className="text-lg sm:text-xl font-semibold">{gig.title}</h3>
                        <p className="text-white/60 text-sm sm:text-base">{gig.subtitle}</p>
                      </div>
                    </div>
                    {gig.time && (
                      <p className="text-xs sm:text-sm text-white/60">{gig.time}</p>
                    )}
                  </div>
                  {gig.ticketLink && (
                    <a
                      href={gig.ticketLink}
                      className="rounded-md bg-white px-4 sm:px-6 py-2 sm:py-3 text-center font-semibold text-black transition-all hover:bg-white/90 text-sm sm:text-base"
                    >
                      Get Tickets
                    </a>
                  )}
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
                <div
                  key={gig.id}
                  className="rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-sm"
                >
                  <h3 className="text-base sm:text-lg font-semibold mb-2">{gig.title}</h3>
                  <p className="text-white/60 text-sm sm:text-base mb-2">{gig.subtitle}</p>
                  <div className="text-lg sm:text-xl font-bold">
                    {gig.date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

