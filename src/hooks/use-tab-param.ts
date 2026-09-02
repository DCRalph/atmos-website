"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * Which tab is open, kept in the URL.
 *
 * Admin tabs used to be plain component state, so "have a look at the orders on
 * this event" meant sending someone a link that landed them on Overview, and a
 * refresh threw away whichever tab they were reading.
 *
 * `replaceState` rather than a router push: switching tab is not a navigation,
 * and stacking history entries would make Back walk through tabs instead of
 * leaving the page.
 *
 * @param tabs Every tab on the page, first one being the default. An unknown
 *   value in the URL falls back to that default rather than rendering a page
 *   with no tab selected.
 */
export function useTabParam<const T extends readonly [string, ...string[]]>(
  tabs: T,
  key = "tab",
): { value: T[number]; onValueChange: (value: string) => void } {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const defaultValue = tabs[0];

  const [value, setValue] = useState<T[number]>(() => {
    const fromUrl = searchParams.get(key);
    return fromUrl && tabs.includes(fromUrl) ? fromUrl : defaultValue;
  });

  const onValueChange = useCallback(
    (next: string) => {
      setValue(next);
      const params = new URLSearchParams(window.location.search);
      if (next === defaultValue) params.delete(key);
      else params.set(key, next);
      const query = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        query ? `${pathname}?${query}` : pathname,
      );
    },
    [defaultValue, key, pathname],
  );

  return { value, onValueChange };
}
