"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

/**
 * The filter row above an admin ticketing list.
 *
 * Deliberately a handful of named questions — "named or not", "arrived or not"
 * — rather than the generic column filters the data table can build. The
 * questions people actually ask of a door list are about the state of a ticket,
 * not the contents of a column, and each one here maps to a single `where`
 * clause the server can answer without loading the list first.
 *
 * `null` is "any", which is why the value type is nullable rather than carrying
 * an `"ALL"` member: no caller should have to handle a sentinel that means the
 * filter is off.
 */

export type FilterChoice<T extends string> = {
  value: T;
  label: string;
};

const ANY = "__any__";

export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  anyLabel = "Any",
}: {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  options: readonly FilterChoice<T>[];
  anyLabel?: string;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <Select
      value={value ?? ANY}
      onValueChange={(next) => onChange(next === ANY ? null : (next as T))}
    >
      <SelectTrigger
        size="sm"
        aria-label={label}
        className={cn(
          "max-w-56",
          // An active filter has to be visible from across the room: somebody
          // reading "3 tickets" needs to know why it isn't three hundred.
          selected && "border-primary/60 bg-primary/5",
        )}
      >
        <span className="truncate">
          <span className="text-muted-foreground">{label}: </span>
          {selected?.label ?? anyLabel}
        </span>
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value={ANY}>{anyLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Wraps the selects and, once anything is set, the way back out. */
export function ListFilters({
  children,
  activeCount,
  onClear,
  summary,
}: {
  children: ReactNode;
  activeCount: number;
  onClear: () => void;
  /** What the filters left behind — "12 of 340", say. */
  summary?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-3.5" /> Clear
        </Button>
      )}
      {summary && (
        <span className="text-muted-foreground ml-auto text-sm">{summary}</span>
      )}
    </div>
  );
}
