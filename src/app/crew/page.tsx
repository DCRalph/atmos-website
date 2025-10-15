import { ImageCycleBackground } from "~/app/_components/image-cycle-background";
import Link from "next/link";

// Example crew members - replace with actual data
const crewMembers = [
  {
    id: 1,
    name: "DJ Alpha",
    role: "Founder / DJ",
    bio: "Pioneer of the underground sound, bringing raw energy to every set.",
    socials: {
      instagram: "#",
      soundcloud: "#",
    },
  },
  {
    id: 2,
    name: "DJ Beta",
    role: "Co-Founder / Producer",
    bio: "Crafting beats that move the crowd and shake the foundation.",
    socials: {
      instagram: "#",
      soundcloud: "#",
    },
  },
  {
    id: 3,
    name: "DJ Gamma",
    role: "Resident DJ",
    bio: "Master of the mix, blending genres into seamless sonic journeys.",
    socials: {
      instagram: "#",
      soundcloud: "#",
    },
  },
  {
    id: 4,
    name: "VJ Delta",
    role: "Visual Artist",
    bio: "Transforming sound into sight, creating immersive visual experiences.",
    socials: {
      instagram: "#",
    },
  },
];

export default function CrewPage() {
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

          <h1 className="mb-8 text-center text-5xl font-bold tracking-wider md:text-7xl">
            THE CREW
          </h1>

          <p className="mb-16 text-center text-lg text-white/60 max-w-2xl mx-auto">
            Meet the collective behind the sound. We&apos;re a group of artists, DJs, and
            creators united by our passion for electronic music and underground culture.
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            {crewMembers.map((member) => (
              <div
                key={member.id}
                className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
              >
                <div className="mb-6 aspect-square w-32 rounded-full bg-white/10 mx-auto flex items-center justify-center">
                  <span className="text-white/40 text-sm">Photo</span>
                </div>

                <div className="text-center">
                  <h3 className="mb-2 text-2xl font-bold">{member.name}</h3>
                  <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">
                    {member.role}
                  </p>
                  <p className="mb-6 text-white/60">{member.bio}</p>

                  <div className="flex items-center justify-center gap-4">
                    {member.socials.instagram && (
                      <a
                        href={member.socials.instagram}
                        className="text-white/60 hover:text-white transition-colors"
                      >
                        Instagram
                      </a>
                    )}
                    {member.socials.soundcloud && (
                      <a
                        href={member.socials.soundcloud}
                        className="text-white/60 hover:text-white transition-colors"
                      >
                        SoundCloud
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <h2 className="mb-6 text-3xl font-bold">Join The Crew</h2>
            <p className="mb-8 text-white/60 max-w-xl mx-auto">
              Interested in collaborating or becoming part of Atmos? We&apos;re always looking
              for talented artists who share our vision.
            </p>
            <Link
              href="/contact"
              className="inline-block rounded-md bg-white px-8 py-3 font-semibold text-black transition-all hover:bg-white/90"
            >
              Get In Touch
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

