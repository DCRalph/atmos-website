"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { flushSync } from "react-dom";

/**
 * A live screen card that grows out of its own box to nearly fill the
 * screen, and shrinks back into it. The card element itself moves (it goes
 * `position: fixed` from the rect it had), so its summary stays mounted and
 * nothing re-rolls when it lands.
 *
 * Inside, two layers swap: the summary (`face`), held at the card's own size
 * so it never reflows, and the expanded `detail`. Opening fades the face out
 * and the detail in as it grows. Closing fades the detail to the card's
 * background first, then brings the face back before the box reaches its
 * slot, so the last frames are the card as it was and the hand-off back into
 * the grid is invisible.
 */

type Phase = "closed" | "open" | "closing";

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const GROW_MS = 450;

/** The card's box on screen, in viewport pixels. */
type Box = { top: number; left: number; width: number; height: number };

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

const px = (box: Box): Keyframe => ({
  top: `${box.top}px`,
  left: `${box.left}px`,
  width: `${box.width}px`,
  height: `${box.height}px`,
});

const stillPlease = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The open panel's gap to the screen edge: roomy on a TV, tight on a phone. */
const openGeometry = (): CSSProperties => {
  const wide = window.matchMedia("(min-width: 1024px)").matches;
  const x = wide ? "3vw" : "8px";
  const y = wide ? "3vh" : "8px";
  return {
    top: y,
    left: x,
    width: `calc(100% - 2 * ${x})`,
    height: `calc(100% - 2 * ${y})`,
  };
};

export function useCardExpand() {
  const slotRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closerRef = useRef<HTMLButtonElement>(null);

  const [phase, setPhase] = useState<Phase>("closed");
  // Where the card sat when it opened, and where it opens to.
  const [from, setFrom] = useState<Box | null>(null);
  const [geometry, setGeometry] = useState<CSSProperties>({});

  const open = useCallback(() => {
    if (!boxRef.current || phase !== "closed") return;
    setFrom(boxOf(boxRef.current));
    setGeometry(openGeometry());
    setPhase("open");
  }, [phase]);

  // The grow, run once the box is fixed at its open geometry.
  useLayoutEffect(() => {
    if (phase !== "open" || !from) return;
    const box = boxRef.current;
    if (!box) return;
    const duration = stillPlease() ? 0 : GROW_MS;
    // One keyframe: from the card's rect to wherever the style puts it.
    box.animate([{ ...px(from), offset: 0 }], { duration, easing: EASE });
    faceRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: duration / 3,
    });
    detailRef.current?.animate(
      [{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1 }],
      { duration },
    );
    backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration,
    });
    closerRef.current?.focus({ preventScroll: true });
  }, [phase, from]);

  const close = useCallback(() => {
    const box = boxRef.current;
    const slot = slotRef.current;
    if (phase !== "open" || !box || !slot) return;
    setPhase("closing");

    // Start from wherever things are, in case it's closed mid-grow.
    const now = boxOf(box);
    const layers = [faceRef, detailRef, backdropRef].map((ref) => {
      const el = ref.current;
      return { el, opacity: el ? Number(getComputedStyle(el).opacity) : 1 };
    });
    for (const el of [box, ...layers.map((layer) => layer.el)]) {
      el?.getAnimations().forEach((animation) => animation.cancel());
    }
    const [face, detail, backdrop] = layers;

    const duration = stillPlease() ? 0 : GROW_MS;
    const timing = { duration, fill: "forwards" } as const;
    const shrink = box.animate([px(now), px(boxOf(slot))], {
      ...timing,
      easing: EASE,
    });
    // Detail out to black in the first third; face back in by four fifths.
    detail?.el?.animate(
      [
        { opacity: detail.opacity },
        { opacity: 0, offset: 0.3 },
        { opacity: 0 },
      ],
      timing,
    );
    face?.el?.animate(
      [
        { opacity: face.opacity },
        { opacity: 0, offset: 0.4 },
        { opacity: 1, offset: 0.8 },
        { opacity: 1 },
      ],
      timing,
    );
    backdrop?.el?.animate(
      [{ opacity: backdrop.opacity }, { opacity: 0 }],
      timing,
    );

    shrink.onfinish = () => {
      // Back into the grid in the same frame the held animations let go.
      flushSync(() => setPhase("closed"));
      box.getAnimations().forEach((animation) => animation.cancel());
      faceRef.current?.getAnimations().forEach((a) => a.cancel());
      openerRef.current?.focus({ preventScroll: true });
    };
  }, [phase]);

  // Esc closes, and the page behind stays put while it's open.
  useEffect(() => {
    if (phase === "closed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = overflow;
    };
  }, [phase, close]);

  const expanded = phase !== "closed" && from !== null;

  return {
    expanded,
    open,
    close,
    refs: {
      slotRef,
      boxRef,
      faceRef,
      detailRef,
      backdropRef,
      openerRef,
      closerRef,
    },
    /** Holds the card's place in the grid while the card is out of it. */
    slotStyle: expanded ? { height: from.height } : undefined,
    boxStyle: expanded
      ? ({
          position: "fixed",
          zIndex: 50,
          margin: 0,
          ...geometry,
          // The card's own colour on the black page, without the page.
          background: "color-mix(in oklab, var(--background) 60%, black)",
        } satisfies CSSProperties)
      : undefined,
    /** The summary, pinned at the card's size so it never reflows. */
    faceStyle: expanded
      ? ({
          position: "absolute",
          top: 0,
          left: 0,
          width: from.width - 2,
          height: from.height - 2,
          opacity: 0,
          pointerEvents: "none",
        } satisfies CSSProperties)
      : undefined,
  };
}
