"use client";

import { useState, type ReactNode } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
} from "date-fns";
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
import { formatMoney } from "../cart-sheet";
import { Button, inputClass } from "../ui";
import {
  dayKey,
  formatDay,
  formatRange,
  successCopy,
  type Booking,
  type Line,
} from "./use-booking";

/** Pieces of the equipment request flow. Each takes the `useBooking()` state. */

export function ModeSwitch({ b }: { b: Booking }) {
  return (
    <div
      className="inline-flex rounded-full border border-white/15 p-1"
      role="radiogroup"
      aria-label="Booking mode"
    >
      {(
        [
          ["PACKAGE", "Package"],
          ["ITEMS", "Individual items"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={b.mode === value}
          onClick={() => b.setMode(value)}
          className={cn(
            "t-label h-9 rounded-full px-4 text-[10px] transition-colors",
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

/** "4x CDJ" data tags. Spans, so they can sit inside a pressable tile. Hover shows the full name and notes. */
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
          key={l.item.id}
          title={[
            `${l.quantity}x ${l.item.name}`,
            l.item.description,
            l.item.note && `Note: ${l.item.note}`,
          ]
            .filter(Boolean)
            .join("\n")}
          className={cn(
            "t-label rounded-[var(--site-r-chip)] border px-2 py-1.5 text-[10px] tabular-nums",
            inverted
              ? "border-black/20 text-black/75"
              : "border-white/15 text-white/80",
          )}
        >
          {l.quantity}x {l.item.shortName ?? l.item.name}
        </span>
      ))}
    </span>
  );
}

function Stepper({
  value,
  onChange,
  max,
  label,
}: {
  value: number;
  onChange: (delta: number) => void;
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
          "t-display w-5 text-center tabular-nums",
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

/** Individual items with price (discounted when a rule applies), stock left for the dates, and a stepper. */
export function ItemRows({ b }: { b: Booking }) {
  const count = b.lines.reduce((n, l) => n + l.quantity, 0);
  return (
    <div>
      <ul className="border-t border-white/10">
        {b.inventory.map((item) => {
          const n = b.qty[item.id] ?? 0;
          const left = b.remaining(item);
          const pricing = n ? b.itemPricing(item.id) : undefined;
          const discounted = !!pricing && pricing.rowDiscountTotal > 0;
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-white/10 py-4"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "t-display text-base normal-case",
                    n ? "text-white" : "text-white/85",
                  )}
                >
                  {item.name}
                </p>
                <p className="mt-1.5 text-[13px] text-white/60 tabular-nums">
                  {discounted ? (
                    <>
                      <span className="line-through">
                        {formatMoney(pricing.originalRowTotal)}
                      </span>{" "}
                      <span className="text-[var(--site-accent-text)]">
                        {formatMoney(pricing.discountedRowTotal)}
                      </span>
                      /day for {n}
                    </>
                  ) : (
                    <>{formatMoney(item.price)}/day</>
                  )}
                </p>
                {n && item.note ? (
                  <p className="mt-1.5 text-[13px] text-[var(--site-warn)]">
                    Note: {item.note}
                  </p>
                ) : null}
              </div>
              <p
                className={cn(
                  "t-label w-16 text-right text-[10px] tabular-nums",
                  left === 0
                    ? "text-[var(--site-danger-text)]"
                    : left < item.quantity
                      ? "text-[var(--site-warn)]"
                      : "text-white/55",
                )}
              >
                {left} avail
              </p>
              <Stepper
                value={n}
                max={left}
                label={item.name}
                onChange={(d) => b.adjust(item, d)}
              />
            </li>
          );
        })}
      </ul>
      {count ? (
        <p className="mt-3 text-right text-[13px] text-white/60">
          <span className="tabular-nums">{count}</span>{" "}
          {count === 1 ? "item" : "items"} selected
        </p>
      ) : null}
    </div>
  );
}

const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

function Month({ b, month }: { b: Booking; month: Date }) {
  const days = eachDayOfInterval({ start: month, end: endOfMonth(month) });
  const lead = (getDay(month) + 6) % 7;
  const { from, to } = b.range;
  const end = to ?? from;
  const clashes = new Set(b.clashDates);
  return (
    <div className="min-w-0">
      <p className="t-label mb-3 flex h-9 items-center justify-center text-[12px]">
        {format(month, "MMMM yyyy")}
      </p>
      <div className="grid grid-cols-7">
        {weekdays.map((d, i) => (
          <span
            key={i}
            className="t-label pb-2 text-center text-[10px] text-white/45"
          >
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {days.map((day) => {
          const key = dayKey(day);
          const past = day < b.today;
          const booked = b.bookedOn(day).length > 0;
          const clash = clashes.has(key);
          const inRange = !!from && !!end && day >= from && day <= end;
          const isEnd =
            (!!from && key === dayKey(from)) || (!!end && key === dayKey(end));
          const span = !!from && !!to && dayKey(from) !== dayKey(to);
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
                    clash ? "bg-[var(--site-danger)]/15" : "bg-white/10",
                    from && key === dayKey(from)
                      ? "right-0 left-1/2"
                      : end && key === dayKey(end)
                        ? "right-1/2 left-0"
                        : "inset-x-0",
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={past}
                onClick={() => b.pickDay(day)}
                aria-pressed={inRange}
                aria-label={`${formatDay(day)}${booked ? ", has bookings" : ""}${clash ? ", unavailable for your gear" : ""}`}
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-full text-[14px] tabular-nums transition-colors disabled:text-white/20",
                  isEnd && inRange
                    ? clash
                      ? "bg-[var(--site-danger)] text-black"
                      : "bg-white text-black"
                    : clash
                      ? "text-[var(--site-danger-text)]"
                      : "text-white/85 hover:bg-white/10",
                )}
              >
                {day.getDate()}
                {booked ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute bottom-1 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full",
                      clash
                        ? isEnd
                          ? "bg-black"
                          : "bg-[var(--site-danger)]"
                        : isEnd && inRange
                          ? "bg-black/60"
                          : "bg-[var(--site-warn)]",
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

const MAX_MONTHS_AHEAD = 23;

/**
 * Two-month range picker (one on phones), starting at the month of the chosen
 * start day. Approved rentals carry a small bar; days where the chosen gear is
 * already out turn red.
 */
export function BookingCalendar({ b }: { b: Booking }) {
  const [offset, setOffset] = useState(() =>
    b.range.from
      ? Math.max(
          0,
          (b.range.from.getFullYear() - b.today.getFullYear()) * 12 +
            b.range.from.getMonth() -
            b.today.getMonth(),
        )
      : 0,
  );
  const month = startOfMonth(addMonths(b.today, offset));
  const focus = b.focusDay ? b.bookedOn(b.focusDay) : [];
  const { from, to } = b.range;
  return (
    <div>
      <div className="relative">
        <div className="absolute top-0 left-0">
          <CalNav
            label="Previous month"
            disabled={offset <= 0}
            onClick={() => setOffset(offset - 1)}
          >
            <ChevronLeft className="size-4" />
          </CalNav>
        </div>
        <div className="absolute top-0 right-0">
          <CalNav
            label="Next month"
            disabled={offset >= MAX_MONTHS_AHEAD}
            onClick={() => setOffset(offset + 1)}
          >
            <ChevronRight className="size-4" />
          </CalNav>
        </div>
        <div className="grid gap-10 md:grid-cols-2">
          <Month b={b} month={month} />
          <div className="hidden md:block">
            <Month b={b} month={addMonths(month, 1)} />
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-white/10 pt-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/60">
          <li className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full bg-[var(--site-warn)]" />
            Booked
          </li>
          <li className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full bg-[var(--site-danger)]" />
            Clashes with your gear
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-white" />
            Your dates
          </li>
        </ul>
        {from ? (
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
        {b.focusDay && focus.length
          ? `Booked ${formatDay(b.focusDay)}: ${focus.map((r) => `${r.userName}, ${r.gearPackage?.name ?? "individual items"}`).join("; ")}`
          : from && !to
            ? `From ${formatDay(from)}. Pick the last day.`
            : from && to
              ? `${formatRange(from, to)}, ${b.days} ${b.days === 1 ? "day" : "days"}`
              : "Tap a start day, then an end day."}
      </p>
    </div>
  );
}

/** Warning when the chosen gear is already out on some of the chosen days. */
export function ClashNotice({ b }: { b: Booking }) {
  if (!b.clashDates.length) return null;
  const dates = b.clashDates.map((key) =>
    format(new Date(`${key}T00:00:00`), "d MMM"),
  );
  return (
    <div
      role="alert"
      className="flex items-start gap-4 rounded-[var(--site-r-chip)] border border-[var(--site-warn)]/50 bg-white/[0.03] p-4"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--site-warn)]" />
      <div>
        <p className="t-label text-[12px] leading-snug">
          Unavailable due to: {b.limiting.join(", ")}
        </p>
        <p className="mt-1.5 text-[14px] text-white/70">
          Already out on {dates.join(", ")}. Adjust your selection or date range
          before submitting.
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  save,
}: {
  label: string;
  value: string;
  save?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4",
        save ? "text-[var(--site-accent-text)]" : "text-white/70",
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** What, when, and the maths behind the total. Prices come from the live quote. */
export function BookingSummary({ b }: { b: Booking }) {
  const { from, to } = b.range;
  return (
    <div className="space-y-4 text-[14px]">
      <div>
        <p className="t-display text-lg normal-case">
          {b.mode === "PACKAGE"
            ? (b.pkg?.name ?? "No package selected")
            : b.hasGear
              ? "Individual items"
              : "No items selected"}
        </p>
        {b.hasGear ? <GearChips lines={b.lines} className="mt-3" /> : null}
      </div>
      <p className="text-white/70">
        {from && to ? formatRange(from, to) : "No dates yet"}
      </p>
      {b.hasGear ? (
        <div className="space-y-2 border-t border-white/10 pt-4">
          {b.mode === "PACKAGE" ? (
            <Row
              label="Items separately"
              value={`${formatMoney(b.itemsDaily)}/day`}
            />
          ) : null}
          {b.savings ? (
            <Row
              label="Package savings"
              value={`${formatMoney(b.savings)}/day`}
              save
            />
          ) : null}
          {b.discount ? (
            <Row
              label={b.discount.name}
              value={`−${formatMoney(b.discountDaily)}/day`}
              save
            />
          ) : null}
          <Row label="Daily rate" value={`${formatMoney(b.daily)}/day`} />
          <Row label="Days" value={b.days ? String(b.days) : "Pick dates"} />
          <div className="flex items-baseline justify-between pt-2">
            <span className="t-label text-[12px]">Total</span>
            <span className="t-display text-3xl tabular-nums">
              {b.days ? formatMoney(b.total) : "–"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Promoter, email, submit. Says what's missing instead of leaving a dead button. */
export function RequestForm({ b }: { b: Booking }) {
  return (
    <form onSubmit={b.submit} noValidate className="space-y-5">
      <div>
        <label
          htmlFor="eq-promoter"
          className="t-label mb-2 block text-[10px] text-white/70"
        >
          Promoter
        </label>
        <input
          id="eq-promoter"
          value={b.promoter}
          onChange={(e) => b.setPromoter(e.target.value)}
          className={inputClass}
          placeholder="e.g. Atmos"
          autoComplete="organization"
        />
      </div>
      <div>
        <label
          htmlFor="eq-contact"
          className="t-label mb-2 block text-[10px] text-white/70"
        >
          Email
        </label>
        <input
          id="eq-contact"
          type="email"
          value={b.contact}
          onChange={(e) => b.setContact(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!b.canSubmit}
        aria-busy={b.submitting}
      >
        {b.submitting ? "Submitting…" : "Submit rental request"}
      </Button>
      <p
        role={b.submitError ? "alert" : undefined}
        className={cn(
          "text-[13px]",
          b.submitError ? "text-[var(--site-danger-text)]" : "text-white/60",
        )}
      >
        {b.submitError ??
          (b.clashDates.length
            ? "Change your gear or dates to clear the clash."
            : b.missing.length
              ? `To submit: ${b.missing.join(", ")}.`
              : b.checking
                ? "Checking availability…"
                : "Atmos staff review every request.")}
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
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--site-accent)] text-[var(--site-accent-ink)]">
        <Check className="size-6" />
      </span>
      <h2 className="t-heading text-3xl">Request sent</h2>
      <p className="max-w-[40ch] text-[16px] text-white/75">
        {successCopy(b.submittedMode ?? "PACKAGE")}
      </p>
      <Button variant="outline" onClick={b.startAgain}>
        Start another request
      </Button>
    </div>
  );
}
