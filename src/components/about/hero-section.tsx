"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container";
import Image from "next/image";

// Full-bleed photo hero with the content anchored to the bottom edge:
// logo + tagline on the left, quick facts on the right.
export function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { containerRef } = useMainLayoutScrollContainer();
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start start", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.8], [0, 80]);
  const backgroundY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.7], [0.45, 0.75]);

  return (
    <section ref={ref} className="relative h-[85vh] overflow-hidden">
      {/* Background image with parallax */}
      <motion.div className="absolute inset-0 z-0" style={{ y: backgroundY }}>
        <img
          src="/home/atmos-46.jpg"
          alt="Crowd at an Atmos event"
          className="h-[120%] w-full object-cover brightness-[0.5]"
          crossOrigin="anonymous"
        />
      </motion.div>
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-black"
        style={{ opacity: overlayOpacity }}
      />

      {/* Bottom-anchored content */}
      <motion.div
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-6 px-6 pb-10 md:flex-row md:items-end md:justify-between md:px-10 md:pb-12"
        style={{ opacity, y }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.1, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="relative mb-5 aspect-3/1 w-[clamp(9rem,22vw,15rem)]">
            <Image
              src="/logo/atmos-white.png"
              alt="Atmos"
              fill
              className="object-contain object-left"
            />
          </div>
          <p className="text-lg font-semibold tracking-tight text-white md:text-xl">
            {"We don’t do gigs. We build atmospheres."}
          </p>
        </motion.div>

        <motion.div
          className="text-[11px] leading-loose tracking-[0.2em] text-white/60 uppercase md:text-right"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
        >
          {"Pōneke, New Zealand"}
          <br />
          Sound, light, space
          <br />
          Independent
        </motion.div>
      </motion.div>
    </section>
  );
}
