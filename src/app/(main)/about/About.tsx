"use client";

import { WhatWeDoSection } from "~/components/about/what-we-do-section";
import { StickyStatement } from "~/components/about/sticky-statement";
import { TextConversation } from "~/components/about/text-conversation";
import { AtmosphereSection } from "~/components/about/atmosphere-section";
import { ImageRevealSection } from "~/components/about/image-reveal-section";
import { ClosingSection } from "~/components/about/closing-section";

export default function AboutPage() {
  return (
    <main className="isolate min-h-dvh bg-black text-white">
      <WhatWeDoSection />
      <StickyStatement />
      <TextConversation />
      <AtmosphereSection />
      <ImageRevealSection />
      <ClosingSection />
    </main>
  );
}
