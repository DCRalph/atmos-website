"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container";

// "01 / What we do" editorial row: text left, photo right.
// The photo wipes in with a clip-path reveal as the row scrolls into view.
export function WhatWeDoSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { containerRef } = useMainLayoutScrollContainer();
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start end", "end start"],
  });

  const eyebrowOpacity = useTransform(scrollYProgress, [0.08, 0.24], [0, 1]);
  const titleOpacity = useTransform(scrollYProgress, [0.12, 0.3], [0, 1]);
  const titleY = useTransform(scrollYProgress, [0.12, 0.3], [50, 0]);
  const bodyOpacity = useTransform(scrollYProgress, [0.2, 0.38], [0, 1]);
  const bodyY = useTransform(scrollYProgress, [0.2, 0.38], [40, 0]);
  const clip = useTransform(scrollYProgress, [0.1, 0.45], [100, 0]);
  const clipPath = useTransform(clip, (v) => `inset(0 ${v}% 0 0)`);
  const imgScale = useTransform(scrollYProgress, [0.1, 0.55], [1.15, 1]);

  return (
    <section ref={ref} className="relative border-t border-white/10">
      <div className="grid md:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-24 md:px-10 md:py-36">
          <motion.p
            className="mb-6 text-xs tracking-[0.3em] text-white/40 uppercase"
            style={{ opacity: eyebrowOpacity }}
          >
            01 / What we do
          </motion.p>
          <motion.h2
            className="mb-6 text-4xl leading-[1.05] font-bold tracking-tight text-balance md:text-5xl"
            style={{ opacity: titleOpacity, y: titleY }}
          >
            Atmosphere over everything.
          </motion.h2>
          <motion.p
            className="max-w-md text-lg leading-relaxed text-white/65"
            style={{ opacity: bodyOpacity, y: bodyY }}
          >
            {
              "We take venues you know and reshape them into something different. Sound, light, and design working together to create an environment, not just a show."
            }
          </motion.p>
        </div>

        <motion.div
          className="relative min-h-[320px] overflow-hidden md:min-h-[480px]"
          style={{ clipPath }}
        >
          <motion.img
            src="/home/atmos-9.jpg"
            alt="An Atmos venue transformed with immersive lighting"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ scale: imgScale }}
            crossOrigin="anonymous"
          />
        </motion.div>
      </div>
    </section>
  );
}
