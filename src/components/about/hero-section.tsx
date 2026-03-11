"use client"

import { motion, useScroll, useTransform } from "motion/react"
import { useRef } from "react"
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container"
import Image from "next/image"

export function HeroSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { containerRef } = useMainLayoutScrollContainer()
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start start", "end start"],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.8], [1, 0.9])
  const y = useTransform(scrollYProgress, [0, 0.8], [0, 100])
  const backgroundY = useTransform(scrollYProgress, [0, 1], [0, 200])
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.7], [0.35, 0.65])

  return (
    <section ref={ref} className="relative h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background image with parallax */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{ y: backgroundY }}
      >
        <img
          src="/home/atmos-46.jpg"
          alt="Crowd at an Atmos event"
          className="w-full h-[120%] object-cover brightness-[0.3]"
          crossOrigin="anonymous"
        />
      </motion.div>
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-black"
        style={{ opacity: overlayOpacity }}
      />

      {/* Content */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-6 px-6 text-center"
        style={{ opacity, scale, y }}
      >
        {/* <motion.p
          className="text-xs tracking-[0.5em] uppercase text-white/40 font-light"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
        >
          Poneke, New Zealand
        </motion.p> */}
        {/* <motion.h1
          className="text-[clamp(4rem,15vw,12rem)] font-serif font-bold leading-[0.85] tracking-tighter text-white"
          initial={{ opacity: 0, y: 60, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.2, delay: 0, ease: [0.25, 0.1, 0.25, 1] }}
        >
          ATMOS
        </motion.h1> */}
        <motion.div
          className="relative w-[clamp(8rem,50vw,32rem)] aspect-3/1"
          initial={{ opacity: 0, y: 60, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.2, delay: 0, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Image src="/logo/atmos-white.png" alt="Atmos" fill className="object-contain" />
        </motion.div>
        <motion.div
          className="w-12 h-px bg-white/20"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
        />
        <motion.p
          className="max-w-sm text-base text-white/50 leading-relaxed tracking-wide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: "easeOut" }}
        >
          {"We don\u2019t do gigs. We build atmospheres."}
        </motion.p>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
      >
        <span className="text-[10px] tracking-[0.4em] uppercase text-white/30">Scroll</span>
        <motion.div
          className="w-px h-8 bg-white/20 origin-top"
          animate={{ scaleY: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>
    </section>
  )
}
