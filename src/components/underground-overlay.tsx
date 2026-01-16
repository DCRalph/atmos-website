"use client";

import { motion } from "motion/react";

export function UndergroundOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[5]">
      {/* Scanlines */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,0,0.1) 2px, rgba(255,0,0,0.1) 4px)",
        }}
      />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Red vignette corners */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,0,0,0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,0,0,0.12),transparent_50%)]" />

      {/* Subtle red bars on edges */}
      <motion.div
        className="absolute top-0 bottom-0 left-0 w-[2px] bg-red-500/40"
        animate={{ opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.div
        className="absolute top-0 right-0 bottom-0 w-[2px] bg-red-500/40"
        animate={{ opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, delay: 1 }}
      />

      {/* Flickering effect */}
      <motion.div
        className="absolute inset-0 bg-black"
        animate={{ opacity: [0, 0, 0, 0.02, 0, 0, 0, 0.01, 0] }}
        transition={{ duration: 0.1, repeat: Infinity, repeatDelay: 3 }}
      />

      {/* Diagonal red accent lines */}
      <div className="absolute top-1/4 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
      <div className="absolute bottom-1/4 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />

      {/* Subtle corner glitch effects */}
      <motion.div
        className="absolute top-0 left-0 h-32 w-32 bg-red-500/5"
        animate={{
          clipPath: [
            "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
            "polygon(2% 0, 98% 0, 100% 98%, 0 100%)",
            "polygon(0 2%, 100% 0, 98% 100%, 0 98%)",
            "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
          ],
        }}
        transition={{ duration: 0.1, repeat: Infinity, repeatDelay: 4 }}
      />
      <motion.div
        className="absolute right-0 bottom-0 h-32 w-32 bg-red-500/5"
        animate={{
          clipPath: [
            "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
            "polygon(2% 0, 100% 0, 100% 98%, 0 100%)",
            "polygon(0 0, 98% 2%, 100% 100%, 0 100%)",
            "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
          ],
        }}
        transition={{ duration: 0.1, repeat: Infinity, repeatDelay: 4.5 }}
      />

      {/* Random red pixel glitches */}
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-[2px] w-[2px] bg-red-500"
          style={{
            left: `${20 + i * 30}%`,
            top: `${30 + i * 20}%`,
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 0.2,
            repeat: Infinity,
            repeatDelay: 2 + i * 0.5,
          }}
        />
      ))}
    </div>
  );
}
