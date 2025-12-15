"use client";

import { StaticBackground } from "~/components/static-background";
import { CrewMember } from "~/components/crew/crew-member";
import Link from "next/link";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";

export default function CrewPage() {
  const { data: crewMembers, isLoading: isLoadingCrewMembers } = api.crew.getAll.useQuery();
  return (
    <main className="bg-black text-white">
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

          <div className="grid gap-6 sm:gap-8 grid-cols-2 md:grid-cols-3">
            {isLoadingCrewMembers ? (
              <div className="flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : (
              crewMembers?.map((member) => (
                <CrewMember
                  key={member.id}
                  id={member.id}
                  name={member.name}
                  role={member.role}
                  image={member.image}
                  instagram={member.instagram}
                  soundcloud={member.soundcloud}
                />
              ))
            )}
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

