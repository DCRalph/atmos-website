"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";

export function GlitchLogo() {
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const interval = setInterval(
      () => {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 250);
      },
      3000 + Math.random() * 2000,
    );

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative aspect-4/1 w-full">
      {/* Base logo */}
      <motion.div
        className="relative h-full w-full"
        animate={
          glitch
            ? {
                x: [0, -4, 4, -2, 2, 0],
                filter: [
                  "hue-rotate(0deg) brightness(1)",
                  "hue-rotate(90deg) brightness(1.2)",
                  "hue-rotate(0deg) brightness(1)",
                ],
              }
            : {}
        }
        transition={{ duration: 0.15 }}
      >
        <Image src="/logo/atmos-white.png" alt="Atmos Logo" fill />
      </motion.div>

      {/* Glitch layers */}
      {glitch && (
        <>
          <motion.div
            className="absolute inset-0 opacity-80 mix-blend-screen"
            initial={{ x: 0 }}
            animate={{ x: [0, -5, 5, 0] }}
            transition={{ duration: 0.15 }}
          >
            <Image
              src="/logo/atmos-white.png"
              alt=""
              fill
              className="object-contain"
              style={{ filter: "hue-rotate(90deg)" }}
            />
          </motion.div>
          <motion.div
            className="absolute inset-0 opacity-60 mix-blend-multiply"
            initial={{ x: 0 }}
            animate={{ x: [0, 3, -3, 0] }}
            transition={{ duration: 0.15 }}
          >
            <Image
              src="/logo/atmos-white.png"
              alt=""
              fill
              className="object-contain"
              style={{ filter: "hue-rotate(-90deg)" }}
            />
          </motion.div>
        </>
      )}
    </div>
  );
}
