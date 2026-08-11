"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

/**
 * A combobox: a select you can type into.
 *
 * Built for lists that grow without bound — events, gigs, users. A plain
 * `<Select>` renders every row into the DOM and gives you no way to find
 * anything, which is fine at ten options and unusable at a thousand.
 *
 * Search is intended to run on the server: the parent gets `onSearchChange`
 * (already debounced) and swaps `options` for the matching page. That keeps the
 * payload to a page of results no matter how big the table gets. `total` lets
 * the list say so honestly when there is more behind the fold, rather than
 * silently truncating.
 *
 * Implements the ARIA combobox pattern — the trigger owns `aria-expanded` and
 * `aria-controls`, the input drives `aria-activedescendant`, and the list is a
 * real `listbox` of `option`s, so it works with a screen reader and with the
 * keyboard alone.
 */

export type SearchableOption = {
  value: string;
  label: string;
  /** Secondary line — an email, a date, a venue. */
  description?: string;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  onSearchChange,
  loading = false,
  total,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  emptyText = "Nothing matches that.",
  /** Label for the "no selection" entry. Omit to make the field required. */
  clearLabel,
  /** Shown on the trigger when the selection isn't in the loaded page. */
  selectedLabel,
  disabled = false,
  id,
  className,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  options: SearchableOption[];
  onSearchChange?: (query: string) => void;
  loading?: boolean;
  total?: number;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearLabel?: string;
  selectedLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;

  /**
   * The last option picked here, remembered so the trigger keeps showing a
   * name after the search moves on and the selected row drops out of
   * `options`. Without it the trigger falls back to displaying a raw cuid.
   *
   * Three sources, in order: the option is in the current page; we picked it
   * ourselves this session; the parent told us its label (editing an existing
   * record, where the value arrives before any search has run).
   */
  const [lastPicked, setLastPicked] = useState<SearchableOption | null>(null);

  const resolvedLabel =
    options.find((option) => option.value === value)?.label ??
    (lastPicked?.value === value ? lastPicked.label : null) ??
    selectedLabel ??
    null;

  // Debounced so typing "wellington" is one query, not ten.
  useEffect(() => {
    if (!onSearchChange) return;
    const timer = setTimeout(() => onSearchChange(query.trim()), 220);
    return () => clearTimeout(timer);
  }, [query, onSearchChange]);

  /** Client-side filter only when the parent isn't doing it server-side. */
  const visible = useMemo(() => {
    if (onSearchChange) return options;
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.description?.toLowerCase().includes(needle),
    );
  }, [options, query, onSearchChange]);

  const rows: (SearchableOption | "CLEAR")[] = useMemo(
    () => (clearLabel ? ["CLEAR", ...visible] : visible),
    [visible, clearLabel],
  );

  /**
   * Put the highlight back on the first row whenever the result set changes,
   * so Enter always picks the best match rather than whatever happened to be
   * at index 3 before you typed.
   *
   * Adjusted during render rather than in an effect: React re-runs the
   * component immediately without committing the intermediate state, so there
   * is no flash of a stale highlight and no cascading render.
   */
  const firstRow = rows[0];
  const resetKey = `${query}|${rows.length}|${
    firstRow && firstRow !== "CLEAR" ? firstRow.value : ""
  }`;
  const [seenResetKey, setSeenResetKey] = useState(resetKey);
  if (resetKey !== seenResetKey) {
    setSeenResetKey(resetKey);
    setActiveIndex(0);
  }

  const commit = useCallback(
    (row: SearchableOption | "CLEAR") => {
      setLastPicked(row === "CLEAR" ? null : row);
      onChange(row === "CLEAR" ? null : row.value);
      setOpen(false);
      setQuery("");
    },
    [onChange],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (rows.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const next = (current + delta + rows.length) % rows.length;
        listRef.current
          ?.querySelector(`[data-index="${next}"]`)
          ?.scrollIntoView({ block: "nearest" });
        return next;
      });
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : rows.length - 1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[activeIndex];
      if (row) commit(row);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const truncated = total !== undefined && total > visible.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            "border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span
            className={cn(
              "truncate",
              !resolvedLabel && "text-muted-foreground",
            )}
          >
            {resolvedLabel ?? placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {value && clearLabel && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear selection"
                className="hover:text-foreground text-muted-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(null);
                }}
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronsUpDown
              className="text-muted-foreground size-4"
              aria-hidden
            />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        // The search box stays put and the list below it takes whatever room
        // is left, rather than the whole popover scrolling as one.
        className="flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) flex-col overflow-x-hidden overflow-y-hidden p-0"
        align="start"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={
              rows.length > 0 ? `${listboxId}-${activeIndex}` : undefined
            }
            className="placeholder:text-muted-foreground h-10 w-full bg-transparent text-sm outline-none"
          />
          {loading && (
            <Loader2
              className="text-muted-foreground size-4 shrink-0 animate-spin"
              aria-label="Searching"
            />
          )}
        </div>

        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="min-h-0 flex-1 overflow-y-auto p-1"
        >
          {rows.length === 0 && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              {loading ? "Searching…" : emptyText}
            </p>
          )}

          {rows.map((row, index) => {
            const isClear = row === "CLEAR";
            const rowValue = isClear ? null : row.value;
            const selected = rowValue === value;
            const active = index === activeIndex;

            return (
              <div
                key={isClear ? "__clear" : row.value}
                id={`${listboxId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={selected}
                onClick={() => commit(row)}
                onPointerEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-sm px-2 py-2 text-sm",
                  active && "bg-accent text-accent-foreground",
                )}
              >
                <Check
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    selected ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate",
                      isClear && "text-muted-foreground italic",
                    )}
                  >
                    {isClear ? clearLabel : row.label}
                  </span>
                  {!isClear && row.description && (
                    <span className="text-muted-foreground block truncate text-xs">
                      {row.description}
                    </span>
                  )}
                </span>
              </div>
            );
          })}

          {truncated && (
            <p className="text-muted-foreground border-t px-3 py-2 text-xs">
              Showing {visible.length} of {total}. Keep typing to narrow it
              down.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
