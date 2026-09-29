"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Minus,
  Plus,
  Search,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { photos } from "../fixtures";
import { GlassSelect } from "../inputs";
import { Button, IconButton, Media, VariantTag } from "../primitives";

function ButtonMatrix() {
  const variants = ["solid", "accent", "outline", "glass", "ghost"] as const;
  return (
    <div className="relative overflow-hidden">
      <Media
        src={photos.crowd}
        alt=""
        sizes="100vw"
        className="absolute inset-0 opacity-60"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/20" />
      <div className="relative grid gap-8 px-5 py-10 md:px-10">
        {variants.map((v) => (
          <div
            key={v}
            className="grid items-center gap-4 md:grid-cols-[120px_1fr]"
          >
            <span className="font-mono text-[11px] text-white/45 uppercase">
              {v}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant={v} size="lg">
                Get tickets
              </Button>
              <Button variant={v}>Details</Button>
              <Button variant={v} size="sm">
                Lineup
              </Button>
              <Button variant={v} disabled>
                Sold out
              </Button>
            </div>
          </div>
        ))}
        <div className="grid items-center gap-4 md:grid-cols-[120px_1fr]">
          <span className="font-mono text-[11px] text-white/45 uppercase">
            icon
          </span>
          <div className="flex gap-3">
            <IconButton label="Previous">
              <ChevronLeft className="size-5" />
            </IconButton>
            <IconButton label="Next">
              <ChevronRight className="size-5" />
            </IconButton>
            <IconButton label="Next" disabled>
              <ChevronRight className="size-5" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/** idle → busy → done → idle, so every button state can be seen in place. */
function HoldButton() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const run = () => {
    setState("busy");
    setTimeout(() => setState("done"), 1400);
    setTimeout(() => setState("idle"), 3400);
  };
  return (
    <Button
      size="lg"
      variant={state === "done" ? "accent" : "solid"}
      onClick={run}
      disabled={state !== "idle"}
      aria-busy={state === "busy"}
      className="min-w-[240px] disabled:opacity-100 data-[busy=true]:opacity-60"
      data-busy={state === "busy"}
    >
      {state === "idle" ? (
        "Hold 2 tickets"
      ) : state === "busy" ? (
        "Holding…"
      ) : (
        <>
          <Check className="size-4" /> Held for 10 min
        </>
      )}
    </Button>
  );
}

function StateRow() {
  return (
    <div className="grid gap-px bg-white/10 md:grid-cols-4">
      <div className="bg-black p-6">
        <p className="mb-4 font-mono text-[11px] text-white/45 uppercase">
          Loading
        </p>
        <HoldButton />
        <p className="mt-3 text-[13px] text-white/55">
          Click it. Label changes, no spinner.
        </p>
      </div>
      <div className="bg-black p-6">
        <p className="mb-4 font-mono text-[11px] text-white/45 uppercase">
          Block
        </p>
        <button
          type="button"
          className="mx-label flex h-14 w-full items-center justify-between bg-white px-5 text-[13px] text-black transition-colors hover:bg-[var(--mx-accent)] hover:text-[var(--mx-accent-ink)]"
        >
          Tickets <ArrowRight className="size-4" />
        </button>
        <p className="mt-3 text-[13px] text-white/55">
          Hard edges: sits flush at the foot of a card.
        </p>
      </div>
      <div className="bg-black p-6">
        <p className="mb-4 font-mono text-[11px] text-white/45 uppercase">
          Link
        </p>
        <a
          href="#"
          className="mx-label inline-flex items-center gap-1 text-[12px] text-[var(--mx-accent-text)] underline-offset-4 hover:underline"
        >
          See all past gigs <ArrowRight className="size-3.5" />
        </a>
        <p className="mt-3 text-[13px] text-white/55">
          Inline actions in lists and rails.
        </p>
      </div>
      <div className="bg-black p-6">
        <p className="mb-4 font-mono text-[11px] text-white/45 uppercase">
          Status
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="mx-label rounded-[var(--mx-r-chip)] bg-[var(--mx-accent)] px-2 py-1.5 text-[10px] text-[var(--mx-accent-ink)]">
            On sale
          </span>
          <span className="mx-label rounded-[var(--mx-r-chip)] bg-white px-2 py-1.5 text-[10px] text-black">
            Free
          </span>
          <span className="mx-label rounded-[var(--mx-r-chip)] border border-white/30 px-2 py-1.5 text-[10px] text-white/70">
            Sold out
          </span>
          <span className="mx-label rounded-[var(--mx-r-chip)] border border-dashed border-white/30 px-2 py-1.5 text-[10px] text-white/70">
            TBA
          </span>
        </div>
      </div>
    </div>
  );
}

function Tabs() {
  const tabs = [
    { key: "upcoming", label: "Upcoming", count: 2 },
    { key: "past", label: "Past", count: 16 },
    { key: "affiliated", label: "Affiliated", count: 1 },
  ];
  const [active, setActive] = useState("upcoming");

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
      <div>
        <p className="mb-4 font-mono text-[11px] text-white/45 uppercase">
          Underline tabs
        </p>
        <div
          role="tablist"
          className="no-scrollbar flex gap-8 overflow-x-auto border-b border-white/10"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={active === t.key}
              onClick={() => setActive(t.key)}
              className={cn(
                "mx-label -mb-px flex items-baseline gap-2 border-b-2 pb-4 text-[12px] transition-colors",
                active === t.key
                  ? "border-[var(--mx-accent)] text-white"
                  : "border-transparent text-white/50 hover:text-white",
              )}
            >
              {t.label}
              <span className="mx-num text-[10px] text-white/45">
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-4 font-mono text-[11px] text-white/45 uppercase">
          Pill tabs
        </p>
        <div
          role="tablist"
          className="no-scrollbar inline-flex max-w-full overflow-x-auto rounded-full border border-white/15 p-1"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={active === t.key}
              onClick={() => setActive(t.key)}
              className={cn(
                "mx-label flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[11px] transition-colors md:px-5",
                active === t.key
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "mx-num text-[10px]",
                  active === t.key ? "text-black/50" : "text-white/40",
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Fields() {
  const [view, setView] = useState<"list" | "grid">("list");
  const [qty, setQty] = useState(2);
  const [chip, setChip] = useState("All");
  const [venue, setVenue] = useState("all");

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
      <div className="space-y-4">
        <p className="font-mono text-[11px] text-white/45 uppercase">
          Filter bar
        </p>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-48 flex-1">
            <GlassSelect
              label="Venue"
              value={venue}
              onValueChange={setVenue}
              options={[
                { value: "all", label: "All venues" },
                { value: "sanfran", label: "San Fran" },
                { value: "meow", label: "Meow" },
                { value: "grand", label: "The Grand", disabled: true },
              ]}
            />
          </div>
          <div
            className="inline-flex rounded-full border border-white/15 p-1"
            role="group"
            aria-label="View"
          >
            {(["list", "grid"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "mx-label flex h-10 items-center gap-2 rounded-full px-4 text-[11px] transition-colors",
                  view === v
                    ? "bg-white text-black"
                    : "text-white/60 hover:text-white",
                )}
              >
                {v === "list" ? (
                  <List className="size-4" />
                ) : (
                  <LayoutGrid className="size-4" />
                )}
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {["All", "Club nights", "Tours", "Free", "Day parties"].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={chip === c}
              onClick={() => setChip(c)}
              className={cn(
                "h-9 rounded-full border px-4 text-[13px] transition-colors",
                chip === c
                  ? "border-white bg-white text-black"
                  : "border-white/15 text-white/75 hover:border-white/40",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="relative block">
          <span className="sr-only">Search gigs</span>
          <Search className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-white/50" />
          <input
            placeholder="Search artists, venues"
            className="h-12 w-full rounded-full border border-white/15 bg-white/[0.04] pr-5 pl-12 text-[15px] text-white outline-none placeholder:text-white/45 hover:border-white/30 focus:border-white/60"
          />
        </label>
      </div>

      <div className="space-y-4">
        <p className="font-mono text-[11px] text-white/45 uppercase">
          Email capture
        </p>
        <form
          className="flex h-14 items-center rounded-full border border-white/20 bg-white/[0.04] p-1.5 pl-6 focus-within:border-white/60"
          onSubmit={(e) => e.preventDefault()}
        >
          <label className="sr-only" htmlFor="mx-email">
            Email
          </label>
          <input
            id="mx-email"
            type="email"
            placeholder="Email address"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/45"
          />
          <Button type="submit" className="h-full">
            Subscribe
          </Button>
        </form>
        <div>
          <form
            className="flex h-14 items-center rounded-full border border-[#ff6b6b] bg-white/[0.04] p-1.5 pl-6"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              aria-invalid
              defaultValue="will@atmos"
              aria-describedby="mx-email-err"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
            <Button type="submit" className="h-full">
              Subscribe
            </Button>
          </form>
          <p id="mx-email-err" className="mt-2 pl-6 text-[13px] text-[#ff8a8a]">
            Add the rest of your email, e.g. will@atmos.co.nz
          </p>
        </div>

        <p className="pt-4 font-mono text-[11px] text-white/45 uppercase">
          Quantity
        </p>
        <div className="inline-flex h-12 items-center rounded-full border border-white/15">
          <button
            type="button"
            aria-label="Fewer"
            disabled={qty <= 0}
            onClick={() => setQty((q) => q - 1)}
            className="flex size-12 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
          >
            <Minus className="size-4" />
          </button>
          <span
            className="mx-display mx-num w-8 text-center text-lg"
            aria-live="polite"
          >
            {qty}
          </span>
          <button
            type="button"
            aria-label="More"
            disabled={qty >= 10}
            onClick={() => setQty((q) => q + 1)}
            className="flex size-12 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ControlsSection() {
  return (
    <div className="space-y-14 pb-16">
      <div>
        <VariantTag>Buttons · on imagery</VariantTag>
        <ButtonMatrix />
      </div>
      <div>
        <VariantTag>States and small actions</VariantTag>
        <StateRow />
      </div>
      <div className="px-5 md:px-10">
        <Tabs />
      </div>
      <div className="px-5 md:px-10">
        <Fields />
      </div>
    </div>
  );
}
