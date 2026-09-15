"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container";

export function AtmosphereSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { containerRef } = useMainLayoutScrollContainer();
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start end", "end start"],
  });

  const titleOpacity = useTransform(scrollYProgress, [0.12, 0.3, 1], [0, 1, 1]);
  const titleY = useTransform(scrollYProgress, [0.12, 0.3], [70, 0]);
  const bodyOpacity = useTransform(scrollYProgress, [0.24, 0.42, 1], [0, 1, 1]);
  const bodyY = useTransform(scrollYProgress, [0.24, 0.42], [50, 0]);

  return (
    <section ref={ref} className="relative px-6 py-40 md:px-8 md:py-56">
      <div className="mx-auto max-w-4xl">
        <motion.h2
          className="mb-12 text-4xl leading-[1.05] font-bold tracking-tight text-balance md:text-6xl lg:text-7xl"
          style={{ opacity: titleOpacity, y: titleY }}
        >
          Atmosphere over everything.
        </motion.h2>

        <motion.p
          className="text-muted-foreground max-w-2xl text-lg leading-relaxed md:text-xl"
          style={{ opacity: bodyOpacity, y: bodyY }}
        >
          We take venues you know and reshape them into something different.
          Sound, light, and design working together to create an environment not
          just a show.
        </motion.p>
      </div>
    </section>
  );
}
