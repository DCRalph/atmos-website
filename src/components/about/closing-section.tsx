"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useRef } from "react";
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container";

export function ClosingSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { containerRef } = useMainLayoutScrollContainer();
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start end", "end end"],
  });

  // Every range ends at 1. Motion turns this offset into a native ViewTimeline
  // animation, and a last keyframe below 1 makes the browser interpolate back
  // to the inline start values (opacity 0) as the section reaches the bottom.
  const opacity = useTransform(scrollYProgress, [0, 0.8, 1], [0, 1, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.8, 1], [0.85, 1, 1]);
  const y = useTransform(scrollYProgress, [0, 0.8, 1], [60, 0, 0]);
  const backgroundScale = useTransform(scrollYProgress, [0, 1], [1.08, 1]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
    >
      {/* Background */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{ scale: backgroundScale }}
      >
        <motion.img
          src="/home/atmos-8.jpg"
          alt=""
          className="h-full w-full object-cover brightness-[0.15]"
          style={{ opacity }}
          crossOrigin="anonymous"
        />
      </motion.div>

      <motion.div
        className="relative z-10 flex flex-col items-center gap-16 px-6 text-center"
        style={{ scale, opacity, y }}
      >
        <Image
          src="/logo/atmos-white.png"
          alt="Atmos"
          width={200}
          height={48}
          className="h-12 w-auto md:h-20"
        />
        <motion.h2 className="text-sm font-bold tracking-tighter text-white italic md:text-xl">
          XOXO
        </motion.h2>
      </motion.div>
    </section>
  );
}
