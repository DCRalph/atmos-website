"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "~/components/ui/popover";
import {
  clockOptions,
  formatClock,
  parseClock,
} from "~/lib/run-sheet/night";
import { cn } from "~/lib/utils";

/**
 * A time of day, typed or picked.
 *
 * Deals in minutes past midnight rather than in dates, because a run sheet row
 * is a clock time and which calendar day it lands on is somebody else's
 * problem. Writes and reads am/pm, which is how anybody in a venue says it.
 *
 * The typing is deliberately forgiving: `9pm`, `9:30 pm`, `930p`, `21:30`,
 * `2130`, `noon`. Where what was typed is genuinely two times — `9:30` is
 * either of them — both are offered at the top of the list rather than one
 * being guessed at silently. It commits the evening one, because gig nights are
 * evenings, and the field then shows `9:30 pm` so a wrong guess is visible.
 *
 * Not `<input type="time">`: the native control renders at three different
 * widths across browsers, and its picker is a worse version of this list.
 */

/** Minutes between the times offered in the list. */
const DEFAULT_STEP_MINUTES = 15;

export function TimeField({
  value,
  onChange,
  disabled,
  placeholder = "--:--",
  ariaLabel,
  className,
  suffix,
  stepMinutes = DEFAULT_STEP_MINUTES,
}: {
  /** Minutes past midnight, or null for no time. */
  value: number | null;
  onChange: (minutes: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** Rendered inside the field on the right, for a marker like "+1". */
  suffix?: ReactNode;
  stepMinutes?: number;
}) {
  const [text, setText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const shown = value === null ? "" : formatClock(value);
  const options = isEditing ? optionsFor(text, stepMinutes) : [];
  const safeIndex = Math.min(activeIndex, Math.max(options.length - 1, 0));

  // Opening on the current time rather than on midnight, so a list of 96 rows
  // starts where the answer probably is.
  useEffect(() => {
    if (!isEditing) return;
    listRef.current
      ?.querySelector(`[data-index="${safeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [isEditing, safeIndex]);

  const open = (initial: string) => {
    setText(initial);
    setIsEditing(true);
    const parsed = parseClock(initial);
    const all = optionsFor(initial, stepMinutes);
    const start =
      parsed.length > 0
        ? 0
        : value === null
          ? 0
          : Math.max(
              all.findIndex((minutes) => minutes >= value),
              0,
            );
    setActiveIndex(start);
  };

  const commit = (minutes: number | null) => {
    setIsEditing(false);
    onChange(minutes);
  };

  const commitTyped = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      commit(null);
      return;
    }
    const picked = options[safeIndex] ?? parseClock(trimmed)[0];
    // Not a time, and nothing in the list to mean instead. Snap back rather
    // than storing a guess.
    if (picked === undefined) {
      setIsEditing(false);
      return;
    }
    commit(picked);
  };

  return (
    <Popover
      open={isEditing && !disabled}
      // Radix closes on Escape and on a click outside; both mean the same thing
      // here as tabbing away does.
      onOpenChange={(next) => {
        if (!next) setIsEditing(false);
      }}
    >
      <PopoverAnchor asChild>
        <div className={cn("relative", className ?? "w-[110px]")}>
          <Input
            aria-label={ariaLabel}
            aria-expanded={isEditing}
            role="combobox"
            autoComplete="off"
            placeholder={placeholder}
            value={isEditing ? text : shown}
            disabled={disabled}
            onFocus={(e) => {
              open(shown);
              e.currentTarget.select();
            }}
            onChange={(e) => {
              setText(e.target.value);
              setActiveIndex(0);
              if (!isEditing) setIsEditing(true);
            }}
            onBlur={commitTyped}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (options.length === 0) return;
                const delta = e.key === "ArrowDown" ? 1 : -1;
                setActiveIndex(
                  (safeIndex + delta + options.length) % options.length,
                );
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setIsEditing(false);
                e.currentTarget.blur();
              }
            }}
            className={cn("h-7 text-sm tabular-nums", suffix && "pr-7")}
          />
          {suffix ? (
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[10px]">
              {suffix}
            </span>
          ) : null}
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        // Focus stays in the input: this is a list attached to a field, not a
        // dialog, and taking focus would end the typing that opened it.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-[136px] p-1"
      >
        <div
          ref={listRef}
          role="listbox"
          className="max-h-60 overflow-y-auto"
        >
          {options.length === 0 ? (
            <p className="text-muted-foreground px-2 py-2 text-xs">
              Not a time.
            </p>
          ) : null}

          {options.map((minutes, index) => (
            <div
              key={minutes}
              data-index={index}
              role="option"
              aria-selected={index === safeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(minutes)}
              onPointerEnter={() => setActiveIndex(index)}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1 text-sm tabular-nums",
                index === safeIndex && "bg-accent",
                minutes === value && "font-semibold",
              )}
            >
              {formatClock(minutes)}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * What to offer for what has been typed.
 *
 * Nothing typed is the whole clock. Something typed puts every reading of it
 * first, then the rest of those hours, so "9" reaches 9:45 pm in two keystrokes
 * and 9 am in one arrow key.
 */
function optionsFor(text: string, stepMinutes: number): number[] {
  const trimmed = text.trim();
  if (!trimmed) return clockOptions(stepMinutes);

  const readings = parseClock(trimmed);
  if (readings.length === 0) return [];

  const seen = new Set(readings);
  const options = [...readings];

  for (const reading of readings) {
    const hourStart = Math.floor(reading / 60) * 60;
    for (const minutes of clockOptions(stepMinutes)) {
      if (minutes < hourStart || minutes >= hourStart + 60) continue;
      if (seen.has(minutes)) continue;
      seen.add(minutes);
      options.push(minutes);
    }
  }

  return options;
}
