import { StaticBackground } from "~/app/_components/static-background";
import Link from "next/link";
import Image from "next/image";
import { FaInstagram } from "react-icons/fa6";
import { api } from "~/trpc/server";

export default async function CrewPage() {
  const crewMembers = await api.crew.getAll();
  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-2.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          {/* <div className="mb-12">
            <Link href="/" className="text-white/60 hover:text-white transition-colors">
              ← Back
            </Link>
          </div> */}

          <h1 className="mb-6 sm:mb-8 text-center text-4xl sm:text-5xl font-bold tracking-wider md:text-7xl">
            THE CREW
          </h1>

          <p className="mb-12 sm:mb-16 text-center text-base sm:text-lg text-white/60 max-w-2xl mx-auto px-4">
            ATMOS is powered by a tight-knit collective of DJs, producers, and creatives who live and breathe the scene in Pōneke
          </p>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
            {crewMembers.map((member) => (
              <div
                key={member.id}
                className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6 md:p-8 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
              >
                <div className="mb-4 sm:mb-6 aspect-square w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 relative rounded-full overflow-hidden bg-white/10 mx-auto flex items-center justify-center">
                  <Image src={member.image} alt={member.name} fill className="object-cover" />
                </div>

                <div className="text-center">
                  <h3 className="mb-2 text-xl sm:text-2xl font-bold">{member.name}</h3>
                  <p className="mb-4 sm:mb-6 text-xs sm:text-sm font-semibold uppercase tracking-wider text-white/60">
                    {member.role}
                  </p>

                  <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
                    {member.instagram && (
                      <Link
                        href={member.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/60 hover:text-white hover:underline transition-colors flex gap-1 sm:gap-2 items-center text-sm"
                      >
                        <>
                          <FaInstagram className="w-4 h-4" />
                          <span className="hidden sm:inline">Instagram</span>
                        </>
                      </Link>
                    )}
                    {member.soundcloud && (
                      <Link
                        href={member.soundcloud}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/60 hover:text-white hover:underline transition-colors text-sm"
                      >
                        SoundCloud
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center hidden">
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

