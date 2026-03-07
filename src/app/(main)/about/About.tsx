// "use client";

import { HeroSection } from "~/components/about/hero-section"
import { ExperienceSection } from "~/components/about/experience-section"
import { ImageRevealSection } from "~/components/about/image-reveal-section"
import { TextConversation } from "~/components/about/text-conversation"
import { StickyStatement } from "~/components/about/sticky-statement"
import { SpacesSection } from "~/components/about/spaces-section"
import { ClosingSection } from "~/components/about/closing-section"
import { motion, useScroll } from "motion/react";
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container";

export default function AboutPage() {
  const { containerRef } = useMainLayoutScrollContainer();
  const { scrollYProgress } = useScroll({
    container: containerRef,
    offset: ["start start", "end end"],
  });



  return (
    <main className="isolate min-h-dvh bg-black text-white">
      <motion.div className="fixed top-0 left-0 right-0 h-[4px] z-9999 bg-white" style={{ scaleX: scrollYProgress, originX: 0 }} />
      <HeroSection />
      <ExperienceSection />
      <ImageRevealSection />
      <TextConversation />
      <StickyStatement />
      <SpacesSection />
      <ClosingSection />
    </main>
  )
}
