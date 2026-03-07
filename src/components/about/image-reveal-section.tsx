"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container"

export function ImageRevealSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { containerRef } = useMainLayoutScrollContainer()
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start end", "end start"],
  })

  const clipProgress = useTransform(scrollYProgress, [0.1, 0.5], [100, 0])
  const imgScale = useTransform(scrollYProgress, [0.1, 0.6], [1.15, 1])
  const headingOpacity = useTransform(scrollYProgress, [0.05, 0.24], [0, 1])
  const headingY = useTransform(scrollYProgress, [0.05, 0.24], [40, 0])
  const captionOpacity = useTransform(scrollYProgress, [0.18, 0.35], [0, 1])
  const captionY = useTransform(scrollYProgress, [0.18, 0.35], [30, 0])

  return (
    <section ref={ref} className="relative py-8 px-6 md:px-8">
        <motion.div className="fixed top-3 left-0 right-0 h-[4px] z-9999 bg-white" style={{ scaleX: scrollYProgress, originX: 0 }} />

      <div className="max-w-6xl mx-auto">
        <motion.div
          className="mb-8 flex flex-col gap-3 md:mb-10 md:flex-row md:items-end md:justify-between"
          style={{ opacity: headingOpacity, y: headingY }}
        >
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Transformation
          </p>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-right">
            Every room starts as a shell. Atmos uses sound, light, and spatial design to turn it into something that feels fully alive.
          </p>
        </motion.div>
        <motion.div
          className="relative aspect-video overflow-hidden rounded-lg md:aspect-21/9"
          style={{
            clipPath: useTransform(clipProgress, (v) => `inset(0 ${v}% 0 0)`),
          }}
        >
          <motion.img
            src="/home/atmos-10.jpg"
            alt="An Atmos venue transformed with immersive lighting"
            className="w-full h-full object-cover"
            style={{ scale: imgScale }}
            crossOrigin="anonymous"
          />
        </motion.div>
        <motion.p
          className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground"
          style={{ opacity: captionOpacity, y: captionY }}
        >
          The visual language shifts as you move through the night, revealing the room in stages instead of all at once.
        </motion.p>
      </div>
    </section>
  )
}
