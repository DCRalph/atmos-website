"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Read/write a string in `localStorage` without a hydration mismatch.
 *
 * `useSyncExternalStore` is the right tool here rather than
 * `useState` + `useEffect`: the server snapshot is the fallback, the client
 * snapshot is the stored value, and React handles the swap without a cascading
 * render. It also keeps two tabs in step, which matters when door staff have
 * the scanner open twice by accident.
 */
export function useLocalStorage(
  key: string,
  fallback = "",
): [string, (value: string) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const handler = (event: StorageEvent) => {
        if (event.key === null || event.key === key) onChange();
      };
      window.addEventListener("storage", handler);
      window.addEventListener(LOCAL_WRITE_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(LOCAL_WRITE_EVENT, onChange);
      };
    },
    [key],
  );

  const getSnapshot = useCallback(
    () => window.localStorage.getItem(key) ?? fallback,
    [key, fallback],
  );

  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: string) => {
      window.localStorage.setItem(key, next);
      // `storage` only fires in *other* tabs, so nudge this one by hand.
      window.dispatchEvent(new Event(LOCAL_WRITE_EVENT));
    },
    [key],
  );

  return [value, setValue];
}

const LOCAL_WRITE_EVENT = "atmos:local-storage-write";
