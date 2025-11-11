"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

type BackgroundProps = {
  intervalMs?: number;
  auto?: boolean;
};

export function Background({ intervalMs = 5000, auto = true }: BackgroundProps) {
  const BACKGROUNDS = useMemo<Array<() => ReactNode>>(
    () => [
      // 1) Original vertical red bars + red radial glow
      () => (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80 [background:repeating-linear-gradient(to_right,rgba(255,0,0,0.65)_0_6px,transparent_6px_120px)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.18),transparent_60%)]" />
        </>
      ),
      // 2) Diagonal red bars + softer glow
      () => (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80 [background:repeating-linear-gradient(45deg,rgba(255,0,0,0.5)_0_6px,transparent_6px_120px)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.14),transparent_65%)]" />
        </>
      ),
      // 3) Horizontal scanlines
      () => (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70 [background:repeating-linear-gradient(to_bottom,rgba(255,0,0,0.45)_0_4px,transparent_4px_40px)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.16),transparent_62%)]" />
        </>
      ),
      // 4) Crosshatch grid
      () => (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-75 [background:repeating-linear-gradient(to_right,rgba(255,0,0,0.28)_0_6px,transparent_6px_120px),repeating-linear-gradient(to_bottom,rgba(255,0,0,0.22)_0_6px,transparent_6px_120px)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.12),transparent_64%)]" />
        </>
      ),
      // 5) Thick angled white bars + red glow
      () => (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70 [background:repeating-linear-gradient(-30deg,rgba(255,255,255,0.22)_0_10px,transparent_10px_90px)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.14),transparent_60%)]" />
        </>
      ),
      // 6) Concentric rings
      () => (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-75 [background:repeating-radial-gradient(circle_at_center,rgba(255,0,0,0.20)_0_8px,transparent_8px_40px)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.12),transparent_65%)]" />
        </>
      ),
      // 7) Wide vertical bands
      () => (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-75 [background:repeating-linear-gradient(to_right,rgba(255,0,0,0.5)_0_18px,transparent_18px_180px)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.10),transparent_60%)]" />
        </>
      ),
      // 8) Dense diagonal hatching
      () => (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70 [background:repeating-linear-gradient(-45deg,rgba(255,0,0,0.35)_0_3px,transparent_3px_36px)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.16),transparent_62%)]" />
        </>
      ),
      // 9) Fine red columns
      () => (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-75 [background:repeating-linear-gradient(to_right,rgba(255,0,0,0.5)_0_2px,transparent_2px_30px)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.14),transparent_60%)]" />
        </>
      ),
    ],
    []
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % BACKGROUNDS.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [auto, intervalMs, BACKGROUNDS.length]);

  return (
    <div className="pointer-events-none absolute inset-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          {BACKGROUNDS[index]!()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}


