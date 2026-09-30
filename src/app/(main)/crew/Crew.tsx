"use client";

import { useState } from "react";
import { MemberLinks, Portrait } from "~/components/site/crew/crew-kit";
import { Button, Media, Skeleton } from "~/components/site/ui";
import { resolveCrewDisplay } from "~/lib/crew-display";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

/** Crew roster: names set big; the hovered or focused one lights the sticky portrait on desktop. */
export default function CrewPage() {
  const { data, isLoading, isError, refetch } = api.crew.getAll.useQuery();
  const members = data?.map(resolveCrewDisplay) ?? [];
  const [active, setActive] = useState(0);
  const current = members[active] ?? members[0];

  return (
    <main>
      <section className="relative flex min-h-[520px] items-end overflow-hidden md:min-h-[600px]">
        <Media
          src="/home/atmos-2.jpg"
          alt=""
          sizes="100vw"
          className="absolute inset-0"
          priority
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="scrim-bottom absolute inset-0" />
        <div className="relative px-5 pt-28 pb-10 md:px-10 md:pb-14">
          <h1 className="t-heading text-[clamp(3rem,11vw,9rem)]">The crew</h1>
          <p className="mt-5 max-w-[40ch] text-[16px] text-white/75 md:text-[17px]">
            DJs, producers and creatives powering Atmos.
          </p>
        </div>
      </section>

      <div
        className="grid gap-10 px-5 py-14 md:px-10 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]"
        aria-busy={isLoading}
      >
        {isError ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-y border-white/10 py-8">
            <p className="text-[15px] text-white/70">
              Couldn&apos;t load the crew.
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <ol className="border-t border-white/10">
            {isLoading
              ? [0, 1, 2, 3, 4, 5].map((i) => (
                  <li
                    key={i}
                    aria-hidden
                    className="flex items-center gap-4 border-b border-white/10 py-5 md:gap-6"
                  >
                    <Skeleton className="aspect-square w-16 lg:hidden" />
                    <Skeleton className="h-3 w-6 rounded-full max-lg:hidden" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-8 w-3/5 max-w-[420px] rounded-full md:h-12" />
                      <Skeleton className="h-3 w-32 rounded-full" />
                    </div>
                  </li>
                ))
              : members.map((m, i) => (
                  <li
                    key={m.id}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-white/10 py-5 md:gap-x-6"
                  >
                    <Portrait
                      member={m}
                      sizes="64px"
                      className="aspect-square w-16 shrink-0 lg:hidden"
                    />
                    <span className="w-8 shrink-0 text-[13px] text-white/45 tabular-nums max-lg:hidden">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2
                        className={cn(
                          "t-display text-[clamp(1.35rem,4.2vw,3.5rem)] break-words normal-case transition-colors duration-200",
                          m.id === current?.id
                            ? "lg:text-white"
                            : "lg:text-white/60",
                        )}
                      >
                        {m.name}
                      </h2>
                      {m.role ? (
                        <p className="t-label mt-2.5 text-[10px] text-white/60">
                          {m.role}
                        </p>
                      ) : null}
                    </div>
                    <MemberLinks
                      member={m}
                      className="max-sm:w-full max-sm:pl-20"
                    />
                  </li>
                ))}
          </ol>
        )}

        <div className="max-lg:hidden">
          <div className="sticky top-28">
            {current ? (
              <>
                <Portrait
                  key={current.id}
                  member={current}
                  sizes="380px"
                  className="animate-in fade-in-0 aspect-[4/5] duration-300"
                />
                <p className="t-label mt-4 text-[10px] text-white/60">
                  {[current.name, current.role].filter(Boolean).join(" · ")}
                </p>
              </>
            ) : (
              <Skeleton className="aspect-[4/5]" />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
