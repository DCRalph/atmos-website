"use client";

import { useMemo } from "react";

import { api } from "~/trpc/react";
import { accessLevelLookup } from "~/lib/ticketing/access-levels";

/**
 * The access levels table, for pickers and badges. See `accessLevelLookup`.
 *
 * Fetched once with archived levels included, so a ticket issued on a retired
 * level still badges correctly.
 */
export function useAccessLevels() {
  const query = api.accessLevels.list.useQuery(
    { includeArchived: true },
    { staleTime: 60_000 },
  );
  return useMemo(() => accessLevelLookup(query.data ?? []), [query.data]);
}
