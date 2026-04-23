"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Music2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { buildMediaUrl } from "~/lib/media-url";
import { formatDate } from "~/lib/date-utils";
import { type PublicGigAttribution } from "./block-renderer";

type Props = {
  attributions: PublicGigAttribution[];
  title?: string;
  includeUpcoming?: boolean;
  showRole?: boolean;
  blockW: number;
  blockH: number;
  accent?: string | null;
};

function computeVisibleCount(w: number, h: number): number {
  if (w <= 4 || h <= 2) return 1;
  if (w <= 8 || h <= 3) return 2;
  return 3;
}

export function PastGigsBlock({
  attributions,
  title = "Past gigs",
  includeUpcoming = false,
  showRole = true,
  blockW,
  blockH,
  accent,
}: Props) {
  const [open, setOpen] = useState(false);

  const sorted = useMemo(() => {
    const now = new Date();
    const filtered = includeUpcoming
      ? attributions
      : attributions.filter((a) => new Date(a.gig.gigStartTime) < now);
    return [...filtered].sort(
      (a, b) =>
        new Date(b.gig.gigStartTime).getTime() -
        new Date(a.gig.gigStartTime).getTime(),
    );
  }, [attributions, includeUpcoming]);

  const visibleCount = computeVisibleCount(blockW, blockH);
  const visible = sorted.slice(0, visibleCount);
  const hidden = sorted.length - visible.length;

  const accentStyle: React.CSSProperties = accent
    ? ({ ["--past-gigs-accent" as string]: accent } as React.CSSProperties)
    : {};

  if (sorted.length === 0) {
    return (
      <div className="bg-card/40 flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
        <Music2 className="text-muted-foreground mb-2 h-6 w-6" />
        <p className="text-muted-foreground text-sm">
          No past gigs yet — they'll show up here once you're added to a lineup.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full flex-col gap-3 overflow-hidden"
      style={accentStyle}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-5 w-1 rounded-full"
            style={{
              background:
                "var(--past-gigs-accent, color-mix(in oklch, var(--foreground) 50%, transparent))",
            }}
          />
          <h3 className="text-xs font-bold tracking-[0.18em] uppercase">
            {title}
          </h3>
          <span className="text-muted-foreground font-mono text-[10px]">
            {sorted.length}
          </span>
        </div>
        {hidden > 0 && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="group text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase transition-colors hover:border-current"
              >
                View all
                <span className="text-[10px] opacity-70">+{hidden}</span>
                <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-2xl">
              <DialogHeader className="border-b px-6 py-4">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <span
                    className="inline-block h-5 w-1 rounded-full"
                    style={{
                      background:
                        "var(--past-gigs-accent, color-mix(in oklch, var(--foreground) 50%, transparent))",
                    }}
                  />
                  {title}
                  <span className="text-muted-foreground font-mono text-xs">
                    {sorted.length}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[calc(85vh-64px)] overflow-y-auto px-6 py-4">
                <div className="flex flex-col gap-2">
                  {sorted.map((a) => (
                    <PastGigRow
                      key={a.id}
                      attribution={a}
                      showRole={showRole}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div
        className="grid min-h-0 flex-1 gap-3"
        style={{
          gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))`,
        }}
      >
        {visible.map((a) => (
          <PastGigCard key={a.id} attribution={a} showRole={showRole} />
        ))}
      </div>
    </div>
  );
}

function PastGigCard({
  attribution,
  showRole,
}: {
  attribution: PublicGigAttribution;
  showRole: boolean;
}) {
  const { gig, role } = attribution;
  const isTba = gig.mode === "TO_BE_ANNOUNCED";
  const title = isTba ? "TBA" : gig.title;
  return (
    <Link
      href={`/gigs/${gig.id}`}
      className="group bg-card/60 hover:bg-card relative flex flex-col overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        borderColor:
          "var(--past-gigs-accent, color-mix(in oklch, var(--border) 100%, transparent))",
      }}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: "4 / 3" }}
      >
        {gig.posterFileUploadId ? (
          <Image
            src={buildMediaUrl(gig.posterFileUploadId)}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className={`object-cover transition-transform duration-500 group-hover:scale-105 ${
              isTba ? "blur-md" : ""
            }`}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(135deg, var(--past-gigs-accent, color-mix(in oklch, var(--foreground) 15%, transparent)), transparent)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute top-2 right-2">
          <span className="bg-background/80 text-foreground flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] backdrop-blur-sm">
            <CalendarDays className="h-2.5 w-2.5" />
            {formatDate(new Date(gig.gigStartTime), "extra-short")}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h4 className="line-clamp-2 text-sm font-bold text-white drop-shadow-md sm:text-base">
            {title}
          </h4>
          {gig.subtitle && (
            <p className="line-clamp-1 text-[11px] font-semibold tracking-wider text-white/70 uppercase">
              {gig.subtitle}
            </p>
          )}
        </div>
      </div>
      {showRole && role && (
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span
            className="truncate text-[11px] font-semibold tracking-wider uppercase"
            style={{
              color:
                "var(--past-gigs-accent, color-mix(in oklch, var(--foreground) 70%, transparent))",
            }}
          >
            {role}
          </span>
          <ArrowUpRight className="text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      )}
    </Link>
  );
}

function PastGigRow({
  attribution,
  showRole,
  onNavigate,
}: {
  attribution: PublicGigAttribution;
  showRole: boolean;
  onNavigate: () => void;
}) {
  const { gig, role } = attribution;
  const isTba = gig.mode === "TO_BE_ANNOUNCED";
  const title = isTba ? "TBA" : gig.title;
  return (
    <Link
      href={`/gigs/${gig.id}`}
      onClick={onNavigate}
      className="group hover:bg-accent/40 flex items-center gap-3 rounded-lg border p-2 transition-colors"
    >
      <div className="bg-muted relative h-14 w-14 shrink-0 overflow-hidden rounded-md">
        {gig.posterFileUploadId ? (
          <Image
            src={buildMediaUrl(gig.posterFileUploadId)}
            alt={title}
            fill
            sizes="56px"
            className={`object-cover ${isTba ? "blur-md" : ""}`}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(135deg, var(--past-gigs-accent, color-mix(in oklch, var(--foreground) 15%, transparent)), transparent)",
            }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formatDate(new Date(gig.gigStartTime), "short")}
          </span>
          {gig.subtitle && (
            <span className="truncate">· {gig.subtitle}</span>
          )}
        </div>
        {showRole && role && (
          <div
            className="mt-0.5 text-[10px] font-semibold tracking-wider uppercase"
            style={{
              color:
                "var(--past-gigs-accent, color-mix(in oklch, var(--foreground) 70%, transparent))",
            }}
          >
            {role}
          </div>
        )}
      </div>
      <ArrowUpRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}
