"use client";

import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatPrice } from "../board-state";
import { photos } from "../fixtures";
import { Button, Media } from "../primitives";
import { PageTitle } from "./chrome";
import {
  BookingCalendar,
  BookingSummary,
  ClashNotice,
  clashesFor,
  formatRange,
  formatShort,
  GearChips,
  ItemRows,
  ModeSwitch,
  packages,
  RequestForm,
  separately,
  StepTitle,
  Submitted,
  useBooking,
  type Booking,
} from "./equipment-kit";
import { Bone } from "./merch-kit";
import type { PageSpec } from "./types";

const INTRO =
  "Professional rental packages for your next event. Check availability and request a booking below.";
const MODE_NOTE = "One mode per request.";

function RadioDot({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border",
        on ? "border-white bg-white text-black" : "border-white/35",
      )}
    >
      {on ? <Check className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul aria-busy className="border-t border-white/10">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="flex items-center gap-4 border-b border-white/10 py-5"
        >
          <Bone className="size-5" />
          <div className="flex-1 space-y-3">
            <Bone className="h-5 w-1/2" />
            <Bone className="h-3.5 w-1/4" />
          </div>
          <Bone className="h-6 w-16" />
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// A · Planner: gear and dates on the left, request and summary stick on the right.

function PackageRows({ b }: { b: Booking }) {
  return (
    <div
      role="radiogroup"
      aria-label="Package"
      className="border-t border-white/10"
    >
      {packages.map((p) => {
        const on = b.pkg?.id === p.id;
        const sep = separately(p.items);
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => b.togglePackage(p.id)}
            className={cn(
              "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 border-b border-white/10 py-5 text-left transition-colors hover:bg-white/[0.03] md:px-3",
              on && "bg-white/[0.05] hover:bg-white/[0.05]",
            )}
          >
            <span className="pt-0.5">
              <RadioDot on={on} />
            </span>
            <span className="min-w-0">
              <span className="mx-display block text-base md:text-lg">
                {p.name}
              </span>
              <GearChips lines={p.items} className="mt-3" />
            </span>
            <span className="text-right">
              <span className="mx-display mx-num block text-lg md:text-xl">
                {formatPrice(p.price)}
                <span className="text-[12px] text-white/60">/day</span>
              </span>
              {sep > p.price ? (
                <>
                  <span className="mx-num mt-1.5 block text-[12px] text-white/55 line-through">
                    {formatPrice(sep)}
                  </span>
                  <span className="mx-num block text-[12px] text-[var(--mx-accent-text)]">
                    Save {formatPrice(sep - p.price)}
                  </span>
                </>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PlannerDraft({ state }: { state: string }) {
  const b = useBooking(state);
  return (
    <div className="pb-20">
      <PageTitle title="Equipment" intro={INTRO} />
      <div className="grid gap-16 px-5 md:px-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-16">
          <section>
            <StepTitle n={1} title="Gear">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-white/60 max-sm:hidden">
                  {MODE_NOTE}
                </span>
                <ModeSwitch b={b} />
              </div>
            </StepTitle>
            {b.loading ? (
              <RowsSkeleton />
            ) : b.mode === "package" ? (
              <PackageRows b={b} />
            ) : (
              <ItemRows b={b} />
            )}
          </section>
          <section>
            <StepTitle n={2} title="Dates" />
            <BookingCalendar b={b} />
            <div className="mt-4">
              <ClashNotice b={b} />
            </div>
          </section>
        </div>
        <aside className="lg:sticky lg:top-6 lg:self-start lg:border-l lg:border-white/10 lg:pl-10">
          <StepTitle n={3} title="Request" />
          {b.status === "submitted" ? (
            <Submitted b={b} />
          ) : b.loading ? (
            <div aria-busy className="space-y-4">
              <Bone className="h-6 w-2/3" />
              <Bone className="h-4 w-1/2" />
              <Bone className="mt-6 h-12 w-full" />
              <Bone className="h-12 w-full" />
              <Bone className="h-14 w-full" />
            </div>
          ) : (
            <div className="space-y-8">
              <BookingSummary b={b} />
              <RequestForm b={b} idPrefix="eq-a" />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// B · Wizard: photo hero, then one step at a time with the running total in a
// bar pinned to the bottom.

const wizardSteps = ["Gear", "Dates", "Details", "Done"] as const;
type WizardStep = (typeof wizardSteps)[number];
const startStep: Record<string, WizardStep> = {
  clash: "Dates",
  picked: "Details",
  submitted: "Done",
};

function WizardProgress({
  step,
  onStep,
  reachable,
}: {
  step: WizardStep;
  onStep: (s: WizardStep) => void;
  reachable: (s: WizardStep) => boolean;
}) {
  const index = wizardSteps.indexOf(step);
  return (
    <ol className="flex items-center gap-2" aria-label="Booking progress">
      {wizardSteps.map((s, i) => (
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
                "mx-label flex size-7 shrink-0 items-center justify-center rounded-full text-[10px]",
                i < index && "bg-white text-black",
                i === index &&
                  "bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]",
                i > index && "border border-white/25 text-white/55",
              )}
            >
              {i < index ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "mx-label text-[10px] max-sm:sr-only",
                i === index ? "text-white" : "text-white/55",
              )}
            >
              {s}
            </span>
          </button>
          {i < wizardSteps.length - 1 ? (
            <span className="h-px flex-1 bg-white/15" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function PackageTiles({ b }: { b: Booking }) {
  return (
    <div
      role="radiogroup"
      aria-label="Package"
      className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3"
    >
      {packages.map((p) => {
        const on = b.pkg?.id === p.id;
        const sep = separately(p.items);
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => b.togglePackage(p.id)}
            className={cn(
              "flex min-h-48 flex-col items-start gap-4 p-5 text-left transition-colors",
              on ? "bg-white text-black" : "bg-black hover:bg-[#0b0b0b]",
            )}
          >
            <span className="flex w-full items-start justify-between gap-3">
              <span className="mx-display text-lg">{p.name}</span>
              {on ? <Check className="size-5 shrink-0" /> : null}
            </span>
            <GearChips lines={p.items} inverted={on} />
            <span className="mt-auto flex w-full items-baseline justify-between gap-3">
              <span className="mx-display mx-num text-2xl">
                {formatPrice(p.price)}
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
                    "mx-label mx-num text-[10px]",
                    on ? "text-black/70" : "text-[var(--mx-accent-text)]",
                  )}
                >
                  Save {formatPrice(sep - p.price)}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WizardDraft({ state }: { state: string }) {
  const b = useBooking(state);
  const [step, setStep] = useState<WizardStep>(startStep[state] ?? "Gear");
  // Never show a step whose inputs are missing (e.g. after "Start another request").
  const current: WizardStep =
    b.status === "submitted"
      ? "Done"
      : step === "Gear" || !b.hasGear
        ? "Gear"
        : step === "Dates" || !b.ready
          ? "Dates"
          : "Details";
  const reachable = (s: WizardStep) =>
    s === "Gear" ||
    (s === "Dates" && b.hasGear) ||
    (s === "Details" && b.ready);
  const canNext =
    current === "Gear" ? b.hasGear : current === "Dates" ? b.ready : false;
  const next = () => setStep(current === "Gear" ? "Dates" : "Details");
  const back = () => setStep(current === "Details" ? "Dates" : "Gear");

  return (
    <div>
      <section className="relative flex h-[52svh] min-h-[420px] items-end">
        <Media
          src={photos.booth}
          alt="DJ booth at an Atmos gig"
          sizes="100vw"
          priority
          className="absolute inset-0"
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="mx-scrim-bottom absolute inset-0" />
        <div className="relative w-full px-5 pb-8 md:px-10 md:pb-12">
          <h1 className="mx-display text-[clamp(2.5rem,11vw,9rem)]">
            Equipment
          </h1>
          <p className="mt-4 max-w-[52ch] text-[16px] text-white/75 md:text-[17px]">
            {INTRO}
          </p>
          <p className="mx-label mx-num mt-5 text-[11px] text-white/70">
            {packages.length} packages · from{" "}
            {formatPrice(Math.min(...packages.map((p) => p.price)))}/day
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 pt-10 pb-16 md:px-10">
        <WizardProgress step={current} onStep={setStep} reachable={reachable} />

        <div className="mt-10 min-h-[420px]">
          {current === "Gear" ? (
            <section className="animate-in fade-in-0 duration-200">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h2 className="mx-display text-3xl">Pick your gear</h2>
                <ModeSwitch b={b} />
              </div>
              {b.loading ? (
                <div
                  aria-busy
                  className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="min-h-48 space-y-4 bg-black p-5">
                      <Bone className="h-5 w-2/3" />
                      <Bone className="h-6 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : b.mode === "package" ? (
                <PackageTiles b={b} />
              ) : (
                <ItemRows b={b} />
              )}
              <p className="mt-4 text-[13px] text-white/60">
                {MODE_NOTE} Switching clears the other.
              </p>
            </section>
          ) : null}

          {current === "Dates" ? (
            <section className="animate-in fade-in-0 duration-200">
              <h2 className="mx-display mb-8 text-3xl">When do you need it?</h2>
              <BookingCalendar b={b} />
              <div className="mt-4">
                <ClashNotice b={b} />
              </div>
            </section>
          ) : null}

          {current === "Details" ? (
            <section className="animate-in fade-in-0 grid gap-12 duration-200 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <h2 className="mx-display mb-8 text-3xl">Who&apos;s it for?</h2>
                <RequestForm b={b} idPrefix="eq-b" />
              </div>
              <div className="md:border-l md:border-white/10 md:pl-10">
                <h2 className="mx-display mb-8 text-3xl">Summary</h2>
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
                onClick={back}
                aria-label="Back"
                className="px-4"
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : null}
            <div className="mr-auto min-w-0">
              <p className="mx-display truncate text-base">
                {b.mode === "package"
                  ? (b.pkg?.name ?? "No package yet")
                  : b.hasGear
                    ? `${b.lines.reduce((n, l) => n + l.qty, 0)} items`
                    : "No items yet"}
              </p>
              <p className="mx-num truncate text-[12px] text-white/60">
                {b.range.from && b.range.to
                  ? `${formatRange(b.range.from, b.range.to)} · `
                  : ""}
                {b.hasGear
                  ? b.days
                    ? `${formatPrice(b.total)} total`
                    : `${formatPrice(b.daily)}/day`
                  : "Pick a package or items"}
              </p>
            </div>
            {current !== "Details" ? (
              <Button variant="accent" disabled={!canNext} onClick={next}>
                {current === "Gear" ? "Choose dates" : "Continue"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// C · Dates first: pick the dates, then every package says whether it's free
// for them. Request and summary sit side by side at the end.

function PackageTable({ b }: { b: Booking }) {
  const { from, to } = b.range;
  return (
    <div role="radiogroup" aria-label="Package">
      <div className="mx-label hidden grid-cols-[28px_minmax(0,1.4fr)_minmax(0,1.2fr)_90px_110px_minmax(0,1fr)] gap-4 border-b border-white/10 pb-3 text-[10px] text-white/55 lg:grid">
        <span />
        <span>Package</span>
        <span>Includes</span>
        <span className="text-right">Per day</span>
        <span className="text-right">Separately</span>
        <span className="text-right">
          {from && to ? "Your dates" : "Availability"}
        </span>
      </div>
      {packages.map((p) => {
        const on = b.pkg?.id === p.id;
        const sep = separately(p.items);
        const clash = from && to ? clashesFor(p.items, from, to) : null;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => b.togglePackage(p.id)}
            className={cn(
              "grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b border-white/10 py-4 text-left transition-colors hover:bg-white/[0.03] lg:grid-cols-[28px_minmax(0,1.4fr)_minmax(0,1.2fr)_90px_110px_minmax(0,1fr)]",
              on && "bg-white/[0.05] hover:bg-white/[0.05]",
            )}
          >
            <RadioDot on={on} />
            <span className="mx-display text-base">{p.name}</span>
            <span className="mx-display mx-num text-right text-base lg:order-last lg:hidden">
              {formatPrice(p.price)}
            </span>
            <GearChips
              lines={p.items}
              className="col-start-2 col-end-4 lg:col-auto"
            />
            <span className="mx-display mx-num hidden text-right text-base lg:block">
              {formatPrice(p.price)}
            </span>
            <span className="mx-num hidden text-right text-[13px] text-white/60 lg:block">
              {sep > p.price ? (
                <>
                  <span className="line-through">{formatPrice(sep)}</span>{" "}
                  <span className="text-[var(--mx-accent-text)]">
                    −{formatPrice(sep - p.price)}
                  </span>
                </>
              ) : (
                formatPrice(sep)
              )}
            </span>
            <span
              className={cn(
                "col-start-2 col-end-4 text-[13px] lg:col-auto lg:text-right",
                !clash
                  ? "text-white/50"
                  : clash.dates.length
                    ? "text-[#ff8a8a]"
                    : "text-[var(--mx-accent-text)]",
              )}
            >
              {!clash
                ? "Pick dates to check"
                : clash.dates.length
                  ? `Out on ${clash.dates.map(formatShort).join(", ")}`
                  : "Free for your dates"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DatesFirstDraft({ state }: { state: string }) {
  const b = useBooking(state);
  return (
    <div className="pb-20">
      <PageTitle title="Equipment" intro={INTRO} />
      <div className="space-y-16 px-5 md:px-10">
        <section>
          <StepTitle n={1} title="When" />
          <BookingCalendar b={b} className="max-w-4xl" />
        </section>
        <section>
          <StepTitle n={2} title="What">
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-white/60 max-sm:hidden">
                {MODE_NOTE}
              </span>
              <ModeSwitch b={b} />
            </div>
          </StepTitle>
          {b.loading ? (
            <RowsSkeleton />
          ) : b.mode === "package" ? (
            <PackageTable b={b} />
          ) : (
            <ItemRows b={b} />
          )}
          <div className="mt-4 max-w-3xl">
            <ClashNotice b={b} />
          </div>
        </section>
        <section>
          <StepTitle n={3} title="Request" />
          {b.status === "submitted" ? (
            <Submitted b={b} />
          ) : (
            <div className="grid gap-12 md:grid-cols-2 lg:gap-16">
              <div className="md:order-last md:border-l md:border-white/10 md:pl-10">
                {b.loading ? (
                  <div aria-busy className="space-y-4">
                    <Bone className="h-6 w-2/3" />
                    <Bone className="h-4 w-1/2" />
                  </div>
                ) : (
                  <BookingSummary b={b} />
                )}
              </div>
              <RequestForm b={b} idPrefix="eq-c" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export const equipmentPage: PageSpec = {
  id: "equipment",
  title: "Equipment",
  route: "/equipment",
  states: [
    { id: "fresh", label: "Fresh", hint: "Nothing picked" },
    {
      id: "picked",
      label: "Package + dates",
      hint: "4 CDJs + Mixer + Sound system, 30 Oct to 1 Nov",
    },
    {
      id: "clash",
      label: "Dates clash",
      hint: "4 CDJs + Mixer over an existing booking (illustrative)",
    },
    {
      id: "items",
      label: "Items mode",
      hint: "2 CDJs and the A9 while two CDJs are already out",
    },
    { id: "submitted", label: "Submitted" },
    { id: "loading", label: "Loading" },
  ],
  drafts: [
    {
      id: "a",
      label: "A · Planner",
      note: "The live flow on one screen: gear and calendar left, sticky request and summary right. Item prices, stock and bookings illustrative.",
      Component: ({ state }) => <PlannerDraft key={state} state={state} />,
    },
    {
      id: "b",
      label: "B · Wizard",
      note: "Booth photo hero, then one step at a time with the running total pinned to the bottom.",
      heroUnderHeader: true,
      Component: ({ state }) => <WizardDraft key={state} state={state} />,
    },
    {
      id: "c",
      label: "C · Dates first",
      note: "Pick dates first; every package then says whether it's free for them.",
      Component: ({ state }) => <DatesFirstDraft key={state} state={state} />,
    },
  ],
};
