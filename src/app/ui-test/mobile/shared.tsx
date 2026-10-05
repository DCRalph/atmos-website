import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Flashlight,
  Keyboard,
  Search,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { buttonVariants } from "~/components/site/ui";
import { MonthBadge } from "~/components/site/home/parts";
import {
  account,
  door,
  formatDay,
  formatMonth,
  formatTime,
  formatYear,
  groupByMonth,
  nextGig,
  statusLabel,
  type MockGig,
} from "./fixtures";
import { Img, Label, Poster, STATUS } from "./phone";

/**
 * Pieces every direction shares: the site's month-grouped gig rows, the More
 * screen body, and door mode. Door is staff tooling, so it stays one design
 * whichever direction wins.
 */

/** A month of gigs: accent month badge, month name, then rows. */
export function MonthGroups({
  gigs,
  dense,
}: {
  gigs: readonly MockGig[];
  /** Ledger's tighter rows: smaller poster, no arrow. */
  dense?: boolean;
}) {
  return (
    <div className={dense ? "space-y-8" : "space-y-10"}>
      {groupByMonth(gigs).map(({ key, date, gigs }) => (
        <div key={key}>
          <header className="flex items-center gap-4 border-b border-white/10 pb-3">
            {date ? (
              <MonthBadge month={formatMonth(date)} year={formatYear(date)} />
            ) : (
              <MonthBadge />
            )}
            <h3 className="t-display text-[20px]">
              {date ? key.split(" ")[0] : "To be announced"}
            </h3>
          </header>
          <ul>
            {gigs.map((gig) => (
              <GigRow key={gig.slug} gig={gig} dense={dense} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function GigRow({ gig, dense }: { gig: MockGig; dense?: boolean }) {
  const status = statusLabel[gig.status];
  return (
    <li
      className={cn(
        "grid items-center gap-4 border-b border-white/10",
        dense
          ? "grid-cols-[44px_minmax(0,1fr)_auto] py-3"
          : "grid-cols-[60px_minmax(0,1fr)_auto] py-4",
      )}
    >
      <Poster
        gig={gig}
        className={cn("aspect-[4/5]", dense ? "w-11" : "w-[60px]")}
        tbaClassName="text-[9px]"
      />
      <div className="min-w-0">
        <p
          className={cn(
            "t-display line-clamp-2 normal-case",
            dense ? "text-[15px]" : "text-[17px]",
          )}
        >
          {gig.status === "tba" ? "TBA" : gig.headline}
        </p>
        <p className="mt-1.5 truncate text-[13px] text-white/60">
          {gig.date
            ? `${formatDay(gig.date)} · ${gig.venue}`
            : "Date to be announced"}
        </p>
      </div>
      {dense ? (
        status ? (
          <span className="t-label text-[9px] text-white/55">{status}</span>
        ) : (
          <ChevronRight className="size-4 text-white/40" />
        )
      ) : (
        <span className="flex flex-col items-end gap-2">
          <span className="flex size-9 items-center justify-center rounded-full border border-white/20 text-white/70">
            <ArrowRight className="size-4" />
          </span>
        </span>
      )}
    </li>
  );
}

/** The poster on the left, the facts in a two-up grid: the pass field style. */
export function Facts({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="t-label text-[9px] text-white/55">{label}</dt>
          <dd className="mt-1.5 text-[14px] break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const moreSections: {
  title: string;
  staff?: boolean;
  rows: { label: string; badge?: string; web?: boolean }[];
}[] = [
  {
    title: "Staff",
    staff: true,
    rows: [
      { label: "Door mode", badge: "Tonight" },
      { label: "Run sheet" },
      { label: "Event analytics" },
      { label: "Gig rooms", badge: "3" },
      { label: "Notify team" },
    ],
  },
  { title: "Settings", rows: [{ label: "Notifications" }] },
  {
    title: "Atmos",
    rows: ["Content", "About", "Crew", "Gear rental", "Merch", "Contact"].map(
      (label) => ({ label, web: true }),
    ),
  },
  {
    title: "Legal",
    rows: [
      { label: "Terms", web: true },
      { label: "Privacy", web: true },
    ],
  },
];

/** Account, staff tools, settings and links out to the site. */
export function MoreBody() {
  return (
    <div className="px-5">
      <div className="flex items-center gap-4 border-b border-white/10 pb-6">
        <span className="t-label flex size-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-[18px]">
          {account.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-display truncate text-[20px] normal-case">
            {account.name}
          </p>
          <p className="mt-1.5 truncate text-[13px] text-white/60">
            {account.email}
          </p>
        </div>
        <span className={buttonVariants({ variant: "outline", size: "sm" })}>
          Edit
        </span>
      </div>

      {moreSections.map((section) => (
        <section key={section.title} className="pt-8">
          <Label className="pb-2">{section.title}</Label>
          <ul>
            {section.rows.map((row) => (
              <li
                key={row.label}
                className="flex h-14 items-center justify-between gap-3 border-b border-white/10"
              >
                <span className="t-label text-[12px]">{row.label}</span>
                <span className="flex items-center gap-3">
                  {row.badge ? (
                    <span
                      className={cn(
                        "t-label rounded-full px-2.5 py-1.5 text-[9px]",
                        Number.isNaN(Number(row.badge))
                          ? "bg-[var(--site-accent)] text-[var(--site-accent-ink)]"
                          : "bg-white/10 text-white tabular-nums",
                      )}
                    >
                      {row.badge}
                    </span>
                  ) : null}
                  {row.web ? (
                    <ArrowUpRight className="size-4 text-white/40" />
                  ) : (
                    <ChevronRight className="size-4 text-white/40" />
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="flex flex-col items-start gap-2 pt-8">
        <span className={buttonVariants({ variant: "outline", size: "sm" })}>
          Sign out
        </span>
        <span
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "px-0 text-[var(--site-danger-text)]",
          )}
        >
          Delete account
        </span>
      </div>
    </div>
  );
}

const doorModes = ["Scan", "Manual", "List", "Sell", "Check", "ID", "Log"];

/**
 * Door scanner. The camera feed is imagery, so this is the one staff screen
 * where glass belongs: header and controls float over the feed.
 */
export function DoorScan() {
  return (
    <>
      <div aria-hidden className="absolute inset-0">
        <Img src="/home/atmos-46.jpg" className="brightness-[0.45]" />
      </div>

      <header
        className="glass-dark absolute inset-x-0 top-0 rounded-b-[var(--site-r-panel)] px-4 pb-3"
        style={{ paddingTop: STATUS + 4 }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="glass flex size-10 items-center justify-center rounded-full">
            <X className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="t-display truncate text-[15px] normal-case">
              {nextGig.headline}
            </p>
            <Label className="mt-1 text-[9px]">
              Door 1 · {door.scannedLast10}/10 min
            </Label>
          </div>
          <div className="text-right">
            <p className="t-display text-[22px] tabular-nums">
              {door.inside}
              <span className="text-white/40">/{door.capacity}</span>
            </p>
            <Label className="mt-1 text-[9px]">Inside</Label>
          </div>
        </div>
        <div className="no-scrollbar mt-3 -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {doorModes.map((mode, i) => (
            <span
              key={mode}
              className={cn(
                "t-label flex h-8 shrink-0 items-center rounded-full px-3.5 text-[10px]",
                i === 0 ? "bg-white text-black" : "glass text-white/80",
              )}
            >
              {mode}
            </span>
          ))}
        </div>
      </header>

      {/* Viewfinder: square corners only, since it frames the image. */}
      <div className="absolute top-[290px] left-1/2 size-[250px] -translate-x-1/2">
        {[
          "top-0 left-0 border-t-[3px] border-l-[3px]",
          "top-0 right-0 border-t-[3px] border-r-[3px]",
          "bottom-0 left-0 border-b-[3px] border-l-[3px]",
          "right-0 bottom-0 border-r-[3px] border-b-[3px]",
        ].map((pos) => (
          <span
            key={pos}
            className={cn("absolute size-10 border-[var(--site-accent)]", pos)}
          />
        ))}
      </div>
      <Label className="absolute top-[560px] inset-x-0 text-center text-[10px] text-white/80">
        Point at a ticket QR
      </Label>

      <div className="absolute inset-x-0 bottom-0 px-5 pb-10">
        <div className="glass-dark glass-float rounded-[var(--site-r-panel)] rounded-bl-none p-1.5">
          {[
            ["Sam Taylor", "General", "In", "9:41pm"],
            ["Guest", "General", "In", "9:41pm"],
            ["Mere Walker", "Early bird", "Dup", "9:38pm"],
          ].map(([name, tier, result, time]) => (
            <div
              key={name}
              className="flex h-11 items-center gap-3 rounded-[10px] px-3"
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  result === "In" ? "bg-[#34D399]" : "bg-[#F5A524]",
                )}
              />
              <span className="min-w-0 flex-1 truncate text-[14px]">
                {name}
                <span className="text-white/50"> · {tier}</span>
              </span>
              <span className="text-[12px] text-white/50 tabular-nums">
                {time}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <span
            className={cn(
              buttonVariants({ variant: "glass", size: "md" }),
              "flex-1",
            )}
          >
            <Keyboard className="size-4" /> Type number
          </span>
          <span className={buttonVariants({ variant: "glass", size: "md" })}>
            <Search className="size-4" />
          </span>
          <span className={buttonVariants({ variant: "glass", size: "md" })}>
            <Flashlight className="size-4" />
          </span>
        </div>
      </div>
    </>
  );
}

/**
 * Scan result, full screen in the door's signal colour. The bottom button is
 * always the harmless one; the override sits above it, outlined.
 */
export function DoorResult() {
  return (
    <div className="absolute inset-0 flex flex-col bg-[#F5A524] px-5 pb-10 text-black">
      <div style={{ height: STATUS + 24 }} />
      <p className="t-label text-[11px] text-black/65">
        Door 1 · {formatTime(new Date("2026-10-09T21:41:00+13:00"))}
      </p>
      <h1 className="t-heading mt-4 text-[54px]">Already in</h1>
      <p className="mt-4 text-[17px] leading-snug text-black/80">
        Scanned at Door 2, 8 minutes ago.
      </p>

      <div className="mt-8 rounded-[var(--site-r-panel)] rounded-tl-none bg-black/10 p-5">
        <p className="t-display text-[26px] normal-case">Mere Walker</p>
        <dl className="mt-5 grid grid-cols-2 gap-4">
          {[
            ["Tier", "Early bird"],
            ["Access", "GA"],
            ["Ticket", "ATM-3LMV-08RT"],
            ["Order", "2 of 2 in"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="t-label text-[9px] text-black/55">{label}</dt>
              <dd className="mt-1.5 text-[14px] break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-auto space-y-2">
        <span className="t-label flex h-14 items-center justify-center rounded-full border-2 border-black text-[13px]">
          Admit anyway
        </span>
        <span className="t-label flex h-16 items-center justify-center rounded-full bg-black text-[14px] text-white">
          Next scan
        </span>
      </div>
    </div>
  );
}
