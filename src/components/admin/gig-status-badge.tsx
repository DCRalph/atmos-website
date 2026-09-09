import { cn } from "~/lib/utils";
import { isGigUpcoming } from "~/lib/date-utils";
import type { GigStatus } from "~Prisma/browser";

/**
 * Where a gig stands, in one word.
 *
 * "Past" is not a status in the database — it is derived from the dates, and
 * always has been — but from the admin's side it is the same question as draft
 * or live, so it is answered in the same place rather than in a second column
 * nobody reads next to this one.
 */
export function GigStatusBadge({
  status,
  startsAt,
  endsAt,
  className,
}: {
  status: GigStatus;
  /** Null when the caller has no dates to hand; the badge just skips "Past". */
  startsAt: Date | null;
  endsAt?: Date | null;
  className?: string;
}) {
  const isPast =
    status === "PUBLISHED" &&
    startsAt !== null &&
    !isGigUpcoming({ gigStartTime: startsAt, gigEndTime: endsAt ?? null });

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
        : {
            label: "Live",
            tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
          };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}
