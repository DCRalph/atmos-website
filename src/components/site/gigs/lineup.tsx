"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
import { api, type RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { buildMediaUrl } from "~/lib/media-url";
import { gigPath } from "~/lib/gig-url";
import { SiteDialog } from "../overlays";
import { Skeleton, buttonVariants } from "../ui";
import {
  fmtDay,
  fmtShortMonth,
  fmtYear,
  gigTitle,
  isPast,
  type DetailGig,
} from "./gig-parts";

/** One name in the dialog's switcher: a line-up entry, or an artist on their own. */
type Entry = {
  id: string;
  role: string | null;
  artistProfile: {
    handle: string;
    displayName: string;
    avatarFileId: string | null;
  };
};
type Summary = NonNullable<RouterOutputs["artistProfiles"]["publicSummary"]>;
type SummaryGig = Summary["gigs"][number];

/** How many posters the "previously" strip shows. */
const STRIP_LIMIT = 5;

/** Round face, or the first letter when there's no photo. Sized by the caller. */
export function Avatar({
  profile,
  className,
}: {
  profile: { displayName: string; avatarFileId: string | null };
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-full bg-white/10",
        className,
      )}
    >
      {profile.avatarFileId ? (
        <Image
          src={buildMediaUrl(profile.avatarFileId)}
          alt=""
          fill
          sizes="64px"
          className="object-cover"
        />
      ) : (
        <span className="t-label flex size-full items-center justify-center text-white/70">
          {profile.displayName.slice(0, 1)}
        </span>
      )}
    </span>
  );
}

/** A gig's poster, blurred for TBA, a letter when there's none. */
function Poster({ gig, className }: { gig: SummaryGig; className?: string }) {
  return (
    <span
      className={cn(
        "relative block aspect-[4/5] shrink-0 overflow-hidden bg-white/5",
        className,
      )}
    >
      {gig.posterFileUploadId ? (
        <Image
          src={buildMediaUrl(gig.posterFileUploadId)}
          alt=""
          fill
          sizes="120px"
          className={cn("object-cover", gig.isTba && "blur-sm")}
        />
      ) : (
        <span className="t-display flex size-full items-center justify-center text-white/30">
          {gigTitle(gig).slice(0, 1)}
        </span>
      )}
    </span>
  );
}

const monthYear = (d: Date) => `${fmtShortMonth(d)} ${fmtYear(d)}`;

/**
 * A gig's bill as a row of overlapping faces, for list rows that link to the
 * gig. Hovering spreads them out; a face opens the same dialog as the gig
 * page's line-up. Sits above the row's stretched link (`relative z-10`), so a
 * click on a face never follows it. Large screens only: on smaller ones the
 * row has no room for it.
 */
export function LineupFaces({
  gigId,
  lineUp,
  className,
}: {
  gigId: string;
  lineUp: readonly Entry[];
  className?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const selected = index === null ? undefined : lineUp[index];
  const summary = api.artistProfiles.publicSummary.useQuery(
    { handle: selected?.artistProfile.handle ?? "" },
    { enabled: selected !== undefined, staleTime: 5 * 60_000 },
  );

  if (!lineUp.length) return null;
  return (
    <>
      <ul
        aria-label="Line-up"
        className={cn(
          "relative z-10 hidden w-fit flex-wrap -space-x-2 transition-[gap] hover:space-x-1 lg:flex",
          className,
        )}
      >
        {lineUp.map(({ id, artistProfile: p }, i) => (
          <li key={id} className="transition-[margin] duration-150">
            <button
              type="button"
              title={p.displayName}
              aria-label={p.displayName}
              onClick={() => {
                setIndex(i);
                setOpen(true);
              }}
              className="block rounded-full transition-transform duration-150 hover:-translate-y-0.5"
            >
              <Avatar
                profile={p}
                className="size-8 text-[11px] ring-2 ring-black transition-shadow hover:ring-white/70"
              />
            </button>
          </li>
        ))}
      </ul>
      {index !== null && selected ? (
        <ArtistDialog
          gigId={gigId}
          lineUp={lineUp}
          index={index}
          onSelect={setIndex}
          summary={summary.data}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}

/**
 * The line-up on a gig page. Each artist opens a dialog with the other gigs
 * they've played with Atmos, their profile and Instagram when those exist.
 * One dialog serves the whole bill, with a switcher, so reading down a
 * line-up doesn't mean closing and reopening.
 */
export function Lineup({ gig }: { gig: DetailGig }) {
  const [index, setIndex] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  // Fetched with the page: the batch link folds the bill into one request,
  // so opening and switching artists never waits.
  const summaries = api.useQueries((t) =>
    gig.lineUp.map((entry) =>
      t.artistProfiles.publicSummary(
        { handle: entry.artistProfile.handle },
        { staleTime: 5 * 60_000 },
      ),
    ),
  );

  if (!gig.lineUp.length) return null;

  return (
    <div>
      <h2 className="t-label mb-4 text-[12px] text-white/60">Line-up</h2>
      <ul className="flex flex-wrap gap-x-2 gap-y-2">
        {gig.lineUp.map(({ id, role, artistProfile: p }, i) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => {
                setIndex(i);
                setOpen(true);
              }}
              className="group flex items-center gap-3 rounded-full py-1.5 pr-4 pl-1.5 text-left transition-colors hover:bg-white/[0.06]"
            >
              <Avatar
                profile={p}
                className="size-10 text-[12px] ring-1 ring-white/10 transition-shadow group-hover:ring-white/50"
              />
              <span>
                <span
                  className={cn(
                    "t-display group-hover:text-site-accent-text block normal-case transition-colors",
                    i === 0 ? "text-lg" : "text-base text-white/85",
                  )}
                >
                  {p.displayName}
                </span>
                {role ? (
                  <span className="t-label mt-1 block text-[9px] text-white/50">
                    {role}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {index !== null && gig.lineUp[index] ? (
        <ArtistDialog
          gigId={gig.id}
          lineUp={gig.lineUp}
          index={index}
          onSelect={setIndex}
          summary={summaries[index]?.data}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </div>
  );
}

/**
 * An artist's other gigs with Atmos, and their profile and Instagram when those
 * exist. `lineUp` is who the switcher offers (one entry hides it), `gigId` the
 * gig being looked at, which the dialog leaves out of their gigs.
 */
export function ArtistDialog({
  gigId,
  lineUp,
  index,
  onSelect,
  summary,
  open,
  onOpenChange,
}: {
  gigId?: string;
  lineUp: readonly Entry[];
  index: number;
  onSelect: (index: number) => void;
  summary: Summary | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const entry = lineUp[index]!;
  const p = entry.artistProfile;
  // This gig is the one they're looking at; the dialog is about the others.
  const others = summary?.gigs.filter((g) => g.id !== gigId) ?? [];
  const upcoming = others
    .filter((g) => !isPast(g))
    .sort((a, b) => a.gigStartTime.getTime() - b.gigStartTime.getTime());
  const previous = others.filter((g) => isPast(g));
  const strip = previous.slice(0, STRIP_LIMIT);
  const newest = previous[0];
  const oldest = previous.at(-1);
  const profileHref = summary?.isPublished ? `/@${summary.handle}` : null;
  const close = () => onOpenChange(false);

  const description =
    summary === undefined
      ? (entry.role ?? "Loading")
      : others.length === 0
        ? "First time with Atmos"
        : `${others.length}${gigId ? " other" : ""} ${others.length === 1 ? "gig" : "gigs"} with Atmos`;

  return (
    <SiteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={p.displayName}
      titleAsWritten
      description={description}
      className="max-w-[560px] overflow-y-auto"
    >
      <div className="space-y-6 p-5">
        {lineUp.length > 1 ? (
          <div
            className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1"
            aria-label="Line-up"
          >
            {lineUp.map((e, i) => (
              <button
                key={e.id}
                type="button"
                title={e.artistProfile.displayName}
                aria-label={e.artistProfile.displayName}
                aria-current={i === index}
                onClick={() => onSelect(i)}
                className="shrink-0"
              >
                <Avatar
                  profile={e.artistProfile}
                  className={cn(
                    "size-10 text-[12px] transition-[opacity,box-shadow]",
                    i === index
                      ? "ring-site-accent ring-2"
                      : "opacity-55 ring-1 ring-white/25 hover:opacity-100",
                  )}
                />
              </button>
            ))}
          </div>
        ) : null}

        {summary === undefined ? (
          <div aria-busy className="flex gap-2">
            {Array.from({ length: STRIP_LIMIT }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/5] flex-1" />
            ))}
          </div>
        ) : others.length === 0 ? (
          <p className="text-[15px] text-white/65">
            This is {p.displayName}&apos;s first gig with us.
          </p>
        ) : (
          <>
            {upcoming.length ? (
              <section>
                <h3 className="t-label text-site-accent-text mb-3 flex items-center justify-between text-[11px]">
                  Upcoming{" "}
                  <span className="tabular-nums">{upcoming.length}</span>
                </h3>
                <ul className="space-y-2">
                  {upcoming.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={gigPath(g)}
                        onClick={close}
                        className="group grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4 rounded-[var(--site-r-panel)] rounded-tl-none border border-white/12 p-2 pr-4 transition-colors hover:border-white/30"
                      >
                        <Poster gig={g} className="w-14" />
                        <span className="min-w-0">
                          <span className="t-display block truncate text-base normal-case">
                            {gigTitle(g)}
                          </span>
                          <span className="mt-1 block truncate text-[13px] text-white/60">
                            {[
                              g.isTba ? "Date TBA" : fmtDay(g.gigStartTime),
                              g.role,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <ArrowRight className="size-4 text-white/50 group-hover:text-white" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {strip.length && newest && oldest ? (
              <section>
                <h3 className="t-label mb-3 flex items-center justify-between text-[11px] text-white/60">
                  Previously{" "}
                  <span className="tabular-nums">{previous.length}</span>
                </h3>
                <div className="flex gap-2">
                  {strip.map((g) => (
                    <Link
                      key={g.id}
                      href={gigPath(g)}
                      onClick={close}
                      title={`${gigTitle(g)} · ${fmtDay(g.gigStartTime)} ${fmtYear(g.gigStartTime)}`}
                      className="min-w-0 flex-1 transition-opacity hover:opacity-80"
                    >
                      <span className="sr-only">{gigTitle(g)}</span>
                      <Poster gig={g} className="w-full" />
                    </Link>
                  ))}
                  {/* Keeps a short history poster-sized instead of stretched. */}
                  {Array.from(
                    { length: STRIP_LIMIT - strip.length },
                    (_, i) => (
                      <span key={i} className="min-w-0 flex-1" aria-hidden />
                    ),
                  )}
                </div>
                <p className="t-label mt-3 text-[10px] text-white/50">
                  {monthYear(oldest.gigStartTime) ===
                  monthYear(newest.gigStartTime)
                    ? monthYear(newest.gigStartTime)
                    : `${monthYear(oldest.gigStartTime)} to ${monthYear(newest.gigStartTime)}`}
                </p>
              </section>
            ) : null}
          </>
        )}
      </div>

      {profileHref || summary?.instagramUrl ? (
        <div className="flex gap-2 border-t border-white/10 p-5">
          {profileHref ? (
            <Link
              href={profileHref}
              onClick={close}
              className={cn(buttonVariants({ size: "md" }), "flex-1")}
            >
              Profile <ArrowUpRight className="size-4" />
            </Link>
          ) : null}
          {summary?.instagramUrl ? (
            <a
              href={summary.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: "md", variant: "outline" }),
                "flex-1",
              )}
            >
              <FaInstagram className="size-4" /> Instagram
            </a>
          ) : null}
        </div>
      ) : null}
    </SiteDialog>
  );
}
