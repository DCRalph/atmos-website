"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState<string>("4.5rem");

  useEffect(() => {
    const calculateFontSize = () => {
      if (!containerRef.current || !textRef.current) return;

      const container = containerRef.current;
      const text = textRef.current;
      const containerWidth = container.offsetWidth;
      
      const availableWidth = containerWidth - 0;

      if (availableWidth <= 0) return;

      // Binary search for the right font size
      let minSize = 30; // Minimum size (1.875rem)
      let maxSize = 72; // Maximum size (4.5rem)
      let currentSize = maxSize;
      const tolerance = 0.5;

      while (maxSize - minSize > tolerance) {
        currentSize = (minSize + maxSize) / 2;
        text.style.fontSize = `${currentSize}px`;
        
        if (text.scrollWidth <= availableWidth) {
          minSize = currentSize;
        } else {
          maxSize = currentSize;
        }
      }

      setFontSize(`${minSize}px`);
    };

    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver(() => {
      calculateFontSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Initial calculation after a short delay to ensure DOM is ready
    const timeout = setTimeout(calculateFontSize, 100);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeout);
    };
  }, [title]);

  return (
    <motion.div
      ref={containerRef}
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
        className="mb-4 w-full font-black tracking-[0.15em] text-white"
        style={{ fontSize }}
        aria-label={title}
      >
        <span className="sr-only">{title}</span>
        <motion.span
          ref={textRef}
          aria-hidden="true"
          className="inline-block whitespace-nowrap"
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
              className="inline-block tracking-normal"
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

      {/* <motion.div
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
      ) : null} */}
    </motion.div>
  );
}
