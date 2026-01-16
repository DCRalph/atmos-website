"use client";

import { motion } from "motion/react";

type AnimatedPageHeaderProps = {
  title: string;
  subtitle?: string;
  className?: string;
};

const easeOutExpo: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function AnimatedPageHeader({
  title,
  subtitle,
  className,
}: AnimatedPageHeaderProps) {
  const letters = title.split("");

  return (
    <motion.div
      className={["mb-16 text-center", className].filter(Boolean).join(" ")}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            duration: 0.35,
            ease: easeOutExpo,
            when: "beforeChildren",
          },
        },
      }}
    >
      <h1
        className="mb-4 text-5xl font-black tracking-[0.15em] text-white sm:text-6xl md:text-7xl"
        aria-label={title}
      >
        <span className="sr-only">{title}</span>
        <motion.span
          aria-hidden="true"
          className="inline-block"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.01,
                // delayChildren: 0.05,
              },
            },
          }}
        >
          {letters.map((ch, idx) => (
            <motion.span
              // title is small; index key is fine for stable rendering
              key={`${ch}-${idx}`}
              className="inline-block"
              variants={{
                hidden: { opacity: 0, y: -18 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.55, ease: easeOutExpo },
                },
              }}
            >
              {ch === " " ? "\u00A0" : ch}
            </motion.span>
          ))}
        </motion.span>
      </h1>

      <motion.div
        className="bg-accent-strong mx-auto mb-6 h-1 w-24"
        variants={{
          hidden: { opacity: 0, scaleX: 0.6 },
          visible: {
            opacity: 1,
            scaleX: 1,
            transition: { duration: 0.45, ease: easeOutExpo, delay: 0.1 },
          },
        }}
      />

      {subtitle ? (
        <motion.p
          className="font-mono text-base tracking-wider text-white/60 uppercase sm:text-lg"
          variants={{
            hidden: { opacity: 0, y: -6 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.45, ease: easeOutExpo, delay: 0.15 },
            },
          }}
        >
          {subtitle}
        </motion.p>
      ) : null}
    </motion.div>
  );
}
