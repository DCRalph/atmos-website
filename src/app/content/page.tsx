import { ImageCycleBackground } from "~/app/_components/image-cycle-background";
import Link from "next/link";

// Example content - replace with actual data
const contentItems = [
  {
    id: 1,
    type: "mix",
    title: "Atmos Mix Vol. 1",
    description: "Deep house and techno vibes for late night sessions",
    date: "2025-10-01",
    link: "#",
  },
  {
    id: 2,
    type: "video",
    title: "Behind the Decks",
    description: "Studio session featuring our latest tracks",
    date: "2025-09-25",
    link: "#",
  },
  {
    id: 3,
    type: "playlist",
    title: "Atmos Selects",
    description: "Curated selection of tracks we're playing out right now",
    date: "2025-09-20",
    link: "#",
  },
  {
    id: 4,
    type: "mix",
    title: "Live @ Printworks",
    description: "Recording from our recent London show",
    date: "2025-09-15",
    link: "#",
  },
];

export default function ContentPage() {
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

          <h1 className="mb-12 text-center text-5xl font-bold tracking-wider md:text-7xl">
            CONTENT
          </h1>

          <div className="grid gap-6 md:grid-cols-2">
            {contentItems.map((item) => (
              <a
                key={item.id}
                href={item.link}
                className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                    {item.type}
                  </span>
                  <span className="text-sm text-white/60">
                    {new Date(item.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <h3 className="mb-3 text-2xl font-bold group-hover:text-white/90">
                  {item.title}
                </h3>
                <p className="text-white/60">{item.description}</p>

                <div className="mt-6 flex items-center text-sm font-semibold text-white/80 group-hover:text-white">
                  Play Now →
                </div>
              </a>
            ))}
          </div>

          {/* Featured Video Section */}
          <div className="mt-16">
            <h2 className="mb-8 text-3xl font-bold tracking-wide border-b border-white/20 pb-4">
              Featured
            </h2>
            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="aspect-video w-full bg-white/10 flex items-center justify-center">
                <span className="text-white/40">Video Player</span>
              </div>
              <div className="p-6">
                <h3 className="mb-2 text-2xl font-bold">Latest Release</h3>
                <p className="text-white/60">
                  Our most recent performance captured live
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

