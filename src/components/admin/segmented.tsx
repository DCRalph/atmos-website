"use client";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * A small set of mutually exclusive choices in a row, like a chart's range or
 * which measure it shows. Lighter than tabs: it switches what's drawn, not
 * which page you're on.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** What's being chosen, for screen readers: "Range". */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex gap-0.5 rounded-lg border p-0.5", className)}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          role="tab"
          size="sm"
          aria-selected={value === option.value}
          variant={value === option.value ? "secondary" : "ghost"}
          className="h-7 px-2.5"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
