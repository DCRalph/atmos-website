"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "~/lib/utils";

/**
 * Swaps the mouse cursor for a white circle holding `icon`. Spread `targets`
 * onto every element that should show it (one hook can serve a whole grid)
 * and render `circle` once anywhere. Mouse only; touch keeps normal taps.
 * Sits under dialogs (z-70) so an opened lightbox covers it. The circle
 * follows the pointer via a ref, so moving never re-renders, and stays
 * mounted after the first hover so it can scale and fade both ways.
 */
export function useHoverCursor(icon: ReactNode) {
  // null until the first mouse hover, so nothing renders for touch users.
  const [shown, setShown] = useState<boolean | null>(null);
  const el = useRef<HTMLSpanElement>(null);
  const position = useRef("");

  const targets = {
    onPointerMove: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      position.current = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
      if (el.current) el.current.style.transform = position.current;
      setShown(true);
    },
    onPointerLeave: () => setShown((s) => (s === null ? null : false)),
    className: shown ? "cursor-none [&_*]:cursor-none" : undefined,
  };

  const circle =
    shown === null
      ? null
      : createPortal(
          <span
            ref={(node) => {
              el.current = node;
              // Start at the pointer instead of the corner.
              if (node) node.style.transform = position.current;
            }}
            aria-hidden
            className="pointer-events-none fixed top-0 left-0 z-[60]"
          >
            <span
              className={cn(
                "flex size-16 items-center justify-center rounded-full bg-white text-black transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none starting:scale-50 starting:opacity-0 [&_svg]:size-5",
                !shown && "scale-50 opacity-0",
              )}
            >
              {icon}
            </span>
          </span>,
          document.body,
        );

  return { targets, circle };
}
