"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, XIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { api, type RouterOutputs } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";
import {
  formatDate,
  formatDateInUserTimezone,
  formatDateTime,
  isGigPast,
} from "~/lib/date-utils";
import { gigPath } from "~/lib/gig-url";
import { type PublicLineUpEntry } from "~/lib/run-sheet/line-up";
import { getPlatform } from "~/lib/social-pills";
import { cn } from "~/lib/utils";

type ArtistSummary = NonNullable<
  RouterOutputs["creatorProfiles"]["publicSummary"]
>;
type SummaryGig = ArtistSummary["gigs"][number];

/** How many posters the "previously" strip shows before it stops. */
const STRIP_LIMIT = 5;

/** Name and icon come from the same table the profile pages use. */
const INSTAGRAM = getPlatform("instagram");

/**
 * The bill on a gig page: the wrapping avatar row, and the dialog it opens.
 *
 * The stack used to link straight out to `/@handle`, which is a dead end for
 * every profile that is not published. The dialog shows the artist's history
 * with us instead, and offers the profile and Instagram links only when they
 * lead somewhere.
 *
 * One dialog serves the whole bill rather than one per avatar, because the
 * dialog carries a switcher: reading down a line-up should not mean closing and
 * reopening.
 */
export function LineUpAvatars({
  lineUp,
}: {
  lineUp: readonly PublicLineUpEntry[];
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  // Fetched with the page rather than on open. The batch link folds the whole
  // bill into a single request, so the cost is one round trip and the dialog
  // has nothing left to wait for, including when switching between artists.
  const summaries = api.useQueries((t) =>
    lineUp.map((entry) =>
      t.creatorProfiles.publicSummary(
        { handle: entry.creatorProfile.handle },
        { staleTime: 5 * 60 * 1000 },
      ),
    ),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        {lineUp.map((entry, i) => (
          <button
            key={entry.id}
            type="button"
            aria-label={entry.creatorProfile.displayName}
            onClick={() => {
              setIndex(i);
              setOpen(true);
            }}
            className="group/avatar relative block h-8 w-8 cursor-pointer hover:z-20"
          >
            <ArtistAvatar
              profile={entry.creatorProfile}
              className="h-8 w-8 text-[11px] ring-2 ring-black transition-all duration-200 ease-out group-hover/avatar:scale-125 group-hover/avatar:ring-white/70"
            />
            <span className="pointer-events-none absolute top-full left-1/2 z-30 mt-2 -translate-x-1/2 translate-y-1 border border-white/15 bg-black/90 px-2 py-1 text-[10px] font-bold tracking-wider whitespace-nowrap text-white uppercase opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 group-hover/avatar:translate-y-0 group-hover/avatar:opacity-100">
              {entry.creatorProfile.displayName}
            </span>
          </button>
        ))}
      </div>

      <ArtistDialog
        lineUp={lineUp}
        index={index}
        onSelect={setIndex}
        summary={index === null ? undefined : summaries[index]?.data}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/**
 * `index` outlives `open` on purpose: clearing it on close would empty the
 * dialog and let it collapse through the closing animation.
 *
 * The switcher floats above the card rather than sitting in a header band, so
 * the card stays one uninterrupted block of the artist's history.
 */
function ArtistDialog({
  lineUp,
  index,
  onSelect,
  summary,
  open,
  onOpenChange,
}: {
  lineUp: readonly PublicLineUpEntry[];
  index: number | null;
  onSelect: (index: number) => void;
  summary: ArtistSummary | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const selected = index === null ? null : lineUp[index];
  if (!selected) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        bodyClassName="gap-0"
        className="gap-0 border-0 bg-transparent p-0 shadow-none sm:max-w-[560px]"
      >
        {lineUp.length > 1 && (
          // `overflow-x-auto` makes the cross axis clip as well, so the row
          // needs vertical padding or it shaves the top off every ring.
          <div className="mb-2 flex gap-2 overflow-x-auto px-1 py-1.5">
            {lineUp.map((entry, i) => {
              const isActive = i === index;
              return (
                <button
                  key={entry.id}
                  type="button"
                  title={entry.creatorProfile.displayName}
                  aria-label={entry.creatorProfile.displayName}
                  aria-current={isActive}
                  onClick={() => onSelect(i)}
                  className="shrink-0 cursor-pointer"
                >
                  <ArtistAvatar
                    profile={entry.creatorProfile}
                    className={cn(
                      "h-10 w-10 text-sm shadow-lg transition-all",
                      isActive
                        ? "ring-2 ring-white"
                        : "opacity-55 ring-1 ring-white/25 hover:opacity-100",
                    )}
                  />
                </button>
              );
            })}
          </div>
        )}

        <div className="relative border border-white/20 bg-black">
          <DialogClose className="absolute top-3.5 right-3.5 z-10 cursor-pointer text-white/50 transition-colors hover:text-white">
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>

          {summary ? (
            <SummaryBody
              summary={summary}
              onNavigate={() => onOpenChange(false)}
            />
          ) : (
            <LoadingBody
              profile={selected.creatorProfile}
              role={selected.role}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryBody({
  summary,
  onNavigate,
}: {
  summary: ArtistSummary;
  onNavigate: () => void;
}) {
  const upcoming = summary.gigs
    .filter((gig) => !isGigPast(gig))
    .sort((a, b) => a.gigStartTime.getTime() - b.gigStartTime.getTime());
  const previous = summary.gigs.filter((gig) => isGigPast(gig));

  const next = upcoming[0];
  const strip = previous.slice(0, STRIP_LIMIT);
  const oldest = previous[previous.length - 1];
  const newest = previous[0];

  const profileHref = summary.isPublished ? `/@${summary.handle}` : null;
  const meta = [profileHref ? `@${summary.handle}` : null, summary.tagline]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="flex items-center gap-4 py-4 pr-12 pl-5">
        <ArtistAvatar
          profile={summary}
          className="h-14 w-14 text-lg ring-1 ring-white/15"
        />
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-2xl leading-tight font-black tracking-tight uppercase">
            {summary.displayName}
          </DialogTitle>
          <DialogDescription className="truncate font-mono text-[13px] text-white/40">
            {meta || countLabel(summary.gigs.length)}
          </DialogDescription>
        </div>
      </div>

      {next && (
        <div className="px-5 pb-4">
          <SectionHeading label="Upcoming" count={upcoming.length} highlight />
          <Link
            href={gigPath(next)}
            onClick={onNavigate}
            className="from-accent-strong/40 hover:from-accent-strong/60 flex items-center gap-4 bg-linear-to-r to-transparent p-2.5 transition-colors"
          >
            <Poster gig={next} className="w-[76px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold">
                {gigTitle(next)}
              </span>
              <span className="block truncate text-xs text-white/40">
                {formatDateTime(next.gigStartTime)}
              </span>
              {(next.role !== null || upcoming.length > 1) && (
                <span className="mt-1 block truncate text-[10px] font-black tracking-[0.14em] text-violet-300/80 uppercase">
                  {[
                    next.role,
                    upcoming.length > 1
                      ? `plus ${upcoming.length - 1} more`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </span>
          </Link>
        </div>
      )}

      {strip.length > 0 && newest && oldest && (
        <div className="px-5 pb-5">
          <SectionHeading label="Previously" count={previous.length} />
          <div className="flex gap-2">
            {strip.map((gig) => (
              <Link
                key={gig.id}
                href={gigPath(gig)}
                onClick={onNavigate}
                title={`${gigTitle(gig)} · ${formatDate(gig.gigStartTime, "short")}`}
                className="min-w-0 flex-1 transition-opacity hover:opacity-80"
              >
                <span className="sr-only">{gigTitle(gig)}</span>
                <Poster gig={gig} className="w-full" />
              </Link>
            ))}
            {/* Keeps a short history poster-sized instead of stretching it. */}
            {Array.from({ length: STRIP_LIMIT - strip.length }).map((_, i) => (
              <span key={i} className="min-w-0 flex-1" aria-hidden />
            ))}
          </div>
          <div className="mt-2.5 font-mono text-xs text-white/40">
            {monthRange(oldest.gigStartTime, newest.gigStartTime)}
            {previous.length > strip.length && ` · ${previous.length} gigs`}
          </div>
        </div>
      )}

      <Actions
        profileHref={profileHref}
        instagramUrl={summary.instagramUrl}
        onNavigate={onNavigate}
      />
    </>
  );
}

/**
 * Shown until the prefetched summary lands, and as the fallback if a profile
 * has gone missing since the page loaded. The line-up entry already carries the
 * name and role, so the dialog opens with something to read either way.
 *
 * Static blocks rather than a shimmer: the gig page behind is already running
 * parallax on scroll.
 */
function LoadingBody({
  profile,
  role,
}: {
  profile: PublicLineUpEntry["creatorProfile"];
  role: string | null;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-4 pr-8">
        <ArtistAvatar
          profile={profile}
          className="h-14 w-14 text-lg ring-1 ring-white/15"
        />
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-2xl leading-tight font-black tracking-tight uppercase">
            {profile.displayName}
          </DialogTitle>
          <DialogDescription className="truncate font-mono text-[13px] text-white/40">
            {role ?? profile.tagline ?? "Loading"}
          </DialogDescription>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        {Array.from({ length: STRIP_LIMIT }).map((_, i) => (
          <span key={i} className="aspect-3/4 flex-1 bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function Actions({
  profileHref,
  instagramUrl,
  onNavigate,
}: {
  profileHref: string | null;
  instagramUrl: string | null;
  onNavigate: () => void;
}) {
  if (!profileHref && !instagramUrl) return null;

  const base =
    "flex flex-1 items-center justify-center gap-2 px-4 py-4 text-[13px] font-black tracking-[0.12em] uppercase transition-colors";

  return (
    <div className="flex border-t border-white/12">
      {profileHref && (
        <Link
          href={profileHref}
          onClick={onNavigate}
          className={cn(base, "hover:bg-white/10")}
        >
          Profile
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      )}
      {instagramUrl && (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            base,
            "text-[#ff8fc0] hover:bg-[#d62976]/15",
            profileHref && "border-l border-white/12",
          )}
        >
          <Image
            src={INSTAGRAM.iconSrc}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 object-contain"
          />
          {INSTAGRAM.name}
        </a>
      )}
    </div>
  );
}

function SectionHeading({
  label,
  count,
  highlight = false,
}: {
  label: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5">
      {highlight && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300" />
      )}
      <span
        className={cn(
          "text-[11px] font-black tracking-[0.2em] uppercase",
          highlight ? "text-violet-300" : "text-white/40",
        )}
      >
        {label}
      </span>
      <span className="h-px flex-1 bg-white/12" />
      <span className="font-mono text-xs text-white/40">{count}</span>
    </div>
  );
}

/** Sized by the caller, since the same face appears at three scales. */
function ArtistAvatar({
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
          sizes="56px"
          className="object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-black text-white/60">
          {profile.displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/** A gig's artwork, or a marked placeholder when it has none. */
function Poster({ gig, className }: { gig: SummaryGig; className?: string }) {
  const isTba = gig.mode === "TO_BE_ANNOUNCED";
  return (
    <span
      className={cn(
        "relative block aspect-3/4 shrink-0 overflow-hidden bg-white/5 ring-1 ring-white/15",
        className,
      )}
    >
      {gig.posterFileUploadId ? (
        <Image
          src={buildMediaUrl(gig.posterFileUploadId)}
          alt=""
          fill
          sizes="112px"
          className={cn("object-cover", isTba && "blur-sm")}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-black text-white/30">
          {gigTitle(gig).slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/** A TBA gig keeps its secret here too. */
function gigTitle(gig: SummaryGig): string {
  return gig.mode === "TO_BE_ANNOUNCED" ? "TBA" : gig.title;
}

function countLabel(total: number): string {
  return total === 1 ? "First time with us" : `${total} gigs for Atmos`;
}

function monthRange(from: Date, to: Date): string {
  const start = monthYear(from);
  const end = monthYear(to);
  return start === end ? start : `${start} – ${end}`;
}

function monthYear(date: Date): string {
  return formatDateInUserTimezone(date, { month: "short", year: "2-digit" });
}
