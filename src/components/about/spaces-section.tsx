"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container";

export function SpacesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { containerRef } = useMainLayoutScrollContainer();
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start end", "end start"],
  });

  const imgY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const imageOpacity = useTransform(scrollYProgress, [0.06, 0.26], [0, 1]);
  const imageX = useTransform(scrollYProgress, [0.06, 0.26], [-60, 0]);
  const textOpacity = useTransform(scrollYProgress, [0.18, 0.42], [0, 1]);
  const textY = useTransform(scrollYProgress, [0.18, 0.42], [36, 0]);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden px-6 py-32 md:px-8 md:py-48"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 md:flex-row md:gap-20">
        {/* Image */}
        <motion.div
          className="w-full flex-1"
          style={{ opacity: imageOpacity, x: imageX }}
        >
          <div className="relative aspect-4/5 overflow-hidden rounded-lg">
            <motion.img
              src="/home/atmos-17.jpg"
              alt="DJ performing at an underground Atmos event"
              className="h-full w-full object-cover"
              style={{ y: imgY }}
              crossOrigin="anonymous"
            />
          </div>
        </motion.div>

        {/* Text */}
        <motion.div
          className="flex-1"
          style={{ opacity: textOpacity, y: textY }}
        >
          <motion.p className="text-muted-foreground mb-6 text-sm tracking-[0.3em] uppercase">
            Beyond Four Walls
          </motion.p>

          <motion.h2 className="mb-8 font-serif text-3xl leading-[1.1] font-bold tracking-tight text-balance md:text-5xl">
            {"Turning nowhere into somewhere."}
          </motion.h2>

          <motion.p className="text-muted-foreground mb-6 text-lg leading-relaxed">
            {
              "We work with existing venues but we also use spaces you wouldn\u2019t expect. Basements, warehouses, places around Poneke that most people walk past without a second look."
            }
          </motion.p>

          <motion.p className="text-muted-foreground text-lg leading-relaxed">
            {
              "Everyone\u2019s welcome. No pretension, no pressure. Just a good environment with good people around you."
            }
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
