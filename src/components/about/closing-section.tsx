"use client"

import { motion, useScroll, useTransform } from "motion/react"
import { useRef } from "react"
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container"

export function ClosingSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { containerRef } = useMainLayoutScrollContainer()
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start end", "end end"],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.8], [0, 1])
  const scale = useTransform(scrollYProgress, [0, 0.8], [0.85, 1])
  const y = useTransform(scrollYProgress, [0, 0.8], [60, 0])
  const backgroundScale = useTransform(scrollYProgress, [0, 1], [1.08, 1])
  const footerOpacity = useTransform(scrollYProgress, [0.35, 0.8], [0, 1])

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{ scale: backgroundScale }}
      >
        <motion.img
          src="/home/atmos-8.jpg"
          alt=""
          className="w-full h-full object-cover brightness-[0.15]"
          style={{ opacity }}
          crossOrigin="anonymous"
        />
      </motion.div>

      <motion.div
        className="relative z-10 flex flex-col items-center gap-10 px-6 text-center"
        style={{ scale, opacity, y }}
      >
        <motion.p
          className="text-xs tracking-[0.5em] uppercase text-white/30"
        >
          This is Atmos
        </motion.p>

        <motion.h2
          className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold tracking-tighter text-white"
        >
          Feel it.
        </motion.h2>

        <motion.div
          className="w-16 h-px bg-white/15"
        />

        <motion.p
          className="max-w-sm text-base text-white/45 leading-relaxed tracking-wide"
        >
          Follow us for upcoming events and find out where we surface next.
        </motion.p>

        <motion.a
          href="#"
          className="mt-2 px-8 py-3.5 border border-white/20 text-xs tracking-[0.25em] uppercase text-white/80 hover:bg-white hover:text-black transition-all duration-500 ease-out"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Get in touch
        </motion.a>
      </motion.div>

      {/* Footer */}
      <motion.div
        className="absolute bottom-0 inset-x-0 z-10 flex items-center justify-between px-8 py-8"
        style={{ opacity: footerOpacity }}
      >
        <span className="text-[10px] text-white/25 tracking-[0.3em] uppercase">Atmos</span>
        <span className="text-[10px] text-white/25 tracking-wider">Poneke, NZ</span>
      </motion.div>
    </section>
  )
}
