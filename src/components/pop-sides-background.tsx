"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";

type PopSidesBackgroundProps = {
  images?: string[];
  intervalMs?: number; // how often to spawn
  maxActive?: number;
};

type ActiveImage = {
  id: number;
  url: string;
  xPercent: number; // 0..100 (centered)
  yPercent: number; // 0..100 (centered)
  widthPx: number;
  heightPx: number;
  xOffset: number; // entrance offset px
  yOffset: number; // entrance offset px
};

export function PopSidesBackground({
  images,
  intervalMs = 2000,
  maxActive = 4,
}: PopSidesBackgroundProps) {
  const defaultImages = [
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
  const source = images?.length ? images : defaultImages;

  const [active, setActive] = useState<ActiveImage[]>([]);
  const idRef = useRef(0);
  const indexRef = useRef(0);
  // no-op ref placeholder

  useEffect(() => {
    const timer = setInterval(() => {
      const nextUrl = source[indexRef.current % source.length]!;
      indexRef.current += 1;

      const id = idRef.current++;
      // random placement centered-ish, more padding from edges
      const xPercent = 15 + Math.random() * 70; // keep well away from edges
      const yPercent = 15 + Math.random() * 70;
      const widthPx = 200 + Math.round(Math.random() * 250); // 200..450 (bigger)
      const heightPx = 200 + Math.round(Math.random() * 250); // 200..450 (bigger)
      // entrance offset so they "pop" from a direction with overshoot
      const xOffset = (Math.random() - 0.5) * 120; // -60..60px
      const yOffset = (Math.random() - 0.5) * 120; // -60..60px

      setActive((prev) => {
        const next = [
          ...prev,
          {
            id,
            url: nextUrl,
            xPercent,
            yPercent,
            widthPx,
            heightPx,
            xOffset,
            yOffset,
          },
        ];
        if (next.length > maxActive) next.shift();
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, maxActive, source]);

  return (
    <div className="pointer-events-none absolute inset-0">
      <AnimatePresence>
        {active.map((it) => (
          <motion.div
            key={it.id}
            className="absolute overflow-hidden rounded-lg"
            style={{
              left: `${it.xPercent}%`,
              top: `${it.yPercent}%`,
              width: it.widthPx,
              height: it.heightPx,
              transform: "translate(-50%, -50%)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.28)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              willChange: "transform, opacity",
            }}
            initial={{ opacity: 0, x: it.xOffset, y: it.yOffset, scale: 0.7 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 9,
              mass: 0.8,
              velocity: 2,
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              transition: { duration: 0.3, ease: "easeInOut" },
            }}
          >
            <Image
              src={it.url}
              alt=""
              fill
              unoptimized
              loading="lazy"
              sizes="(max-width: 768px) 25vw, (max-width: 1200px) 15vw, 10vw"
              className="object-cover"
              priority={false}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
