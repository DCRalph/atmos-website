"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { api, type RouterOutputs } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";
import {
  formatDate,
  formatDateInUserTimezone,
  formatDateTime,
  isGigPast,
} from "~/lib/date-utils";
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

type Props = {
  entry: PublicLineUpEntry;
  /** Applied to the trigger so the avatar stack keeps its overlap. */
  className?: string;
};

/**
 * An artist on a gig's bill. Clicking the avatar used to leave for
 * `/@handle`, which is a dead end for the two thirds of profiles that are not
 * published. This opens their history with us instead, and offers the profile
 * and Instagram links only when they lead somewhere.
 *
 * The summary is fetched on first open, not on page load: a bill of six
 * artists would otherwise be six queries nobody asked for.
 */
export function LineUpArtistPopover({ entry, className }: Props) {
  const [open, setOpen] = useState(false);
  const profile = entry.creatorProfile;

  const { data } = api.creatorProfiles.publicSummary.useQuery(
    { handle: profile.handle },
    { enabled: open, staleTime: 5 * 60 * 1000 },
  );

  const avatar = profile.avatarFileId
    ? buildMediaUrl(profile.avatarFileId)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={profile.displayName}
          className={cn(
            "group/avatar relative block h-8 w-8 cursor-pointer transition-[margin-left,transform,z-index] duration-300 ease-out hover:z-20",
            className,
          )}
        >
          <span className="relative block h-8 w-8 overflow-hidden rounded-full bg-white/10 ring-2 ring-black transition-all group-hover/avatar:ring-white/70 group-data-[state=open]/avatar:ring-white">
            {avatar ? (
              <Image
                src={avatar}
                alt={profile.displayName}
                fill
                sizes="32px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[11px] font-black text-white/60">
                {profile.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
          <span className="pointer-events-none absolute top-full left-1/2 z-30 mt-2 -translate-x-1/2 translate-y-1 border border-white/15 bg-black/90 px-2 py-1 text-[10px] font-bold tracking-wider whitespace-nowrap text-white uppercase opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 group-hover/avatar:translate-y-0 group-hover/avatar:opacity-100 group-data-[state=open]/avatar:opacity-0">
            {profile.displayName}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-[372px] max-w-[calc(100vw-1.5rem)] rounded-none border-white/20 bg-black p-0 text-white shadow-[0_40px_80px_rgba(0,0,0,0.9)]"
      >
        {data ? (
          <SummaryBody summary={data} onNavigate={() => setOpen(false)} />
        ) : (
          <LoadingBody
            displayName={profile.displayName}
            avatar={avatar}
            role={entry.role}
          />
        )}
      </PopoverContent>
    </Popover>
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
    <div>
      <div className="flex items-center gap-3 p-3.5">
        <Avatar
          fileId={summary.avatarFileId}
          displayName={summary.displayName}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] leading-tight font-black tracking-tight uppercase">
            {summary.displayName}
          </div>
          <div className="truncate font-mono text-xs text-white/40">
            {meta || countLabel(summary.gigs.length)}
          </div>
        </div>
      </div>

      {next && (
        <div className="px-3.5 pb-3">
          <SectionHeading
            label="Next with us"
            count={upcoming.length}
            highlight
          />
          <Link
            href={`/gigs/${next.id}`}
            onClick={onNavigate}
            className="from-accent-strong/40 hover:from-accent-strong/60 flex items-center gap-3 bg-linear-to-r to-transparent p-2 transition-colors"
          >
            <Poster gig={next} className="w-[52px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">
                {gigTitle(next)}
              </span>
              <span className="block truncate text-[11px] text-white/40">
                {formatDateTime(next.gigStartTime)}
              </span>
              {(next.role !== null || upcoming.length > 1) && (
                <span className="mt-0.5 block truncate text-[9.5px] font-black tracking-[0.14em] text-violet-300/80 uppercase">
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
        <div className="px-3.5 pb-3.5">
          <SectionHeading label="Previously" count={previous.length} />
          <div className="flex gap-1.5">
            {strip.map((gig) => (
              <Link
                key={gig.id}
                href={`/gigs/${gig.id}`}
                onClick={onNavigate}
                title={`${gigTitle(gig)} · ${formatDate(gig.gigStartTime, "short")}`}
                className="min-w-0 flex-1 transition-opacity hover:opacity-80"
              >
                <span className="sr-only">{gigTitle(gig)}</span>
                <Poster gig={gig} className="w-full" />
              </Link>
            ))}
            {/* Keeps a lone poster poster-sized instead of stretching it. */}
            {Array.from({ length: STRIP_LIMIT - strip.length }).map((_, i) => (
              <span key={i} className="min-w-0 flex-1" aria-hidden />
            ))}
          </div>
          <div className="mt-2 font-mono text-[11px] text-white/40">
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
    </div>
  );
}

/**
 * Holds the popover's shape while the summary loads, so the card does not
 * resize under the cursor. Static blocks rather than a shimmer: the gig page
 * already runs parallax on scroll.
 */
function LoadingBody({
  displayName,
  avatar,
  role,
}: {
  displayName: string;
  avatar: string | null;
  role: string | null;
}) {
  return (
    <div className="p-3.5">
      <div className="flex items-center gap-3">
        <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
          {avatar && (
            <Image
              src={avatar}
              alt={displayName}
              fill
              sizes="40px"
              className="object-cover"
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] leading-tight font-black tracking-tight uppercase">
            {displayName}
          </div>
          <div className="truncate font-mono text-xs text-white/40">
            {role ?? "Loading"}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-1.5">
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
    "flex flex-1 items-center justify-center gap-2 px-4 py-3 text-xs font-black tracking-[0.12em] uppercase transition-colors";

  return (
    <div className="flex border-t border-white/12">
      {profileHref && (
        <Link
          href={profileHref}
          onClick={onNavigate}
          className={cn(base, "hover:bg-white/10")}
        >
          Profile
          <ArrowUpRight className="h-3.5 w-3.5" />
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
            width={14}
            height={14}
            className="h-3.5 w-3.5 object-contain"
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
    <div className="mb-2 flex items-center gap-2.5">
      {highlight && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300" />
      )}
      <span
        className={cn(
          "text-[10px] font-black tracking-[0.2em] uppercase",
          highlight ? "text-violet-300" : "text-white/40",
        )}
      >
        {label}
      </span>
      <span className="h-px flex-1 bg-white/12" />
      <span className="font-mono text-[11px] text-white/40">{count}</span>
    </div>
  );
}

function Avatar({
  fileId,
  displayName,
}: {
  fileId: string | null;
  displayName: string;
}) {
  return (
    <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
      {fileId ? (
        <Image
          src={buildMediaUrl(fileId)}
          alt={displayName}
          fill
          sizes="40px"
          className="object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-black text-white/60">
          {displayName.slice(0, 1).toUpperCase()}
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
          sizes="72px"
          className={cn("object-cover", isTba && "blur-sm")}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-white/30">
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
