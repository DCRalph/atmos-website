"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
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

/** Step headings, on the same scale as the home page section headings. */
const stepHeading = "t-heading text-[clamp(1.75rem,4.5vw,3.5rem)]";

/** The steps as numbered labels. Steps already reachable are buttons back to them. */
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
    <ol
      className="flex flex-wrap gap-x-5 gap-y-3 md:gap-x-7"
      aria-label="Booking progress"
    >
      {steps.map((s, i) => (
        <li key={s} aria-current={i === index ? "step" : undefined}>
          <button
            type="button"
            disabled={!reachable(s) || step === "Done"}
            onClick={() => onStep(s)}
            className={cn(
              "t-label flex items-baseline gap-2 text-[11px] transition-colors disabled:cursor-default",
              i === index
                ? "text-white"
                : i < index
                  ? "text-white/70 enabled:hover:text-white"
                  : "text-white/45",
            )}
          >
            <span
              className={cn(
                "tabular-nums",
                i === index ? "text-site-accent-text" : "text-white/35",
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            {s}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Packages as numbered rows, like the crew list. The picked one goes accent. */
function PackageRows({ b }: { b: Booking }) {
  return (
    <div
      role="radiogroup"
      aria-label="Package"
      className="border-t border-white/10"
    >
      {b.packages.map((p, i) => {
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
            className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b border-white/10 py-5 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[2rem_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] md:gap-x-6 md:px-3"
          >
            <span
              className={cn(
                "text-[13px] tabular-nums max-md:hidden",
                on ? "text-site-accent-text" : "text-white/45",
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className={cn(
                "t-display text-[clamp(1.25rem,2.4vw,2rem)] normal-case transition-colors",
                on && "text-site-accent-text",
              )}
            >
              {p.name}
            </span>
            <GearChips
              lines={lines}
              className="max-md:col-span-2 max-md:row-start-3"
            />
            {/* Phones: price under the name, so the name gets the width. */}
            <span className="max-md:row-start-2 md:text-right">
              <span className="t-display text-[clamp(1.125rem,2.4vw,2rem)] tabular-nums">
                {formatMoney(p.price)}
                <span className="t-label text-[10px] text-white/60">/day</span>
              </span>
              {sep > p.price ? (
                <span className="t-label text-site-accent-text text-[10px] tabular-nums max-md:ml-3 md:mt-2 md:block">
                  Save {formatMoney(sep - p.price)}
                </span>
              ) : null}
            </span>
            <span
              aria-hidden
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors max-md:col-start-2 max-md:row-span-2 max-md:row-start-1 md:size-11",
                on
                  ? "bg-site-accent text-site-accent-ink border-transparent"
                  : "border-white/25 text-white/70 group-hover:border-white/60 group-hover:text-white",
              )}
            >
              {on ? <Check className="size-4" /> : <Plus className="size-4" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function GearSkeleton() {
  return (
    <div aria-busy className="border-t border-white/10">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-6 border-b border-white/10 py-6 md:px-3"
        >
          <Skeleton className="h-7 w-2/5 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * /equipment, "Wizard": booth photo hero, then gear, dates and details one
 * step at a time with the total pinned to the bottom. Laid out like the crew
 * page: full width on the site gutter, gear as numbered rows.
 */
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
      <section className="relative flex min-h-[520px] items-end overflow-hidden md:min-h-[600px]">
        <Media
          src="/home/atmos-17.jpg"
          alt="DJ booth at an Atmos gig"
          sizes="100vw"
          priority
          className="absolute inset-0"
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="scrim-bottom absolute inset-0" />
        <div className="relative w-full px-5 pt-28 pb-10 md:px-10 md:pb-14">
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

      <div ref={topRef} className="scroll-mt-20 px-5 py-14 md:px-10 md:py-20">
        <Progress step={current} onStep={setStep} reachable={reachable} />

        <div className="mt-6 min-h-[420px]">
          {current === "Gear" ? (
            <section className="animate-in fade-in-0 duration-200">
              <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-10">
                <h2 className={stepHeading}>Pick your gear</h2>
                <ModeSwitch b={b} />
              </div>
              {b.error ? (
                <div
                  role="alert"
                  className="border-site-danger/50 rounded-[var(--site-r-chip)] border bg-white/[0.03] p-5"
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
                <PackageRows b={b} />
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
              <h2 className={cn(stepHeading, "mb-8 md:mb-10")}>
                When do you need it?
              </h2>
              <BookingCalendar b={b} />
              <div className="mt-4">
                <ClashNotice b={b} />
              </div>
            </section>
          ) : null}

          {current === "Details" ? (
            <section className="animate-in fade-in-0 grid gap-12 duration-200 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <h2 className={cn(stepHeading, "mb-8")}>Who&apos;s it for?</h2>
                <RequestForm b={b} />
              </div>
              <div className="md:border-l md:border-white/10 md:pl-10">
                <h2 className={cn(stepHeading, "mb-8")}>Summary</h2>
                <BookingSummary b={b} />
              </div>
            </section>
          ) : null}

          {current === "Done" ? <Submitted b={b} /> : null}
        </div>
      </div>

      {current !== "Done" ? (
        <div className="sticky bottom-0 z-20 border-t border-white/10 bg-black">
          <div className="flex items-center gap-3 px-5 py-3 md:px-10">
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
              <p className="t-display truncate text-[13px] normal-case md:text-base">
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
