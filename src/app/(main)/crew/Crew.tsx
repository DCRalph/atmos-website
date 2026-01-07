"use client";

import { StaticBackground } from "~/components/static-background";
import { CrewMember } from "~/components/crew/crew-member";
import Link from "next/link";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";

function CrewMemberSkeleton() {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-zinc/20 bg-black/20 p-4 sm:p-6 md:p-8 backdrop-blur-sm">
      <div className="mb-4 sm:mb-6 aspect-square w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 relative rounded-full overflow-hidden bg-white/10 mx-auto flex items-center justify-center">
        <Skeleton className="w-full h-full rounded-full bg-white/20" />
      </div>

      <div className="text-center">
        <Skeleton className="h-6 sm:h-7 w-32 mx-auto mb-2 bg-white/20" />
        <Skeleton className="h-4 w-24 mx-auto mb-4 sm:mb-6 bg-white/10" />

        <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
          <Skeleton className="h-4 w-20 bg-white/10" />
          <Skeleton className="h-4 w-24 bg-white/10" />
        </div>
      </div>
    </div>
  );
}

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
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <CrewMemberSkeleton key={i} />
                ))}
              </>
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

