"use client";

import { StaticBackground } from "~/components/static-background";
import { CrewMember } from "~/components/crew/crew-member";
import Link from "next/link";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { AnimatedPageHeader } from "~/components/animated-page-header";

function CrewMemberSkeleton() {
  return (
    <div className="group border-zinc/20 relative overflow-hidden rounded-lg border bg-black/20 p-4 backdrop-blur-sm sm:p-6 md:p-8">
      <div className="relative mx-auto mb-4 flex aspect-square h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white/10 sm:mb-6 sm:h-28 sm:w-28 md:h-32 md:w-32">
        <Skeleton className="h-full w-full rounded-full bg-white/20" />
      </div>

      <div className="text-center">
        <Skeleton className="mx-auto mb-2 h-6 w-32 bg-white/20 sm:h-7" />
        <Skeleton className="mx-auto mb-4 h-4 w-24 bg-white/10 sm:mb-6" />

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Skeleton className="h-4 w-20 bg-white/10" />
          <Skeleton className="h-4 w-24 bg-white/10" />
        </div>
      </div>
    </div>
  );
}

export default function CrewPage() {
  const { data: crewMembers, isLoading: isLoadingCrewMembers } =
    api.crew.getAll.useQuery();
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

          <AnimatedPageHeader
            title="THE CREW"
            subtitle="DJs, producers, and creatives powering Atmos in Pōneke"
          />

          <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-3">
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

          <div className="mt-16 hidden text-center">
            <h2 className="mb-6 text-3xl font-bold">Join The Crew</h2>
            <p className="mx-auto mb-8 max-w-xl text-white/60">
              Interested in collaborating or becoming part of Atmos? We&apos;re
              always looking for talented artists who share our vision.
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
