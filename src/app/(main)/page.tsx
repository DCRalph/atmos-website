"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { OpeningAnimation } from "~/components/opening-animation";
import { VideoBackground } from "~/components/video-background";
import { LiveGigPopup } from "~/components/live-gig-popup";
import { GlitchLogo } from "~/components/glitch-logo";
import { SimpleLogo } from "~/components/simple-logo";
import { UndergroundOverlay } from "~/components/underground-overlay";
import { SocialLinks } from "~/components/social-links";
// import { UserIndicator } from "~/components/user-indicator";

function HomeContent() {
  const searchParams = useSearchParams();
  const UNDERGROUND_UI_ENABLED = searchParams.get("ugui") !== null;


  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-white">
      <OpeningAnimation />
      <VideoBackground underground={UNDERGROUND_UI_ENABLED} />
      {UNDERGROUND_UI_ENABLED && <UndergroundOverlay />}

      <SocialLinks className="fixed left-3 top-3 z-20" />
      {/* <UserIndicator /> */}
      <LiveGigPopup />

      {/* Logo section */}
      <section className="relative z-10 flex min-h-dvh items-center justify-center px-4">
        <div className="text-center w-full max-w-[90vw] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
          {UNDERGROUND_UI_ENABLED ? <GlitchLogo /> : <SimpleLogo />}

          {/* Underground tagline */}
          {UNDERGROUND_UI_ENABLED && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="mt-8 text-xs sm:text-sm uppercase tracking-[0.3em] text-red-500/80 font-mono"
            >
              <span className="inline-block animate-pulse">[</span>
              <span className="mx-2">EXCLUSIVE ACCESS</span>
              <span className="inline-block animate-pulse">]</span>
            </motion.div>
          )}
        </div>

      </section>

      {/* Corner text elements for underground feel */}
      {UNDERGROUND_UI_ENABLED && (
        <div className="absolute inset-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 1 }}
            className="absolute top-18 -right-22 hidden md:block text-[10px] uppercase tracking-[0.2em] rotate-90 text-red-500/40 font-mono origin-top-left"
          >
            <span className="inline-block">[UNDERGROUND]</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 1 }}
            className="absolute bottom-8 left-8 hidden md:block text-[10px] uppercase tracking-[0.2em] text-red-500/40 font-mono -rotate-90 origin-bottom-left"
          >
            <span className="inline-block">[MEMBERS ONLY]</span>
          </motion.div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
