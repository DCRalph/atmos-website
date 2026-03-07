"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container"

export function SpacesSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { containerRef } = useMainLayoutScrollContainer()
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start end", "end start"],
  })

  const imgY = useTransform(scrollYProgress, [0, 1], [60, -60])
  const imageOpacity = useTransform(scrollYProgress, [0.06, 0.26], [0, 1])
  const imageX = useTransform(scrollYProgress, [0.06, 0.26], [-60, 0])
  const textOpacity = useTransform(scrollYProgress, [0.18, 0.42], [0, 1])
  const textY = useTransform(scrollYProgress, [0.18, 0.42], [36, 0])

  return (
    <section ref={ref} className="relative py-32 md:py-48 px-6 md:px-8 overflow-hidden">
        <motion.div className="fixed top-6 left-0 right-0 h-[4px] z-9999 bg-white" style={{ scaleX: scrollYProgress, originX: 0 }} />

      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12 md:gap-20 items-center">
        {/* Image */}
        <motion.div
          className="flex-1 w-full"
          style={{ opacity: imageOpacity, x: imageX }}
        >
          <div className="relative aspect-4/5 overflow-hidden rounded-lg">
            <motion.img
              src="/home/atmos-17.jpg"
              alt="DJ performing at an underground Atmos event"
              className="w-full h-full object-cover"
              style={{ y: imgY }}
              crossOrigin="anonymous"
            />
          </div>
        </motion.div>

        {/* Text */}
        <motion.div className="flex-1" style={{ opacity: textOpacity, y: textY }}>
          <motion.p
            className="text-sm tracking-[0.3em] uppercase text-muted-foreground mb-6"
          >
            Beyond Four Walls
          </motion.p>

          <motion.h2
            className="text-3xl md:text-5xl font-serif font-bold tracking-tight leading-[1.1] mb-8 text-balance"
          >
            {"Turning nowhere into somewhere."}
          </motion.h2>

          <motion.p
            className="text-lg text-muted-foreground leading-relaxed mb-6"
          >
            {"We don\u2019t stop at four walls. You\u2019ll find us in the basements, the warehouses, and the spaces Poneke forgot existed."}
          </motion.p>

          <motion.p
            className="text-lg text-muted-foreground leading-relaxed"
          >
            Atmos is a collective of likeminded souls. No ego, no judgment, just vibes. A safe harbour to be yourself.
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}
