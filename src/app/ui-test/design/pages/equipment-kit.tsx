"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { formatPrice, useBoard } from "../board-state";
import { Button } from "../primitives";
import { inputClass } from "../sections/checkout";

/**
 * Data, availability maths and shared parts for the /equipment drafts.
 * Packages, their prices and contents are the live ones. Per-item prices for
 * DJ table, setup and the two top pairs, stock counts and the existing
 * bookings are illustrative (chosen so the "separately" totals match live).
 */

export const gear = {
  cdj: { name: "CDJ-3000", short: "CDJ", price: 110, stock: 4 },
  table: { name: "DJ table", short: "DJ Table", price: 30, stock: 1 },
  a9: { name: "DJM-A9 mixer", short: "A9", price: 110, stock: 1 },
  setup: { name: "Setup", short: "Setup", price: 100, stock: 1 },
  topA: { name: "Top, pair 1", short: "Top", price: 110, stock: 2 },
  topB: { name: "Top, pair 2", short: "Top", price: 100, stock: 2 },
};
export type GearId = keyof typeof gear;
export const gearIds = [
  "cdj",
  "a9",
  "table",
  "setup",
  "topA",
  "topB",
] as const satisfies readonly GearId[];

export type Line = { id: GearId; qty: number };
export type Package = {
  id: string;
  name: string;
  price: number;
  items: readonly Line[];
};

export const packages: readonly Package[] = [
  {
    id: "p4m",
    name: "4 CDJs + Mixer",
    price: 500,
    items: [
      { id: "cdj", qty: 4 },
      { id: "a9", qty: 1 },
    ],
  },
  {
    id: "p4ms",
    name: "4 CDJs + Mixer + Sound system",
    price: 1000,
    items: [
      { id: "cdj", qty: 4 },
      { id: "table", qty: 1 },
      { id: "a9", qty: 1 },
      { id: "setup", qty: 1 },
      { id: "topA", qty: 2 },
      { id: "topB", qty: 2 },
    ],
  },
  {
    id: "p1",
    name: "Single CDJ-3000",
    price: 110,
    items: [{ id: "cdj", qty: 1 }],
  },
  {
    id: "ss",
    name: "Sound System",
    price: 400,
    items: [
      { id: "topA", qty: 2 },
      { id: "topB", qty: 2 },
    ],
  },
  { id: "p2", name: "Two CDJs", price: 200, items: [{ id: "cdj", qty: 2 }] },
  {
    id: "p2m",
    name: "Two CDJs + Mixer",
    price: 300,
    items: [
      { id: "cdj", qty: 2 },
      { id: "a9", qty: 1 },
    ],
  },
];

export const separately = (lines: readonly Line[]) =>
  lines.reduce((sum, l) => sum + l.qty * gear[l.id].price, 0);

// Dates are "yyyy-mm-dd" keys handled in UTC so server and client agree.
export const TODAY = "2026-09-29";
const toMs = (key: string) => Date.parse(`${key}T00:00:00Z`);
const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86_400_000;
export const daysBetween = (from: string, to: string) =>
  Math.round((toMs(to) - toMs(from)) / DAY) + 1;
const eachDay = (from: string, to: string) =>
  Array.from({ length: daysBetween(from, to) }, (_, i) =>
    toKey(toMs(from) + i * DAY),
  );

const dayFmt = new Intl.DateTimeFormat("en-NZ", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const shortFmt = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const monthFmt = new Intl.DateTimeFormat("en-NZ", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
/** "Fri 9 Oct" */
export const formatKey = (key: string) =>
  dayFmt.format(toMs(key)).replace(",", "");
export const formatShort = (key: string) => shortFmt.format(toMs(key));
export const formatRange = (from: string, to: string) =>
  from === to ? formatKey(from) : `${formatKey(from)} – ${formatKey(to)}`;

// Existing rentals shown on the calendar (illustrative).
const bookings = [
  { from: "2026-10-09", to: "2026-10-10", packageId: "p4m" },
  { from: "2026-10-16", to: "2026-10-16", packageId: "p1" },
  { from: "2026-10-24", to: "2026-10-25", packageId: "ss" },
  { from: "2026-11-06", to: "2026-11-08", packageId: "p2" },
  { from: "2026-11-20", to: "2026-11-21", packageId: "p4ms" },
];

/** Package names booked on a day. */
export const bookedOn = (key: string) =>
  bookings
    .filter((b) => key >= b.from && key <= b.to)
    .map(
      (b) =>
        packages.find((p) => p.id === b.packageId)?.name ?? "Individual items",
    );

const usedOn = (key: string) => {
  const used: Partial<Record<GearId, number>> = {};
  for (const b of bookings) {
    if (key < b.from || key > b.to) continue;
    for (const l of packages.find((p) => p.id === b.packageId)?.items ?? [])
      used[l.id] = (used[l.id] ?? 0) + l.qty;
  }
  return used;
};

/** Stock left for each item across a whole range (the tightest day wins). */
export const remainingFor = (from: string | null, to: string | null) => {
  const left: Record<GearId, number> = {
    cdj: gear.cdj.stock,
    table: gear.table.stock,
    a9: gear.a9.stock,
    setup: gear.setup.stock,
    topA: gear.topA.stock,
    topB: gear.topB.stock,
  };
  if (!from) return left;
  for (const key of eachDay(from, to ?? from)) {
    const used = usedOn(key);
    for (const id of gearIds)
      left[id] = Math.min(left[id], gear[id].stock - (used[id] ?? 0));
  }
  return left;
};

/** Days in the range where `lines` needs more than is left, and which items run out. */
export const clashesFor = (
  lines: readonly Line[],
  from: string | null,
  to: string | null,
) => {
  const dates: string[] = [];
  const limiting = new Set<string>();
  if (from && lines.length) {
    for (const key of eachDay(from, to ?? from)) {
      const used = usedOn(key);
      const short = lines.filter(
        (l) => (used[l.id] ?? 0) + l.qty > gear[l.id].stock,
      );
      if (short.length) dates.push(key);
      for (const l of short) limiting.add(gear[l.id].name);
    }
  }
  return { dates, limiting: [...limiting] };
};

export type Mode = "package" | "items";

type Preset = {
  mode?: Mode;
  packageId?: string;
  qty?: Partial<Record<GearId, number>>;
  from?: string;
  to?: string;
  submitted?: boolean;
};

const presets: Record<string, Preset> = {
  picked: { packageId: "p4ms", from: "2026-10-30", to: "2026-11-01" },
  clash: { packageId: "p4m", from: "2026-10-09", to: "2026-10-11" },
  items: {
    mode: "items",
    qty: { cdj: 2, a9: 1 },
    from: "2026-11-06",
    to: "2026-11-08",
  },
  submitted: { submitted: true },
};

const monthIndex = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return ((y ?? 2026) - 2026) * 12 + (m ?? 10) - 9; // 0 = September 2026
};

/**
 * The whole booking flow as local state, seeded from the page state. Mirrors
 * equipment-booking.tsx: one mode per request, dates checked against existing
 * rentals, submit enabled once everything is filled and nothing clashes.
 */
export function useBooking(state: string) {
  const { toast } = useBoard();
  const preset = presets[state] ?? {};
  const [mode, setModeState] = useState<Mode>(preset.mode ?? "package");
  const [packageId, setPackageId] = useState<string | null>(
    preset.packageId ?? null,
  );
  const [qty, setQty] = useState<Partial<Record<GearId, number>>>(
    preset.qty ?? {},
  );
  const [range, setRange] = useState<{
    from: string | null;
    to: string | null;
  }>({ from: preset.from ?? null, to: preset.to ?? null });
  const [month, setMonth] = useState(preset.from ? monthIndex(preset.from) : 1);
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const [promoter, setPromoter] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">(
    preset.submitted ? "submitted" : "idle",
  );
  const [submittedMode, setSubmittedMode] = useState<Mode>("package");

  const pkg = packages.find((p) => p.id === packageId) ?? null;
  const lines: Line[] =
    mode === "package"
      ? [...(pkg?.items ?? [])]
      : gearIds.flatMap((id) =>
          (qty[id] ?? 0) > 0 ? [{ id, qty: qty[id] ?? 0 }] : [],
        );
  const hasGear = lines.length > 0;
  const hasDates = !!range.from && !!range.to;
  const days = range.from && range.to ? daysBetween(range.from, range.to) : 0;
  const itemsDaily = separately(lines);
  const daily = mode === "package" ? (pkg?.price ?? 0) : itemsDaily;
  const savings =
    mode === "package" && pkg ? Math.max(itemsDaily - pkg.price, 0) : 0;
  const clash = clashesFor(lines, range.from, range.to);
  const remaining = remainingFor(range.from, range.to);
  const ready = hasGear && hasDates && clash.dates.length === 0;

  const missing = [
    !hasGear && (mode === "package" ? "pick a package" : "add items"),
    !hasDates && "choose dates",
    !promoter.trim() && "add a promoter",
    !contact.trim() && "add contact info",
  ].filter((m): m is string => !!m);

  const reset = () => {
    setPackageId(null);
    setQty({});
    setRange({ from: null, to: null });
    setPromoter("");
    setContact("");
    setFocusDay(null);
  };

  return {
    loading: state === "loading",
    mode,
    pkg,
    qty,
    lines,
    range,
    month,
    focusDay,
    promoter,
    contact,
    status,
    submittedMode,
    hasGear,
    hasDates,
    days,
    daily,
    itemsDaily,
    savings,
    total: daily * days,
    clash,
    remaining,
    ready,
    missing,
    canSubmit: ready && missing.length === 0 && status === "idle",
    setPromoter,
    setContact,
    setMonth: (m: number) => setMonth(Math.max(0, Math.min(m, 11))),
    /** Switching mode clears the other mode's picks, as on the live page. */
    setMode: (m: Mode) => {
      setModeState(m);
      if (m === "package") setQty({});
      else setPackageId(null);
    },
    togglePackage: (id: string) =>
      setPackageId((cur) => (cur === id ? null : id)),
    adjust: (id: GearId, delta: number) =>
      setQty((q) => ({
        ...q,
        [id]: Math.max(0, Math.min((q[id] ?? 0) + delta, remaining[id])),
      })),
    /** First click starts a range, second ends it (or restarts if earlier). */
    pickDay: (key: string) => {
      if (key < TODAY) return;
      setFocusDay(bookedOn(key).length ? key : null);
      setRange((r) =>
        !r.from || r.to || key < r.from
          ? { from: key, to: null }
          : { from: r.from, to: key },
      );
    },
    clearDates: () => {
      setRange({ from: null, to: null });
      setFocusDay(null);
    },
    submit: (e?: FormEvent) => {
      e?.preventDefault();
      if (!(ready && missing.length === 0) || status !== "idle") return;
      setStatus("submitting");
      setTimeout(() => {
        setSubmittedMode(mode);
        setStatus("submitted");
        reset();
        toast({ title: "Rental request sent", tone: "success" });
      }, 1200);
    },
    startAgain: () => setStatus("idle"),
  };
}
export type Booking = ReturnType<typeof useBooking>;

export const successCopy = (mode: Mode) =>
  mode === "package"
    ? "Package request submitted! Our team will review it shortly."
    : "Item request submitted! Our team will review it shortly.";

// ---------------------------------------------------------------------------
// Shared parts

/** Numbered step heading. The number is part of the title, not a kicker. */
export function StepTitle({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h2 className="mx-display flex items-center gap-3 text-2xl md:text-3xl">
        <span className="mx-label flex size-8 shrink-0 items-center justify-center rounded-full border border-white/25 text-[11px]">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </div>
  );
}

export function ModeSwitch({ b }: { b: Booking }) {
  return (
    <div
      className="inline-flex rounded-full border border-white/15 p-1"
      role="radiogroup"
      aria-label="Booking mode"
    >
      {(
        [
          ["package", "Package"],
          ["items", "Individual items"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={b.mode === value}
          onClick={() => b.setMode(value)}
          className={cn(
            "mx-label h-9 rounded-full px-4 text-[10px] transition-colors",
            b.mode === value
              ? "bg-white text-black"
              : "text-white/70 hover:text-white",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** "4x CDJ" data tags. Spans, so they can sit inside a pressable row. `inverted` is for white tiles. */
export function GearChips({
  lines,
  className,
  inverted,
}: {
  lines: readonly Line[];
  className?: string;
  inverted?: boolean;
}) {
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {lines.map((l) => (
        <span
          key={l.id}
          title={gear[l.id].name}
          className={cn(
            "mx-label mx-num rounded-[var(--mx-r-chip)] border px-2 py-1.5 text-[10px]",
            inverted
              ? "border-black/20 text-black/75"
              : "border-white/15 text-white/80",
          )}
        >
          {l.qty}x {gear[l.id].short}
        </span>
      ))}
    </span>
  );
}

export function Stepper({
  value,
  onChange,
  max,
  label,
}: {
  value: number;
  onChange: (d: number) => void;
  max: number;
  label: string;
}) {
  return (
    <div className="inline-flex h-10 items-center rounded-full border border-white/20">
      <button
        type="button"
        aria-label={`Fewer ${label}`}
        disabled={value <= 0}
        onClick={() => onChange(-1)}
        className="flex size-10 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
      >
        <Minus className="size-4" />
      </button>
      <span
        className={cn(
          "mx-display mx-num w-5 text-center",
          value ? "text-white" : "text-white/45",
        )}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`More ${label}`}
        disabled={value >= max}
        onClick={() => onChange(1)}
        className="flex size-10 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Individual items with price, stock left for the chosen dates, and a stepper. */
export function ItemRows({ b }: { b: Booking }) {
  const count = b.lines.reduce((n, l) => n + l.qty, 0);
  return (
    <div>
      <ul className="border-t border-white/10">
        {gearIds.map((id) => {
          const g = gear[id];
          const n = b.qty[id] ?? 0;
          const left = b.remaining[id];
          return (
            <li
              key={id}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-white/10 py-4"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "mx-display text-base",
                    n ? "text-white" : "text-white/85",
                  )}
                >
                  {g.name}
                </p>
                <p className="mt-1.5 text-[13px] text-white/60">
                  <span className="mx-num">{formatPrice(g.price)}</span>/day
                </p>
              </div>
              <p
                className={cn(
                  "mx-label mx-num w-16 text-right text-[10px]",
                  left === 0
                    ? "text-[#ff8a8a]"
                    : left < g.stock
                      ? "text-[#ffcc4d]"
                      : "text-white/55",
                )}
              >
                {left} avail
              </p>
              <Stepper
                value={n}
                max={left}
                label={g.name}
                onChange={(d) => b.adjust(id, d)}
              />
            </li>
          );
        })}
      </ul>
      {count ? (
        <p className="mt-3 text-right text-[13px] text-white/60">
          <span className="mx-num">{count}</span>{" "}
          {count === 1 ? "item" : "items"} selected
        </p>
      ) : null}
    </div>
  );
}

const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

function Month({ b, index }: { b: Booking; index: number }) {
  const first = Date.UTC(2026, 8 + index, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(2026, 9 + index, 0)).getUTCDate();
  const { from, to } = b.range;
  const end = to ?? from;
  const clashes = new Set(b.clash.dates);
  return (
    <div className="min-w-0">
      <p className="mx-label mb-3 flex h-9 items-center justify-center text-[12px]">
        {monthFmt.format(first)}
      </p>
      <div className="grid grid-cols-7">
        {weekdays.map((d, i) => (
          <span
            key={i}
            className="mx-label pb-2 text-center text-[10px] text-white/45"
          >
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const key = toKey(first + i * DAY);
          const past = key < TODAY;
          const booked = bookedOn(key).length > 0;
          const clash = clashes.has(key);
          const inRange = !!from && !!end && key >= from && key <= end;
          const isEnd = key === from || key === end;
          const span = !!to && from !== to;
          return (
            <div
              key={key}
              className="relative flex h-11 items-center justify-center"
            >
              {inRange && span ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0.5",
                    clash ? "bg-[#ff6b6b]/15" : "bg-white/10",
                    key === from
                      ? "right-0 left-1/2"
                      : key === end
                        ? "right-1/2 left-0"
                        : "inset-x-0",
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={past}
                onClick={() => b.pickDay(key)}
                aria-pressed={inRange}
                aria-label={`${formatKey(key)}${booked ? ", has bookings" : ""}${clash ? ", unavailable for your gear" : ""}`}
                className={cn(
                  "mx-num relative flex size-10 items-center justify-center rounded-full text-[14px] transition-colors disabled:text-white/20",
                  isEnd && inRange
                    ? clash
                      ? "bg-[#ff6b6b] text-black"
                      : "bg-white text-black"
                    : clash
                      ? "text-[#ff8a8a]"
                      : "text-white/85 hover:bg-white/10",
                )}
              >
                {i + 1}
                {booked ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute bottom-1 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full",
                      clash
                        ? isEnd
                          ? "bg-black"
                          : "bg-[#ff6b6b]"
                        : isEnd && inRange
                          ? "bg-black/60"
                          : "bg-[#ffcc4d]",
                    )}
                  />
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Two-month range picker (one on phones). Booked days carry a small bar;
 * days that clash with the chosen gear turn red.
 */
export function BookingCalendar({
  b,
  className,
}: {
  b: Booking;
  className?: string;
}) {
  if (b.loading)
    return (
      <div aria-hidden className={cn("h-[380px] bg-white/[0.04]", className)} />
    );
  const focus = b.focusDay ? bookedOn(b.focusDay) : [];
  return (
    <div className={className}>
      <div className="relative">
        <div className="absolute top-0 left-0">
          <CalNav
            label="Previous month"
            disabled={b.month <= 0}
            onClick={() => b.setMonth(b.month - 1)}
          >
            <ChevronLeft className="size-4" />
          </CalNav>
        </div>
        <div className="absolute top-0 right-0">
          <CalNav
            label="Next month"
            disabled={b.month >= 11}
            onClick={() => b.setMonth(b.month + 1)}
          >
            <ChevronRight className="size-4" />
          </CalNav>
        </div>
        <div className="grid gap-10 md:grid-cols-2">
          <Month b={b} index={b.month} />
          <div className="hidden md:block">
            <Month b={b} index={b.month + 1} />
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-white/10 pt-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/60">
          <li className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full bg-[#ffcc4d]" />
            Booked
          </li>
          <li className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full bg-[#ff6b6b]" />
            Clashes with your gear
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-white" />
            Your dates
          </li>
        </ul>
        {b.range.from ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={b.clearDates}
            className="-mr-3"
          >
            <X className="size-3.5" /> Clear dates
          </Button>
        ) : null}
      </div>
      <p className="mt-3 min-h-5 text-[14px] text-white/70" aria-live="polite">
        {b.range.from && !b.range.to
          ? `From ${formatKey(b.range.from)}. Pick the last day.`
          : b.focusDay && focus.length
            ? `${formatKey(b.focusDay)}: ${focus.join(", ")} booked`
            : b.hasDates && b.range.from && b.range.to
              ? `${formatRange(b.range.from, b.range.to)}, ${b.days} ${b.days === 1 ? "day" : "days"}`
              : "Tap a start day, then an end day."}
      </p>
    </div>
  );
}

function CalNav({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full border border-white/20 text-white/80 hover:border-white/50 hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Warning when the chosen gear is already out on some of the chosen days. */
export function ClashNotice({ b }: { b: Booking }) {
  if (!b.clash.dates.length) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-4 rounded-[var(--mx-r-chip)] border border-[#ffcc4d]/50 bg-white/[0.03] p-4"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#ffcc4d]" />
      <div>
        <p className="mx-label text-[12px] leading-snug">
          Unavailable due to: {b.clash.limiting.join(", ")}
        </p>
        <p className="mt-1.5 text-[14px] text-white/70">
          Already out on {b.clash.dates.map(formatShort).join(", ")}. Adjust
          your selection or date range before submitting.
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "save";
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4",
        tone === "save" ? "text-[var(--mx-accent-text)]" : "text-white/70",
      )}
    >
      <span>{label}</span>
      <span className="mx-num">{value}</span>
    </div>
  );
}

/** Booking summary: what, when, and the maths behind the total. */
export function BookingSummary({
  b,
  showGear = true,
}: {
  b: Booking;
  showGear?: boolean;
}) {
  return (
    <div className="space-y-4 text-[14px]">
      {showGear ? (
        <div>
          <p className="mx-display text-lg">
            {b.mode === "package"
              ? (b.pkg?.name ?? "No package selected")
              : b.hasGear
                ? "Individual items"
                : "No items selected"}
          </p>
          {b.hasGear ? <GearChips lines={b.lines} className="mt-3" /> : null}
        </div>
      ) : null}
      <p className="text-white/70">
        {b.range.from && b.range.to
          ? formatRange(b.range.from, b.range.to)
          : "No dates yet"}
      </p>
      {b.hasGear ? (
        <div className="space-y-2 border-t border-white/10 pt-4">
          <Row label="Daily rate" value={`${formatPrice(b.daily)}/day`} />
          {b.mode === "package" ? (
            <Row
              label="Items separately"
              value={`${formatPrice(b.itemsDaily)}/day`}
            />
          ) : null}
          {b.savings ? (
            <Row
              label="Package savings"
              value={`${formatPrice(b.savings)}/day`}
              tone="save"
            />
          ) : null}
          <Row label="Days" value={b.days ? String(b.days) : "Pick dates"} />
          <div className="flex items-baseline justify-between pt-2">
            <span className="mx-label text-[12px]">Total</span>
            <span className="mx-display mx-num text-3xl">
              {b.days ? formatPrice(b.total) : "–"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Promoter, private contact, submit. Explains what's missing instead of a dead button. */
export function RequestForm({ b, idPrefix }: { b: Booking; idPrefix: string }) {
  return (
    <form onSubmit={b.submit} noValidate className="space-y-5">
      <div>
        <label
          htmlFor={`${idPrefix}-promoter`}
          className="mx-label mb-2 block text-[10px] text-white/70"
        >
          Promoter
        </label>
        <input
          id={`${idPrefix}-promoter`}
          value={b.promoter}
          onChange={(e) => b.setPromoter(e.target.value)}
          className={inputClass}
          placeholder="e.g. Atmos"
          autoComplete="organization"
        />
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}-contact`}
          className="mx-label mb-2 block text-[10px] text-white/70"
        >
          Private contact info
        </label>
        <input
          id={`${idPrefix}-contact`}
          value={b.contact}
          onChange={(e) => b.setContact(e.target.value)}
          className={inputClass}
          placeholder="Phone number or email"
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!b.canSubmit}
        aria-busy={b.status === "submitting"}
      >
        {b.status === "submitting" ? "Submitting…" : "Submit rental request"}
      </Button>
      <p className="text-[13px] text-white/60">
        {b.clash.dates.length
          ? "Change your gear or dates to clear the clash."
          : b.missing.length
            ? `To submit: ${b.missing.join(", ")}.`
            : "Atmos staff review every request."}
      </p>
    </form>
  );
}

export function Submitted({ b }: { b: Booking }) {
  return (
    <div
      role="status"
      className="animate-in fade-in-0 flex flex-col items-start gap-5 duration-300"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]">
        <Check className="size-6" />
      </span>
      <h2 className="mx-display text-3xl">Request sent</h2>
      <p className="max-w-[40ch] text-[16px] text-white/75">
        {successCopy(b.submittedMode)}
      </p>
      <Button variant="outline" onClick={b.startAgain}>
        Start another request
      </Button>
    </div>
  );
}
