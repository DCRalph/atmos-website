"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { IconButton, Media } from "../primitives";
import { PageTitle } from "./chrome";
import {
  crewFor,
  crewIntro,
  crewStates,
  JoinCrew,
  MemberLinks,
  Portrait,
  type CrewEntry,
} from "./crew-kit";
import type { PageSpec } from "./types";

const Bar = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn("rounded-full bg-white/[0.08]", className)} />
);

// ---------------------------------------------------------------------------
// A · Roster

/** Typographic roster: names set big, the hovered or focused one lights the sticky portrait. */
function RosterDraft({ state }: { state: string }) {
  const members = crewFor(state);
  const [active, setActive] = useState(0);
  const current = members?.[active];

  return (
    <>
      <section className="relative flex min-h-[520px] items-end overflow-hidden md:min-h-[600px]">
        <Media
          src="/home/atmos-2.jpg"
          alt=""
          sizes="100vw"
          className="absolute inset-0"
          priority
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="mx-scrim-bottom absolute inset-0" />
        <div className="relative flex w-full flex-wrap items-end justify-between gap-6 px-5 pt-28 pb-10 md:px-10 md:pb-14">
          <div>
            <h1 className="mx-display text-[clamp(3rem,11vw,9rem)]">
              The crew
            </h1>
            <p className="mt-5 max-w-[40ch] text-[16px] text-white/75 md:text-[17px]">
              {crewIntro}
            </p>
          </div>
        </div>
      </section>

      <div
        className="grid gap-10 px-5 py-14 md:px-10 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]"
        aria-busy={members === null}
      >
        <ol className="border-t border-white/10">
          {members === null
            ? [0, 1, 2, 3, 4, 5].map((i) => (
                <li
                  key={i}
                  aria-hidden
                  className="flex items-center gap-4 border-b border-white/10 py-5 md:gap-6"
                >
                  <div className="aspect-square w-16 bg-white/[0.06] lg:hidden" />
                  <Bar className="h-3 w-6 max-lg:hidden" />
                  <div className="flex-1 space-y-3">
                    <Bar className="h-8 w-3/5 max-w-[420px] md:h-12" />
                    <Bar className="h-3 w-32 bg-white/[0.05]" />
                  </div>
                </li>
              ))
            : members.map((m, i) => (
                <li
                  key={m.name}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-white/10 py-5 md:gap-x-6"
                >
                  <Portrait
                    member={m}
                    sizes="64px"
                    className="aspect-square w-16 shrink-0 lg:hidden"
                  />
                  <span className="mx-num w-8 shrink-0 text-[13px] text-white/45 max-lg:hidden">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "mx-display text-[clamp(1.35rem,4.2vw,3.5rem)] break-words transition-colors duration-200",
                        i === active ? "lg:text-white" : "lg:text-white/60",
                      )}
                    >
                      {m.name}
                    </p>
                    <p className="mx-label mt-2.5 text-[10px] text-white/60">
                      {m.role}
                    </p>
                  </div>
                  <MemberLinks
                    member={m}
                    className="max-sm:w-full max-sm:pl-20"
                  />
                </li>
              ))}
        </ol>

        <div className="max-lg:hidden">
          <div className="sticky top-6">
            {current ? (
              <>
                <Portrait
                  key={current.name}
                  member={current}
                  sizes="380px"
                  className="animate-in fade-in-0 aspect-[4/5] duration-300"
                />
                <p className="mx-label mt-4 text-[10px] text-white/60">
                  {current.name} · {current.role}
                </p>
              </>
            ) : (
              <div aria-hidden className="aspect-[4/5] bg-white/[0.06]" />
            )}
          </div>
        </div>
      </div>

      <div className="pb-20">
        <JoinCrew />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// B · Portraits

function PortraitCard({ member }: { member: CrewEntry }) {
  return (
    <article className="min-w-0">
      <Portrait
        member={member}
        sizes="(min-width: 768px) 33vw, 50vw"
        className="aspect-[4/5]"
      />
      <h2 className="mx-display mt-4 truncate text-[clamp(1.25rem,2.4vw,2rem)]">
        {member.name}
      </h2>
      <p className="mx-label mt-2 text-[10px] leading-snug text-white/60">
        {member.role}
      </p>
      <MemberLinks member={member} className="mt-4" />
    </article>
  );
}

function PortraitsDraft({ state }: { state: string }) {
  const members = crewFor(state);
  return (
    <div className="pb-20">
      <PageTitle title="The crew" intro={crewIntro} />
      <div
        className="grid grid-cols-2 gap-x-4 gap-y-12 px-5 md:grid-cols-3 md:gap-x-6 md:px-10"
        aria-busy={members === null}
      >
        {members === null
          ? [0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} aria-hidden className="space-y-3">
                <div className="aspect-[4/5] bg-white/[0.06]" />
                <Bar className="h-6 w-3/4" />
                <Bar className="h-3 w-1/2 bg-white/[0.05]" />
                <div className="flex gap-2 pt-1">
                  <div className="size-10 rounded-full bg-white/[0.06]" />
                  <div className="size-10 rounded-full bg-white/[0.06]" />
                </div>
              </div>
            ))
          : members.map((m) => <PortraitCard key={m.name} member={m} />)}
      </div>
      <div className="mt-20">
        <JoinCrew />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C · Spotlight

/** One member at a time on a big portrait stage; the list beside it is the switcher. */
function SpotlightDraft({ state }: { state: string }) {
  const members = crewFor(state);
  const [index, setIndex] = useState(0);
  const current = members?.[index];
  const count = members?.length ?? 0;
  const step = (dir: 1 | -1) =>
    count && setIndex((index + dir + count) % count);

  return (
    <div className="pb-20">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <div className="px-5 pt-12 pb-8 md:px-10 lg:order-2 lg:pt-16">
          <h1 className="mx-display text-[clamp(2.75rem,8vw,4.75rem)]">
            The crew
          </h1>
          <p className="mt-5 max-w-[40ch] text-[16px] text-white/65">
            {crewIntro}
          </p>

          <div
            role="tablist"
            aria-label="Crew members"
            className="mt-10 border-t border-white/10 max-lg:hidden"
          >
            {members === null
              ? [0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="flex items-center gap-4 border-b border-white/10 py-3"
                  >
                    <div className="size-12 rounded-full bg-white/[0.06]" />
                    <Bar className="h-4 w-32" />
                  </div>
                ))
              : members.map((m, i) => (
                  <button
                    key={m.name}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "relative flex w-full items-center gap-4 border-b border-white/10 py-3 pl-4 text-left transition-colors",
                      i === index
                        ? "text-white"
                        : "text-white/60 hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-3 bottom-3 left-0 w-0.5 transition-colors",
                        i === index
                          ? "bg-[var(--mx-accent)]"
                          : "bg-transparent",
                      )}
                    />
                    <Portrait
                      member={m}
                      sizes="48px"
                      className="size-12 shrink-0 rounded-full"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="mx-display block truncate text-lg">
                        {m.name}
                      </span>
                      <span className="mx-label mt-1.5 block truncate text-[9px] text-white/60">
                        {m.role}
                      </span>
                    </span>
                    {m.profileHandle ? (
                      <span className="mx-label rounded-[var(--mx-r-chip)] border border-white/20 px-2 py-1.5 text-[9px] text-white/70">
                        Profile
                      </span>
                    ) : null}
                  </button>
                ))}
          </div>
        </div>

        <div
          className="relative min-h-[560px] overflow-hidden md:min-h-[720px] lg:order-1"
          aria-busy={members === null}
        >
          {current ? (
            <>
              <Portrait
                key={current.name}
                member={current}
                sizes="(min-width: 1024px) 65vw, 100vw"
                priority
                className="animate-in fade-in-0 absolute inset-0 duration-300"
              />
              <div className="mx-scrim-bottom absolute inset-0" />
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />
              <div className="absolute top-4 right-4 flex items-center gap-2 md:top-6 md:right-6">
                <span className="mx-glass-dark mx-label mx-num flex h-11 items-center rounded-full px-4 text-[11px]">
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {String(count).padStart(2, "0")}
                </span>
                <IconButton
                  label="Previous member"
                  onClick={() => step(-1)}
                  className="mx-glass-dark"
                >
                  <ChevronLeft className="size-5" />
                </IconButton>
                <IconButton
                  label="Next member"
                  onClick={() => step(1)}
                  className="mx-glass-dark"
                >
                  <ChevronRight className="size-5" />
                </IconButton>
              </div>
              <div
                key={`panel-${current.name}`}
                className="mx-glass-dark animate-in fade-in-0 slide-in-from-bottom-2 absolute inset-x-4 bottom-4 rounded-[var(--mx-r-panel)] rounded-tl-none p-5 duration-300 md:inset-x-auto md:bottom-6 md:left-6 md:w-[min(460px,calc(100%-3rem))] md:p-6"
              >
                <h2 className="mx-display text-[clamp(2rem,5vw,3.5rem)] break-words">
                  {current.name}
                </h2>
                <p className="mx-label mt-3 text-[11px] text-white/75">
                  {current.role}
                </p>
                <MemberLinks member={current} glass className="mt-5" />
              </div>
            </>
          ) : (
            <div aria-hidden className="absolute inset-0 bg-white/[0.05]">
              <div className="absolute inset-x-4 bottom-4 space-y-3 rounded-[var(--mx-r-panel)] rounded-tl-none border border-white/10 p-6 md:left-6 md:w-[420px]">
                <Bar className="h-10 w-3/4" />
                <Bar className="h-3 w-1/3 bg-white/[0.05]" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phone: the switcher becomes a thumb strip under the stage. */}
      {members ? (
        <div
          role="tablist"
          aria-label="Crew members"
          className="no-scrollbar flex gap-3 overflow-x-auto px-5 pt-4 md:px-10 lg:hidden"
        >
          {members.map((m, i) => (
            <button
              key={m.name}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className="w-20 shrink-0 text-left"
            >
              <Portrait
                member={m}
                sizes="80px"
                className={cn(
                  "aspect-square transition-opacity",
                  i === index
                    ? "opacity-100 outline-2 -outline-offset-2 outline-[var(--mx-accent)] outline-solid"
                    : "opacity-60",
                )}
              />
              <span
                className={cn(
                  "mx-label mt-2 block truncate text-[9px]",
                  i === index ? "text-white" : "text-white/60",
                )}
              >
                {m.name}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-16 md:mt-20">
        <JoinCrew />
      </div>
    </div>
  );
}

export const crewPage: PageSpec = {
  id: "crew",
  title: "Crew",
  route: "/crew",
  nav: "Crew",
  states: crewStates,
  drafts: [
    {
      id: "a",
      label: "A · Roster",
      note: "Names set big as a roster; hovering one lights a sticky portrait. Which members have profiles is illustrative.",
      Component: RosterDraft,
      heroUnderHeader: true,
    },
    {
      id: "b",
      label: "B · Portraits",
      note: "Plain portrait grid, links and profile under each face. Which members have profiles is illustrative.",
      Component: PortraitsDraft,
    },
    {
      id: "c",
      label: "C · Spotlight",
      note: "One member at a time on a full portrait stage with a glass nameplate; the list beside it switches.",
      Component: SpotlightDraft,
    },
  ],
};
