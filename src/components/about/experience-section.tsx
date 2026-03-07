"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container"

export function ExperienceSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { containerRef } = useMainLayoutScrollContainer()
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start end", "end start"],
  })

  const textY = useTransform(scrollYProgress, [0, 1], [80, -80])
  const eyebrowOpacity = useTransform(scrollYProgress, [0.08, 0.24], [0, 1])
  const titleOpacity = useTransform(scrollYProgress, [0.12, 0.3, 0.82], [0, 1, 1])
  const titleY = useTransform(scrollYProgress, [0.12, 0.3], [70, 0])
  const bodyOpacity = useTransform(scrollYProgress, [0.24, 0.42, 0.9], [0, 1, 1])
  const bodyY = useTransform(scrollYProgress, [0.24, 0.42], [50, 0])

  return (
    <section ref={ref} className="relative py-40 md:py-56 overflow-hidden">
        <motion.div className="fixed top-2 left-0 right-0 h-[4px] z-9999 bg-white" style={{ scaleX: scrollYProgress, originX: 0 }} />

      {/* Large background text */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        style={{ y: textY }}
      >
        <span className="text-[clamp(6rem,20vw,16rem)] font-serif font-bold text-foreground/3 leading-none tracking-tighter whitespace-nowrap">
          EXPERIENCE
        </span>
      </motion.div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-8">
        <motion.p
          className="text-sm tracking-[0.3em] uppercase text-muted-foreground mb-8"
          style={{ opacity: eyebrowOpacity }}
        >
          Our Philosophy
        </motion.p>

        <motion.h2
          className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold tracking-tight leading-[1.05] mb-12 text-balance"
          style={{ opacity: titleOpacity, y: titleY }}
        >
          Experience over everything.
        </motion.h2>

        <motion.div
          className="flex flex-col md:flex-row gap-8 md:gap-16"
          style={{ opacity: bodyOpacity, y: bodyY }}
        >
          <motion.p
            className="text-lg md:text-xl text-muted-foreground leading-relaxed flex-1"
          >
            In a city known for its culture, we're pushing the walls out. We take the venues you know and strip them of their identity, replacing it with a cohesive synergy of sound and light.
          </motion.p>
          <motion.p
            className="text-lg md:text-xl text-muted-foreground leading-relaxed flex-1"
          >
            We curate spaces where the boundary between the music, the lighting, and the crowd disappears. Sound doesn't work without sight. Light doesn't work without shadow. We bring it all together.
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}
