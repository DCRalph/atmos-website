"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { photos } from "../fixtures";
import { AtmosLogo, Button, Media, VariantTag } from "../primitives";
import {
  accentVars,
  accents,
  faceVars,
  faces,
  type AccentKey,
  type FaceKey,
} from "../tokens";

const scale = [
  {
    name: "Display XL",
    className: "mx-display text-[clamp(3rem,7vw,6rem)]",
    sample: "Intuition",
  },
  {
    name: "Display L",
    className: "mx-display text-[clamp(2.25rem,4.5vw,3.5rem)]",
    sample: "All gigs",
  },
  { name: "Display M", className: "mx-display text-[2rem]", sample: "October" },
  {
    name: "Display S",
    className: "mx-display text-[1.25rem]",
    sample: "Club Vitiman",
  },
  {
    name: "Label",
    className: "mx-label text-[12px]",
    sample: "Fri 09 Oct · San Fran",
  },
  {
    name: "Body",
    className: "text-base leading-relaxed text-white/80 max-w-[60ch]",
    sample:
      "Curated club nights and immersive electronic music in Pōneke. Body copy stays normal width so paragraphs read easily under the wide headlines.",
  },
  {
    name: "Small",
    className: "text-[13px] text-white/60",
    sample: "Doors 9pm · R18 · ID required",
  },
];

function TypeScale() {
  return (
    <div className="divide-y divide-white/10 border-y border-white/10">
      {scale.map((row) => (
        <div
          key={row.name}
          className="grid gap-3 px-5 py-6 md:grid-cols-[160px_1fr] md:items-baseline md:px-10"
        >
          <span className="font-mono text-[11px] text-white/45 uppercase">
            {row.name}
          </span>
          <p className={row.className}>{row.sample}</p>
        </div>
      ))}
    </div>
  );
}

/** Every heading candidate on the same copy, with the logo first for reference. */
function FaceCompare() {
  return (
    <div className="grid grid-cols-1 gap-px border-y border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col justify-between gap-6 bg-black px-5 py-8 md:px-8">
        <p className="font-mono text-[11px] text-white/45 uppercase">
          Logo (custom lettering)
        </p>
        <AtmosLogo className="w-full max-w-[260px]" />
        <p className="text-[13px] text-white/55">
          Flat-topped A, square O and M, heavy, arched.
        </p>
      </div>
      {(Object.keys(faces) as FaceKey[]).map((key) => (
        <div
          key={key}
          style={faceVars(key)}
          className="bg-black px-5 py-8 md:px-8"
        >
          <p className="mb-6 font-mono text-[11px] text-white/45 uppercase">
            {faces[key].name}
            {"headingsOnly" in faces[key] ? " · headings only" : ""}
          </p>
          <p className="mx-display text-[clamp(1.75rem,2.6vw,2.5rem)]">
            Join the atmosphere
          </p>
          <p className="mx-display mt-3 text-[clamp(1.1rem,1.6vw,1.5rem)] text-white/80">
            Intuition Vol.3 · Pōneke
          </p>
          <p className="mx-label mt-5 text-[12px] text-white/70">
            Gigs · Content · Merch · Crew
          </p>
        </div>
      ))}
    </div>
  );
}

function AccentCompare() {
  return (
    <div className="grid grid-cols-1 border-y border-white/10 sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-white/10">
      {(Object.keys(accents) as AccentKey[]).map((key) => (
        <div
          key={key}
          style={accentVars(key)}
          className="flex flex-col gap-6 border-b border-white/10 px-5 py-8 lg:border-b-0 lg:px-6"
        >
          <div className="flex items-center gap-3">
            <span className="size-5 rounded-full bg-[var(--mx-accent)] ring-1 ring-white/20" />
            <p className="font-mono text-[11px] text-white/60 uppercase">
              {accents[key].name}
            </p>
          </div>
          <div className="flex items-end gap-4">
            <div className="flex flex-col items-center rounded-[var(--mx-r-chip)] bg-[var(--mx-accent)] px-3 py-1.5 text-[var(--mx-accent-ink)]">
              <span className="mx-label text-[10px]">Oct</span>
              <span className="mx-display mx-num text-2xl">09</span>
            </div>
            <span className="mx-display mx-num text-5xl text-[var(--mx-accent-text)]">
              10
            </span>
          </div>
          <div className="flex gap-6 border-b border-white/10">
            <span className="mx-label border-b-2 border-[var(--mx-accent)] pb-3 text-[11px]">
              Upcoming
            </span>
            <span className="mx-label pb-3 text-[11px] text-white/50">
              Past
            </span>
          </div>
          <Button variant="accent" className="self-start">
            Get tickets
          </Button>
          <a
            href="#"
            className="mx-label flex items-center gap-1 text-[11px] text-[var(--mx-accent-text)]"
          >
            Tickets <ArrowRight className="size-3.5" />
          </a>
        </div>
      ))}
    </div>
  );
}

const shapes = [
  {
    name: "Hard",
    rule: "Media, full-bleed bars, anything touching the viewport edge.",
    className: "rounded-none",
  },
  {
    name: "Panel 16",
    rule: "Floating glass panels and cards that sit on imagery.",
    className: "rounded-[var(--mx-r-panel)]",
  },
  {
    name: "Notch",
    rule: "Panel with one square corner that points at what it belongs to.",
    className: "rounded-[var(--mx-r-panel)] rounded-tl-none",
  },
  {
    name: "Pill",
    rule: "Anything you press: buttons, tabs, inputs, filter chips.",
    className: "rounded-full",
  },
  {
    name: "Chip 6",
    rule: "Tiny data tags: date blocks, status, counts.",
    className: "rounded-[var(--mx-r-chip)]",
  },
];

function Shapes() {
  return (
    <div className="grid grid-cols-2 gap-px bg-white/10 md:grid-cols-5">
      {shapes.map((s) => (
        <div key={s.name} className="flex flex-col gap-5 bg-black p-5 md:p-6">
          <div
            className={cn(
              "h-20 border border-white/25 bg-white/[0.06]",
              s.className,
              s.name === "Pill" && "h-12",
              s.name === "Chip 6" && "h-12 w-16",
            )}
          />
          <div>
            <p className="mx-label text-[12px]">{s.name}</p>
            <p className="mt-2 text-[13px] leading-snug text-white/60">
              {s.rule}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function GlassLevels() {
  return (
    <div className="relative overflow-hidden">
      <Media
        src={photos.caged}
        alt=""
        sizes="100vw"
        className="absolute inset-0"
      />
      <div className="relative grid gap-4 p-5 md:grid-cols-3 md:p-10">
        <div className="mx-glass rounded-[var(--mx-r-panel)] p-6">
          <p className="mx-label text-[12px]">Glass</p>
          <p className="mt-3 text-sm text-white/80">
            7% white, 18px blur. Controls and short labels floating on photos.
          </p>
        </div>
        <div className="mx-glass-dark rounded-[var(--mx-r-panel)] p-6">
          <p className="mx-label text-[12px]">Glass dark</p>
          <p className="mt-3 text-sm text-white/80">
            55% black, 22px blur. Panels holding real text, lists and forms.
          </p>
        </div>
        <div className="mx-glass-dark mx-float rounded-[var(--mx-r-panel)] rounded-tl-none p-6">
          <p className="mx-label text-[12px]">Floating</p>
          <p className="mt-3 text-sm text-white/80">
            Glass dark plus drop shadow. Popups and toasts above content.
          </p>
        </div>
      </div>
    </div>
  );
}

export function FoundationsSection() {
  return (
    <div className="space-y-14 pb-16">
      <div>
        <VariantTag>Heading face · same copy in each candidate</VariantTag>
        <FaceCompare />
      </div>
      <div>
        <VariantTag>Type scale · current face</VariantTag>
        <TypeScale />
      </div>
      <div>
        <VariantTag>
          Accent candidates · one colour, used only for buy and active states
        </VariantTag>
        <AccentCompare />
      </div>
      <div>
        <VariantTag>
          Shape rules · hard where it meets an edge, round where you touch it
        </VariantTag>
        <Shapes />
      </div>
      <div>
        <VariantTag>Glass · only over imagery</VariantTag>
        <GlassLevels />
      </div>
    </div>
  );
}
