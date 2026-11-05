"use client";

import { useEffect, type RefObject } from "react";

/** Pixels a press has to travel before it counts as a drag rather than a click. */
const DRAG_THRESHOLD = 6;

/**
 * Lets a mouse drag a horizontal scroller, the way touch already can.
 *
 * Mouse only: touch and pens keep native scrolling. Snapping is paused while
 * dragging and settles on release. A drag swallows the click that ends it, so
 * links inside only open on a real click, and native image/link dragging is
 * turned off so it can't take over the gesture.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let press: { id: number; x: number; scrollLeft: number } | null = null;
    let dragged = false;

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      press = { id: e.pointerId, x: e.clientX, scrollLeft: el.scrollLeft };
      dragged = false;
    };
    const move = (e: PointerEvent) => {
      if (press?.id !== e.pointerId) return;
      const dx = e.clientX - press.x;
      if (!dragged) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        dragged = true;
        el.setPointerCapture(e.pointerId);
        el.style.scrollSnapType = "none";
      }
      el.scrollLeft = press.scrollLeft - dx;
    };
    const up = (e: PointerEvent) => {
      if (press?.id !== e.pointerId) return;
      press = null;
      el.style.scrollSnapType = "";
    };
    // Capture phase, so the link under the pointer never sees it.
    const click = (e: MouseEvent) => {
      if (!dragged) return;
      dragged = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const dragStart = (e: DragEvent) => e.preventDefault();

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    el.addEventListener("dragstart", dragStart);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", click, true);
      el.removeEventListener("dragstart", dragStart);
      el.style.scrollSnapType = "";
    };
  }, [ref]);
}
