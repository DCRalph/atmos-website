"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useRef } from "react";
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container";

// Enough repeats to fill the 200vw band on any viewport; the rest is clipped.
const LOGO_COUNT = 12;

// Opening screen: a full-width band of faded Atmos logos across the middle,
// with the "What We Do" label sitting just inside the bottom of the viewport.
export function WhatWeDoSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { containerRef } = useMainLayoutScrollContainer();
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start start", "end start"],
  });

  // The band drifts left and the label fades as the section scrolls away.
  // Ranges end at 1 on purpose: motion drives these with a native scroll
  // timeline, which falls back to the inline start value past the last keyframe.
  const bandX = useTransform(scrollYProgress, [0, 1], [0, -240]);
  const labelOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 0, 0]);

  return (
    <section
      ref={ref}
      className="relative flex h-dvh flex-col justify-end overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none"
      >
        <motion.div
          className="-ml-[50vw] flex w-[200vw] items-center gap-[4vw] pl-[4vw]"
          style={{ x: bandX }}
        >
          {Array.from({ length: LOGO_COUNT }, (_, i) => (
            <Image
              key={i}
              src="/logo/atmos-white.png"
              alt=""
              width={5001}
              height={1120}
              sizes="30vw"
              draggable={false}
              className="h-[clamp(3.5rem,7vw,6rem)] w-auto shrink-0 opacity-10"
            />
          ))}
        </motion.div>
      </div>

      <motion.p
        className="text-muted-foreground relative z-10 px-6 pb-8 text-sm tracking-[0.3em] uppercase md:px-8 md:pb-10"
        style={{ opacity: labelOpacity }}
      >
        What We Do
      </motion.p>
    </section>
  );
}
