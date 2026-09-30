"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatMoney } from "../cart-sheet";
import { Button, Media, Skeleton } from "../ui";
import {
  BookingCalendar,
  BookingSummary,
  ClashNotice,
  GearChips,
  ItemRows,
  ModeSwitch,
  RequestForm,
  Submitted,
} from "./booking-parts";
import {
  formatRange,
  separately,
  useBooking,
  type Booking,
} from "./use-booking";

const steps = ["Gear", "Dates", "Details", "Done"] as const;
type Step = (typeof steps)[number];

function Progress({
  step,
  onStep,
  reachable,
}: {
  step: Step;
  onStep: (s: Step) => void;
  reachable: (s: Step) => boolean;
}) {
  const index = steps.indexOf(step);
  return (
    <ol className="flex items-center gap-2" aria-label="Booking progress">
      {steps.map((s, i) => (
        <li
          key={s}
          className="flex flex-1 items-center gap-2 last:flex-none"
          aria-current={i === index ? "step" : undefined}
        >
          <button
            type="button"
            disabled={!reachable(s) || step === "Done"}
            onClick={() => onStep(s)}
            className="flex items-center gap-2 disabled:cursor-default"
          >
            <span
              className={cn(
                "t-label flex size-7 shrink-0 items-center justify-center rounded-full text-[10px]",
                i < index && "bg-white text-black",
                i === index &&
                  "bg-[var(--site-accent)] text-[var(--site-accent-ink)]",
                i > index && "border border-white/25 text-white/55",
              )}
            >
              {i < index ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "t-label text-[10px] max-sm:sr-only",
                i === index ? "text-white" : "text-white/55",
              )}
            >
              {s}
            </span>
          </button>
          {i < steps.length - 1 ? (
            <span className="h-px flex-1 bg-white/15" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Packages as a tile grid; the picked one turns white. */
function PackageTiles({ b }: { b: Booking }) {
  return (
    <div
      role="radiogroup"
      aria-label="Package"
      className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3"
    >
      {b.packages.map((p) => {
        const on = b.pkg?.id === p.id;
        const lines = p.items.map((i) => ({
          item: i.gearItem,
          quantity: i.quantity,
        }));
        const sep = separately(lines);
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => b.togglePackage(p.id)}
            className={cn(
              "flex min-h-48 flex-col items-start gap-4 p-5 text-left transition-colors",
              on
                ? "bg-white text-black"
                : "bg-black hover:bg-[var(--site-raised)]",
            )}
          >
            <span className="flex w-full items-start justify-between gap-3">
              <span className="t-display text-lg">{p.name}</span>
              {on ? <Check className="size-5 shrink-0" /> : null}
            </span>
            <GearChips lines={lines} inverted={on} />
            <span className="mt-auto flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="t-display text-2xl tabular-nums">
                {formatMoney(p.price)}
                <span
                  className={cn(
                    "text-[12px]",
                    on ? "text-black/60" : "text-white/60",
                  )}
                >
                  /day
                </span>
              </span>
              {sep > p.price ? (
                <span
                  className={cn(
                    "t-label text-[10px] tabular-nums",
                    on ? "text-black/70" : "text-[var(--site-accent-text)]",
                  )}
                >
                  Save {formatMoney(sep - p.price)}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function GearSkeleton() {
  return (
    <div
      aria-busy
      className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="min-h-48 space-y-4 bg-black p-5">
          <Skeleton className="h-5 w-2/3 rounded-full" />
          <Skeleton className="h-6 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** /equipment, "Wizard": booth photo hero, then gear, dates and details one step at a time with the total pinned to the bottom. */
export function EquipmentWizard() {
  const b = useBooking();
  const [step, setStepState] = useState<Step>("Gear");
  const topRef = useRef<HTMLDivElement>(null);
  // The bottom bar can be far below the step heading on phones; bring the new step into view.
  const setStep = (s: Step) => {
    setStepState(s);
    if ((topRef.current?.getBoundingClientRect().top ?? 0) < 0)
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // Never show a step whose inputs are missing (e.g. after "Start another request").
  const current: Step = b.submittedMode
    ? "Done"
    : step === "Gear" || !b.hasGear
      ? "Gear"
      : step === "Dates" || !b.ready
        ? "Dates"
        : "Details";
  const reachable = (s: Step) =>
    s === "Gear" ||
    (s === "Dates" && b.hasGear) ||
    (s === "Details" && b.ready);
  const canNext =
    current === "Gear" ? b.hasGear : current === "Dates" ? b.ready : false;
  const { from, to } = b.range;
  const cheapest = b.packages.length
    ? Math.min(...b.packages.map((p) => p.price))
    : null;

  return (
    <div>
      <section className="relative flex h-[52svh] min-h-[420px] items-end">
        <Media
          src="/home/atmos-17.jpg"
          alt="DJ booth at an Atmos gig"
          sizes="100vw"
          priority
          className="absolute inset-0"
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="scrim-bottom absolute inset-0" />
        <div className="relative w-full px-5 pb-8 md:px-10 md:pb-12">
          <h1 className="t-heading text-[clamp(2.25rem,10vw,9rem)]">
            Equipment
          </h1>
          <p className="mt-4 max-w-[52ch] text-[16px] text-white/75 md:text-[17px]">
            Professional rental packages for your next event. Check availability
            and request a booking below.
          </p>
          <p className="t-label mt-5 min-h-[11px] text-[11px] text-white/70 tabular-nums">
            {cheapest !== null
              ? `${b.packages.length} packages · from ${formatMoney(cheapest)}/day`
              : null}
          </p>
        </div>
      </section>

      <div
        ref={topRef}
        className="mx-auto max-w-5xl scroll-mt-20 px-5 pt-10 pb-16 md:px-10"
      >
        <Progress step={current} onStep={setStep} reachable={reachable} />

        <div className="mt-10 min-h-[420px]">
          {current === "Gear" ? (
            <section className="animate-in fade-in-0 duration-200">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h2 className="t-heading text-3xl">Pick your gear</h2>
                <ModeSwitch b={b} />
              </div>
              {b.error ? (
                <div
                  role="alert"
                  className="rounded-[var(--site-r-chip)] border border-[var(--site-danger)]/50 bg-white/[0.03] p-5"
                >
                  <p className="t-label text-[12px]">
                    Could not load rental gear.
                  </p>
                  <p className="mt-1.5 text-[14px] text-white/70">
                    {b.error.message}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={b.retry}
                  >
                    Try again
                  </Button>
                </div>
              ) : b.loading ? (
                <GearSkeleton />
              ) : b.mode === "PACKAGE" ? (
                <PackageTiles b={b} />
              ) : (
                <ItemRows b={b} />
              )}
              <p className="mt-4 text-[13px] text-white/60">
                One mode per request. Switching clears the other.
              </p>
            </section>
          ) : null}

          {current === "Dates" ? (
            <section className="animate-in fade-in-0 duration-200">
              <h2 className="t-heading mb-8 text-3xl">When do you need it?</h2>
              <BookingCalendar b={b} />
              <div className="mt-4">
                <ClashNotice b={b} />
              </div>
            </section>
          ) : null}

          {current === "Details" ? (
            <section className="animate-in fade-in-0 grid gap-12 duration-200 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <h2 className="t-heading mb-8 text-3xl">Who&apos;s it for?</h2>
                <RequestForm b={b} />
              </div>
              <div className="md:border-l md:border-white/10 md:pl-10">
                <h2 className="t-heading mb-8 text-3xl">Summary</h2>
                <BookingSummary b={b} />
              </div>
            </section>
          ) : null}

          {current === "Done" ? <Submitted b={b} /> : null}
        </div>
      </div>

      {current !== "Done" ? (
        <div className="sticky bottom-0 z-20 border-t border-white/10 bg-black">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3 md:px-10">
            {current !== "Gear" ? (
              <Button
                variant="outline"
                onClick={() =>
                  setStep(current === "Details" ? "Dates" : "Gear")
                }
                aria-label="Back"
                className="px-4"
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : null}
            <div className="mr-auto min-w-0">
              <p className="t-display truncate text-[13px] md:text-base">
                {b.mode === "PACKAGE"
                  ? (b.pkg?.name ?? "No package yet")
                  : b.hasGear
                    ? `${b.lines.reduce((n, l) => n + l.quantity, 0)} items`
                    : "No items yet"}
              </p>
              <p className="truncate text-[12px] text-white/60 tabular-nums">
                {from && to ? `${formatRange(from, to)} · ` : ""}
                {b.hasGear
                  ? b.days
                    ? `${formatMoney(b.total)} total`
                    : `${formatMoney(b.daily)}/day`
                  : "Pick a package or items"}
              </p>
            </div>
            {current !== "Details" ? (
              <Button
                variant="accent"
                disabled={!canNext}
                onClick={() =>
                  setStep(current === "Gear" ? "Dates" : "Details")
                }
              >
                {current === "Gear"
                  ? "Choose dates"
                  : b.checking
                    ? "Checking…"
                    : "Continue"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
