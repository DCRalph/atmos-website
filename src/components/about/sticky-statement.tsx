"use client"

import { MotionValue, motion, useScroll, useTransform } from "motion/react"
import { useRef } from "react"
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container"

const words =
  "Sound doesn\u2019t work without sight. Light doesn\u2019t work without shadow. We bring it all together to create a singular, immersive atmosphere.".split(
    " "
  )

const sectionHeightClass = "relative min-h-[200vh]"

export function StickyStatement() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { containerRef } = useMainLayoutScrollContainer();

  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  return (
    <section ref={sectionRef} className={sectionHeightClass}>
      <div className="sticky top-0 flex h-screen items-center justify-center px-4 md:px-8">
        <p className="max-w-4xl text-center text-3xl font-bold leading-tight tracking-tight font-serif md:text-5xl lg:text-6xl">
          {words.map((word, i) => {
            const start = i / words.length;
            const end = start + 1 / words.length;
            return (
              <Word
                key={i}
                word={word}
                range={[start, end]}
                progress={scrollYProgress}
              />
            );
          })}
        </p>
      </div>
    </section>
  );
}

function Word({
  word,
  range,
  progress,
}: {
  word: string;
  range: [number, number];
  progress: MotionValue<number>;
}) {
  const mappedStart = 0.2 + range[0] * 0.45;
  const mappedEnd = 0.2 + range[1] * 0.45;
  const opacity = useTransform(progress, [mappedStart, mappedEnd], [0.12, 1]);

  return (
    <motion.span className="inline-block mr-[0.3em]" style={{ opacity }}>
      {word}
    </motion.span>
  );
}