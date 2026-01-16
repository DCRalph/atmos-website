"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";

const IMAGES = [
  "/home/a1 website art.jpg",
  "/home/atmos-1.jpg",
  "/home/atmos-2.jpg",
  "/home/atmos-6.jpg",
  "/home/atmos-8.jpg",
  "/home/atmos-9.jpg",
  "/home/atmos-10.jpg",
  "/home/atmos-15.jpg",
  "/home/atmos-17.jpg",
  "/home/atmos-46.jpg",
];

type ImageCycleBackgroundProps = {
  intervalMs?: number;
  auto?: boolean;
};

export function ImageCycleBackground({
  intervalMs = 5000,
  auto = true,
}: ImageCycleBackgroundProps) {
  const [index, setIndex] = useState(0);

  // Preload all images on mount
  useEffect(() => {
    IMAGES.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % IMAGES.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [auto, intervalMs]);

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        >
          <div className="relative h-full w-full">
            <Image
              src={IMAGES[index]!}
              alt={`Background ${index + 1}`}
              fill
              className="object-cover"
              priority
              quality={90}
            />
            {/* Optional overlay to darken/tint the image */}
            <div className="absolute inset-0 bg-black/50" />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
