"use client";

import { useEffect, useEffectEvent, useRef } from "react";

/**
 * Loads the next page when it scrolls into view. Goes under a paged list in
 * place of a "Load more" button. A page too short to push it off screen
 * leaves it in view, so it keeps loading until the list fills the screen or
 * runs out.
 */
export function InfiniteScrollTrigger({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean;
  /** The next page is on its way; nothing more is asked for until it lands. */
  loading: boolean;
  onLoadMore: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // A new callback each render shouldn't re-arm the observer.
  const load = useEffectEvent(onLoadMore);

  useEffect(() => {
    const node = ref.current;
    if (!node || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) load();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  if (!hasMore) return null;
  return (
    <div
      ref={ref}
      className="text-muted-foreground py-3 text-center text-sm"
      aria-live="polite"
    >
      {loading ? "Loading more…" : null}
    </div>
  );
}
