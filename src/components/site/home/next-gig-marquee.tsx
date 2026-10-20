"use client";

import { useEffect, useRef } from "react";

/** Two identical runs make one seamless loop, including when the title is short. */
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

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let inView = false;
    const sync = () => {
      element.dataset.running = String(inView && !document.hidden && !paused);
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      sync();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
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
