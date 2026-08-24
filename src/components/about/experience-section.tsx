"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container";

export function ExperienceSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { containerRef } = useMainLayoutScrollContainer();
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start end", "end start"],
  });

  const textY = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const eyebrowOpacity = useTransform(scrollYProgress, [0.08, 0.24], [0, 1]);
  const titleOpacity = useTransform(
    scrollYProgress,
    [0.12, 0.3, 0.82],
    [0, 1, 1],
  );
  const titleY = useTransform(scrollYProgress, [0.12, 0.3], [70, 0]);
  const bodyOpacity = useTransform(
    scrollYProgress,
    [0.24, 0.42, 0.9],
    [0, 1, 1],
  );
  const bodyY = useTransform(scrollYProgress, [0.24, 0.42], [50, 0]);

  return (
    <section ref={ref} className="relative overflow-hidden py-40 md:py-56">
      {/* Large background text */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        style={{ y: textY }}
      >
        <span className="text-foreground/3 text-[clamp(6rem,20vw,16rem)] leading-none font-bold tracking-tighter whitespace-nowrap">
          EXPERIENCE
        </span>
      </motion.div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 md:px-8">
        <motion.p
          className="text-muted-foreground mb-8 text-sm tracking-[0.3em] uppercase"
          style={{ opacity: eyebrowOpacity }}
        >
          What We Do
        </motion.p>

        <motion.h2
          className="mb-12 text-4xl leading-[1.05] font-bold tracking-tight text-balance md:text-6xl lg:text-7xl"
          style={{ opacity: titleOpacity, y: titleY }}
        >
          Atmosphere over everything.
        </motion.h2>

        <motion.div
          className="flex flex-col gap-8 md:flex-row md:gap-16"
          style={{ opacity: bodyOpacity, y: bodyY }}
        >
          <motion.p className="text-muted-foreground flex-1 text-lg leading-relaxed md:text-xl">
            {
              "We take venues you know and reshape them into something different. Sound, light, and design working together to create an environment not just a show."
            }
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
