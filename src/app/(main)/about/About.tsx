"use client";

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

  return (
    <main className="isolate min-h-dvh bg-black text-white">
      <HeroSection />
      <ExperienceSection />
      <ImageRevealSection />
      <TextConversation />
      <StickyStatement />
      {/* <SpacesSection /> */}
      <ClosingSection />
    </main>
  )
}
