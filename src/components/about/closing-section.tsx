"use client"

import { motion, useScroll, useTransform } from "motion/react"
import Image from "next/image"
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
        className="relative z-10 flex flex-col items-center gap-16 px-6 text-center"
        style={{ scale, opacity, y }}
      >


        <Image
          src="/logo/atmos-white.png"
          alt="Atmos"
          width={200}
          height={48}
          className="h-12 md:h-20 w-auto"
        />
        <motion.h2
          className="text-sm md:text-xl font-bold tracking-tighter italic text-white"
        >
          XOXO
        </motion.h2>


      </motion.div>


    </section>
  )
}
