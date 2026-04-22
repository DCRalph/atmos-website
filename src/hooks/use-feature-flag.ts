"use client";

import { api } from "~/trpc/react";

/**
 * Read a feature flag from the server. Defaults to `true` when the key is not
 * present in `KeyValueStore` so that new features are on by default for
 * development environments; set the key to `"false"` to disable in prod.
 */
export function useFeatureFlag(flag: string, defaultEnabled = true) {
  const { data, isLoading } = api.featureFlags.get.useQuery(
    { flag, defaultEnabled },
    { staleTime: 60_000 },
  );
  return {
    enabled: data ?? defaultEnabled,
    isLoading,
  };
}
