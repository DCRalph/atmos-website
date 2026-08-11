"use client";

import { useMemo, useState } from "react";

import {
  SearchableSelect,
  type SearchableOption,
} from "~/components/ui/searchable-select";

/**
 * A combobox wired to a picker endpoint.
 *
 * Because every picker shares one contract, this component works with any of
 * them — you point it at the endpoint and it handles search, debouncing,
 * limits and keeping the selected label resolved:
 *
 * ```tsx
 * <PickerSelect
 *   endpoint={api.pickers.gigs}
 *   value={gigId}
 *   onChange={setGigId}
 *   clearLabel="No gig"
 * />
 * ```
 *
 * With picker-specific narrowing:
 *
 * ```tsx
 * <PickerSelect
 *   endpoint={api.pickers.doorStaff}
 *   filter={{ excludeEventId: event.id }}
 *   value={userId}
 *   onChange={(next) => setUserId(next ?? "")}
 * />
 * ```
 *
 * The selected value is sent back as `includeValues`, so the server always
 * returns that row even when the query no longer matches it. That is what
 * stops the trigger falling back to a raw cuid while you type — no call site
 * has to pass a label for the current selection.
 */

type PickerData = {
  options: SearchableOption[];
  total: number;
};

/**
 * Structural shape of a tRPC query hook for a picker. Typed loosely on purpose
 * so any `api.pickers.*` endpoint satisfies it without generic gymnastics.
 */
export type PickerEndpoint<TFilter> = {
  useQuery: (
    input: {
      query: string;
      limit?: number;
      includeValues?: string[];
      filter?: TFilter;
    },
    options?: { placeholderData?: (previous: PickerData | undefined) => PickerData | undefined },
  ) => { data?: PickerData; isFetching: boolean };
};

export function PickerSelect<TFilter = Record<string, never>>({
  endpoint,
  value,
  onChange,
  filter,
  limit,
  placeholder,
  searchPlaceholder,
  emptyText,
  clearLabel,
  disabled,
  id,
  className,
}: {
  endpoint: PickerEndpoint<TFilter>;
  value: string | null;
  onChange: (value: string | null) => void;
  filter?: TFilter;
  limit?: number;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Provide to make the field clearable, e.g. "No gig". */
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");

  const includeValues = useMemo(() => (value ? [value] : []), [value]);

  const result = endpoint.useQuery(
    { query, limit, includeValues, filter },
    // Hold the previous page while the next one loads, so the list doesn't
    // collapse to "Searching…" on every keystroke.
    { placeholderData: (previous) => previous },
  );

  return (
    <SearchableSelect
      id={id}
      className={className}
      value={value}
      onChange={onChange}
      options={result.data?.options ?? []}
      total={result.data?.total}
      loading={result.isFetching}
      onSearchChange={setQuery}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      clearLabel={clearLabel}
      disabled={disabled}
    />
  );
}
