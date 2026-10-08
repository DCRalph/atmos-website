import { useMemo } from "react";

import { api } from "@/lib/api";
import { accessLevelLookup } from "~/lib/ticketing/access-levels";

/**
 * The access levels table, for the door's picker and badges. The app's twin
 * of the web's `useAccessLevels`; see `accessLevelLookup`.
 */
export function useAccessLevels() {
  const query = api.accessLevels.list.useQuery(
    { includeArchived: true },
    { staleTime: 5 * 60 * 1000 },
  );
  return useMemo(() => accessLevelLookup(query.data ?? []), [query.data]);
}
