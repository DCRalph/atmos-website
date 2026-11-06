"use client";

import { useEffect, useRef } from "react";

/**
 * Shows the next gig's title and date, scrolling only when they overflow.
 * Two identical runs make one seamless loop; the second is hidden when static.
 */
export function NextGigMarquee({
  title,
  date,
  paused,
}: {
  title: string;
  date: string;
  paused: boolean;
}) {
  const viewport = useRef<HTMLSpanElement>(null);
  const firstRun = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = viewport.current;
    const run = firstRun.current;
    if (!element || !run) return;
    let inView = false;
    const sync = () => {
      element.dataset.running = String(inView && !document.hidden && !paused);
    };
    // The run is stretched to the viewport, so measure its title-to-date span.
    const measure = () => {
      const first = run.firstElementChild?.getBoundingClientRect();
      const last = run.lastElementChild?.getBoundingClientRect();
      if (!first || !last) return;
      element.dataset.overflow = String(
        last.right - first.left > element.clientWidth,
      );
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      sync();
    });
    const resize = new ResizeObserver(measure);
    observer.observe(element);
    resize.observe(element);
    for (const child of run.children) resize.observe(child);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [paused]);

  return (
    <span
      ref={viewport}
      className="next-gig-marquee block min-w-0 overflow-hidden"
    >
      <span className="sr-only">
        {title}, {date}
      </span>
      <span aria-hidden className="next-gig-marquee-track">
        {[0, 1].map((copy) => (
          <span
            key={copy}
            ref={copy === 0 ? firstRun : undefined}
            className="next-gig-marquee-run t-display text-xl normal-case md:text-2xl"
          >
            <span>{title}</span>
            <span>{date}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
