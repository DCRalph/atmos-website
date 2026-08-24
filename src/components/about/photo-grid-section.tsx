"use client";

import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef } from "react";
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container";

const photos = [
  { src: "/home/atmos-2.jpg", alt: "DJ mid-set surrounded by light trails" },
  { src: "/home/atmos-15.jpg", alt: "DJ performing under neon light" },
  { src: "/home/atmos-10.jpg", alt: "Crowd packed into an Atmos night" },
];

// Three-up photo strip. Each image wipes in with a clip-path reveal,
// staggered left to right as the row scrolls into view.
export function PhotoGridSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { containerRef } = useMainLayoutScrollContainer();
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start end", "end start"],
  });

  return (
    <section ref={ref} className="border-t border-white/10">
      <div className="grid gap-0.5 md:grid-cols-3">
        {photos.map((photo, i) => (
          <GridPhoto
            key={photo.src}
            {...photo}
            index={i}
            progress={scrollYProgress}
          />
        ))}
      </div>
    </section>
  );
}

function GridPhoto({
  src,
  alt,
  index,
  progress,
}: {
  src: string;
  alt: string;
  index: number;
  progress: MotionValue<number>;
}) {
  const start = 0.08 + index * 0.07;
  const clip = useTransform(progress, [start, start + 0.25], [100, 0]);
  const clipPath = useTransform(clip, (v) => `inset(0 ${v}% 0 0)`);
  const scale = useTransform(progress, [start, start + 0.4], [1.15, 1]);

  return (
    <motion.div
      className="relative h-56 overflow-hidden md:h-72"
      style={{ clipPath }}
    >
      <motion.img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ scale }}
        crossOrigin="anonymous"
      />
    </motion.div>
  );
}
