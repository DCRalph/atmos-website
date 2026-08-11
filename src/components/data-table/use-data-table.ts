"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ColumnFilter,
  ListInput,
  SortState,
} from "~/server/api/list/list-input";
import type { DataTableColumn } from "./types";

export interface UseDataTableOptions<TRow> {
  columns: DataTableColumn<TRow>[];
  getRowId: (row: TRow) => string;
  pageSize?: number;
  defaultSort?: SortState[];
  debounceMs?: number;
  urlKey?: string;
  storageKey?: string;
}

export interface DataTableApi<TRow> {
  search: string;
  setSearch: (value: string) => void;
  sort: SortState[];
  toggleSort: (id: string) => void;
  setSortDirection: (id: string, desc: boolean) => void;
  clearSort: () => void;
  filters: ColumnFilter[];
  upsertFilter: (filter: ColumnFilter) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  hiddenColumns: Set<string>;
  isColumnVisible: (id: string) => boolean;
  toggleColumn: (id: string) => void;
  resetColumns: () => void;
  selected: Set<string>;
  isSelected: (id: string) => boolean;
  toggleRow: (id: string) => void;
  setPageSelection: (ids: string[], checked: boolean) => void;
  clearSelection: () => void;
  getSelectedRows: (rows: TRow[]) => TRow[];
  getRowId: (row: TRow) => string;
  queryInput: ListInput;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const latest = useRef(value);
  const key = JSON.stringify(value);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(latest.current), delay);
    return () => clearTimeout(handle);
  }, [key, delay]);

  return debounced;
}

function serializeSort(sort: SortState[]): string {
  return sort
    .map((item) => `${item.id}.${item.desc ? "desc" : "asc"}`)
    .join(",");
}

function parseSort(raw: string | null): SortState[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => {
      const [id, direction] = part.split(".");
      if (!id) return null;
      return { id, desc: direction === "desc" } satisfies SortState;
    })
    .filter((item): item is SortState => item !== null);
}

function parseFilters(raw: string | null): ColumnFilter[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ColumnFilter[]) : [];
  } catch {
    return [];
  }
}

export function useDataTable<TRow>(
  options: UseDataTableOptions<TRow>,
): DataTableApi<TRow> {
  const {
    columns,
    getRowId,
    pageSize: initialPageSize = 25,
    defaultSort = [],
    debounceMs = 300,
    urlKey,
    storageKey = urlKey ?? "default",
  } = options;
  const searchParams = useSearchParams();
  const param = useCallback(
    (name: string) => (urlKey ? `${urlKey}_${name}` : name),
    [urlKey],
  );

  const [search, setSearchState] = useState(() =>
    urlKey ? (searchParams.get(param("q")) ?? "") : "",
  );
  const [sort, setSort] = useState<SortState[]>(() => {
    const raw = urlKey ? searchParams.get(param("sort")) : null;
    return raw ? parseSort(raw) : defaultSort;
  });
  const [filters, setFilters] = useState<ColumnFilter[]>(() =>
    urlKey ? parseFilters(searchParams.get(param("filters"))) : [],
  );
  const [page, setPageState] = useState(() =>
    urlKey ? Number(searchParams.get(param("page"))) || 1 : 1,
  );
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const defaultHidden = useMemo(
    () => columns.filter((column) => column.defaultHidden).map(({ id }) => id),
    [columns],
  );
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(defaultHidden);
    try {
      const stored = window.localStorage.getItem(`dt:${storageKey}:hidden`);
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch {
      // Ignore unavailable or malformed local storage.
    }
    return new Set(defaultHidden);
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `dt:${storageKey}:hidden`,
        JSON.stringify([...hiddenColumns]),
      );
    } catch {
      // Ignore unavailable local storage.
    }
  }, [hiddenColumns, storageKey]);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPageState(1);
  }, []);
  const toggleSort = useCallback((id: string) => {
    setPageState(1);
    setSort((currentSort) => {
      const current = currentSort[0];
      if (current?.id === id) {
        return current.desc ? [] : [{ id, desc: true }];
      }
      return [{ id, desc: false }];
    });
  }, []);
  const setSortDirection = useCallback((id: string, desc: boolean) => {
    setPageState(1);
    setSort([{ id, desc }]);
  }, []);
  const clearSort = useCallback(() => {
    setPageState(1);
    setSort([]);
  }, []);
  const upsertFilter = useCallback((filter: ColumnFilter) => {
    setPageState(1);
    setFilters((current) => [
      ...current.filter(({ id }) => id !== filter.id),
      filter,
    ]);
  }, []);
  const removeFilter = useCallback((id: string) => {
    setPageState(1);
    setFilters((current) => current.filter((filter) => filter.id !== id));
  }, []);
  const clearFilters = useCallback(() => {
    setPageState(1);
    setFilters([]);
  }, []);
  const setPage = useCallback((next: number) => setPageState(next), []);
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageState(1);
  }, []);
  const isColumnVisible = useCallback(
    (id: string) => !hiddenColumns.has(id),
    [hiddenColumns],
  );
  const toggleColumn = useCallback((id: string) => {
    setHiddenColumns((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const resetColumns = useCallback(
    () => setHiddenColumns(new Set(defaultHidden)),
    [defaultHidden],
  );
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);
  const toggleRow = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const setPageSelection = useCallback((ids: string[], checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const getSelectedRows = useCallback(
    (rows: TRow[]) => rows.filter((row) => selected.has(getRowId(row))),
    [getRowId, selected],
  );
  const criteria = useMemo(
    () => ({ search: search.trim() || undefined, sort, filters }),
    [filters, search, sort],
  );
  const debouncedCriteria = useDebouncedValue(criteria, debounceMs);
  const queryInput = useMemo<ListInput>(
    () => ({ ...debouncedCriteria, page, pageSize }),
    [debouncedCriteria, page, pageSize],
  );
  const queryKey = JSON.stringify(queryInput);
  const firstSelectionClear = useRef(true);

  useEffect(() => {
    if (firstSelectionClear.current) {
      firstSelectionClear.current = false;
      return;
    }
    setSelected(new Set());
  }, [queryKey]);

  const firstUrlSync = useRef(true);
  useEffect(() => {
    if (!urlKey) return;
    if (firstUrlSync.current) {
      firstUrlSync.current = false;
      return;
    }
    const next = new URLSearchParams(window.location.search);
    const setOrDelete = (name: string, value: string) => {
      if (value) next.set(param(name), value);
      else next.delete(param(name));
    };

    setOrDelete("q", search.trim());
    setOrDelete("sort", serializeSort(sort));
    setOrDelete("filters", filters.length ? JSON.stringify(filters) : "");
    setOrDelete("page", page > 1 ? String(page) : "");
    const query = next.toString();
    window.history.replaceState(
      window.history.state,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }, [filters, page, param, search, sort, urlKey]);

  return {
    search,
    setSearch,
    sort,
    toggleSort,
    setSortDirection,
    clearSort,
    filters,
    upsertFilter,
    removeFilter,
    clearFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    hiddenColumns,
    isColumnVisible,
    toggleColumn,
    resetColumns,
    selected,
    isSelected,
    toggleRow,
    setPageSelection,
    clearSelection,
    getSelectedRows,
    getRowId,
    queryInput,
  };
}
