"use client";

import { useEffect, useState } from "react";

/**
 * The value, but only after it has stopped changing for `delayMs`.
 *
 * For search boxes that drive a server query: typing "wellington" should be one
 * request, not ten.
 */
export function useDebouncedValue<T>(value: T, delayMs = 220): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
