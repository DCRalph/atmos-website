"use client";

import { HeroSection } from "~/components/about/hero-section";
import { WhatWeDoSection } from "~/components/about/what-we-do-section";
import { SpacesSection } from "~/components/about/spaces-section";
import { TextConversation } from "~/components/about/text-conversation";
import { StickyStatement } from "~/components/about/sticky-statement";
import { PhotoGridSection } from "~/components/about/photo-grid-section";
import { ClosingSection } from "~/components/about/closing-section";

export default function AboutPage() {
  return (
    <main className="isolate min-h-dvh bg-black text-white">
      <HeroSection />
      <WhatWeDoSection />
      <SpacesSection />
      <TextConversation />
      <StickyStatement />
      <PhotoGridSection />
      <ClosingSection />
    </main>
  );
}
