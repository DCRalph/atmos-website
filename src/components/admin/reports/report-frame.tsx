"use client";

import { useEffect, useRef } from "react";

/** Scripts stay disabled. The parent observes the static document so long reports fill the wrapper naturally. */
export function ReportFrame({ html, title }: { html: string; title: string }) {
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(() => () => observer.current?.disconnect(), []);
  return (
    <iframe
      title={title}
      srcDoc={html}
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      className="min-h-80 w-full border-0 bg-[#0a0a0a]"
      onLoad={(event) => {
        const frame = event.currentTarget;
        const body = frame.contentDocument?.body;
        observer.current?.disconnect();
        if (!body) return;
        const resize = () => {
          const height = Math.min(
            20_000,
            Math.max(320, Math.ceil(body.getBoundingClientRect().height)),
          );
          frame.style.height = `${height}px`;
        };
        resize();
        observer.current = new ResizeObserver(resize);
        observer.current.observe(body);
      }}
    />
  );
}
