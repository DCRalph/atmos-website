"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { useIsMobile } from "~/hooks/use-mobile";
import { teko } from "~/lib/fonts";

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
  const [fontSize, setFontSize] = useState<string>("5.5rem");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile || !textRef.current) return;

    const calculateFontSize = () => {
      const text = textRef.current;
      if (!text) return;

      const viewportWidth = window.innerWidth;
      const baseFontSize = 200;

      // Temporarily set base size to measure
      text.style.fontSize = `${baseFontSize}px`;
      const textWidth = text.scrollWidth;

      // Reset inline style so it inherits from parent
      text.style.fontSize = "";

      // Calculate scaled font size
      const scaledSize = (viewportWidth / textWidth) * baseFontSize;
      setFontSize(`${scaledSize}px`);
    };

    calculateFontSize();

    window.addEventListener("resize", calculateFontSize);
    return () => window.removeEventListener("resize", calculateFontSize);
  }, [isMobile, title]);

  return (
    <AnimatePresence mode="sync">
      <motion.div
        ref={containerRef}
        className={cn("mb-4 relative", className)}
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
          className={cn(
            "mb-4 w-full font-black tracking-[0.15em] text-white flex justify-center",
            teko.className,
            isMobile && "w-screen scale-x-[1.04] translate-x-[-2%]"
          )}
          style={{
            fontSize,
            textShadow:
              "0 0 20px rgba(255, 255, 255, 0.4), 0 0 40px rgba(255, 255, 255, 0.2)",
          }}
          aria-label={title}
        >
          <span className="sr-only">{title}</span>
          <motion.span
            ref={textRef}
            aria-hidden="true"
            className="whitespace-nowrap flex scale-y-150"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.01,
                },
              },
            }}
          >
            {letters.map((ch, idx) => (
              <motion.span
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
      </motion.div>
    </AnimatePresence>
  );
}