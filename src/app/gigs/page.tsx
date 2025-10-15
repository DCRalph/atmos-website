import { ImageCycleBackground } from "~/app/_components/image-cycle-background";
import Link from "next/link";

// Example gig data - replace with actual database queries
const upcomingGigs = [
  {
    id: 1,
    date: "2025-10-15",
    venue: "The Warehouse",
    city: "Manchester",
    time: "9:00 PM",
    ticketLink: "#",
  },
  {
    id: 2,
    date: "2025-10-22",
    venue: "Electric Brixton",
    city: "London",
    time: "8:30 PM",
    ticketLink: "#",
  },
  {
    id: 3,
    date: "2025-11-05",
    venue: "O2 Academy",
    city: "Birmingham",
    time: "9:00 PM",
    ticketLink: "#",
  },
];

const pastGigs = [
  {
    id: 1,
    date: "2025-09-20",
    venue: "Printworks",
    city: "London",
  },
  {
    id: 2,
    date: "2025-09-10",
    venue: "Warehouse Project",
    city: "Manchester",
  },
  {
    id: 3,
    date: "2025-08-25",
    venue: "Motion",
    city: "Bristol",
  },
];

export default function GigsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <ImageCycleBackground intervalMs={5000} auto={true} />

      <section className="relative z-10 min-h-screen px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <Link href="/" className="text-white/60 hover:text-white transition-colors">
              ← Back
            </Link>
          </div>

          <h1 className="mb-16 text-center text-5xl font-bold tracking-wider md:text-7xl">
            GIGS
          </h1>

          {/* Upcoming Gigs */}
          <div className="mb-20">
            <h2 className="mb-8 text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-4">
              Upcoming Gigs
            </h2>
            <div className="space-y-4">
              {upcomingGigs.map((gig) => (
                <div
                  key={gig.id}
                  className="group flex flex-col gap-4 rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-4">
                      <span className="text-2xl font-bold">
                        {new Date(gig.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <div>
                        <h3 className="text-xl font-semibold">{gig.venue}</h3>
                        <p className="text-white/60">{gig.city}</p>
                      </div>
                    </div>
                    <p className="text-sm text-white/60">{gig.time}</p>
                  </div>
                  <a
                    href={gig.ticketLink}
                    className="rounded-md bg-white px-6 py-3 text-center font-semibold text-black transition-all hover:bg-white/90"
                  >
                    Get Tickets
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Past Gigs */}
          <div>
            <h2 className="mb-8 text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-4">
              Past Gigs
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pastGigs.map((gig) => (
                <div
                  key={gig.id}
                  className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
                >
                  <div className="mb-2 text-xl font-bold">
                    {new Date(gig.date).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <h3 className="text-lg font-semibold">{gig.venue}</h3>
                  <p className="text-white/60">{gig.city}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

