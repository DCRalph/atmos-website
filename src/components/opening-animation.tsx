"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";

export function OpeningAnimation({
  durationMs = 1200,
}: {
  durationMs?: number;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // const hasSeen = false; // disable for testing
    const hasSeen = sessionStorage.getItem("def-opening") == "1";
    if (hasSeen) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem("def-opening", "1");
      } catch {}
    }, durationMs + 300); // allow extra time for circle reveal
    return () => clearTimeout(t);
  }, [durationMs]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-800 grid place-items-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Vertical bars sweep */}
          {/* <motion.div
            className="pointer-events-none absolute inset-0 opacity-0"
            style={{
              background:
                "repeating-linear-gradient(to_right, rgba(255,0,0,0.9) 0 6px, transparent 6px 140px)",
            }}
            initial={{ x: "-20%", opacity: 0 }}
            animate={{ x: "0%", opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          /> */}

          {/* Pulsing Atmos logo (fade out before reveal) */}
          <motion.div
            className="relative z-10 grid place-items-center"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 0.7,
              ease: [0.2, 0.8, 0.2, 1],
              delay: 0.2,
            }}
          >
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ delay: 1.05, duration: 0.35, ease: "easeOut" }}
            >
              <div className="relative">
                {Array.from({ length: 4 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="border-accent-strong/60 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-[0_0_12px_var(--accent-strong),0_0_28px_var(--accent-muted)]"
                    style={{ width: 280, height: 280 }}
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    transition={{
                      duration: 1.1,
                      ease: "easeOut",
                      repeat: 2,
                      repeatDelay: 0.15,
                      delay: i * 0.2,
                    }}
                    aria-hidden
                  />
                ))}
                <motion.div
                  className="grid h-48 w-48 place-items-center sm:h-56 sm:w-56 md:h-64 md:w-64 lg:h-72 lg:w-72"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    duration: 0.8,
                    ease: [0.2, 0.8, 0.2, 1],
                    delay: 0.3,
                  }}
                >
                  <div className="relative h-full w-full p-8">
                    <Image
                      src="/logo/atmos-white.png"
                      alt="Atmos"
                      fill
                      className="object-contain"
                      priority
                      sizes="100vw"
                    />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>

          {/* Circle reveal mask (this is the ONLY black layer) */}
          {(() => {
            const maskStyle: CSSProperties & Record<"--r", string> = {
              "--r": "56px",
              WebkitMaskImage:
                "radial-gradient(circle at center, transparent var(--r), white var(--r))",
              maskImage:
                "radial-gradient(circle at center, transparent var(--r), white var(--r))",
              // Optional: smoother animation on some browsers
              willChange: "mask-image, -webkit-mask-image",
            };

            const initialVars: Record<"--r", string> = { "--r": "0%" };
            const animateVars: Record<"--r", string> = { "--r": "141%" };

            return (
              <motion.div
                className="pointer-events-none absolute inset-0 z-0 bg-black"
                style={maskStyle}
                initial={initialVars}
                animate={animateVars}
                transition={{
                  duration: 1,
                  ease: "easeInOut",
                  delay: 1.2, // starts after the pulses
                }}
                aria-hidden
              />
            );
          })()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
