import { cn } from "~/lib/utils";
import { formatDate, isGigPast } from "~/lib/date-utils";
import { GIG_FLAGS, type GigFlags } from "~/lib/gig-flags";
import { AFFILIATED_LEAD_MS } from "~/lib/gig-visibility";
import type { GigStatus } from "~Prisma/browser";

const pill =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const FLAG_TONES: Record<keyof GigFlags, string> = {
  isTba: "border-indigo-400/40 bg-indigo-400/10 text-indigo-300",
  isAffiliated: "border-sky-400/40 bg-sky-400/10 text-sky-300",
};

/**
 * Where a gig stands, in one word, followed by a chip for each flag that is on
 * when `flags` is passed.
 *
 * "Past" is not a status in the database — it is derived from the dates, and
 * always has been — but from the admin's side it is the same question as draft
 * or live, so it is answered in the same place rather than in a second column
 * nobody reads next to this one. The same goes for an affiliated gig that is
 * published but still further out than its lead time: it is not live yet, so
 * the badge says when it goes up instead.
 */
export function GigStatusBadge({
  status,
  startsAt,
  endsAt,
  flags,
  className,
}: {
  status: GigStatus;
  /** Null when the caller has no dates to hand; the badge just skips "Past". */
  startsAt: Date | null;
  endsAt?: Date | null;
  flags?: GigFlags;
  className?: string;
}) {
  const isPast =
    status === "PUBLISHED" &&
    startsAt !== null &&
    isGigPast({ gigStartTime: startsAt, gigEndTime: endsAt ?? null });

  const goesUpAt =
    flags?.isAffiliated && startsAt
      ? new Date(startsAt.getTime() - AFFILIATED_LEAD_MS)
      : null;

  const { label, tone } =
    status === "DRAFT"
      ? {
          label: "Draft",
          tone: "border-amber-500/40 bg-amber-500/10 text-amber-400",
        }
      : isPast
        ? {
            label: "Past",
            tone: "border-border bg-muted/40 text-muted-foreground",
          }
        : goesUpAt && goesUpAt > new Date()
          ? {
              label: `Hidden until ${formatDate(goesUpAt, "extra-short")}`,
              tone: "border-border text-muted-foreground",
            }
          : {
              label: "Live",
              tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
            };

  return (
    <span
      className={cn("inline-flex flex-wrap items-center gap-1.5", className)}
    >
      <span className={cn(pill, tone)}>
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        {label}
      </span>
      {flags
        ? GIG_FLAGS.filter((flag) => flags[flag.key]).map((flag) => (
            <span
              key={flag.key}
              title={flag.summary}
              className={cn(pill, FLAG_TONES[flag.key])}
            >
              {flag.short}
            </span>
          ))
        : null}
    </span>
  );
}
