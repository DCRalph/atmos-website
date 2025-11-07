"use client";

import { motion } from "motion/react";
import { OpeningAnimation } from "~/app/_components/opening-animation";
import { VideoBackground } from "~/app/_components/video-background";
import { LiveGigPopup } from "~/app/_components/live-gig-popup";
import { GlitchLogo } from "./_components/glitch-logo";
import { SimpleLogo } from "./_components/simple-logo";
import { UndergroundOverlay } from "./_components/underground-overlay";
import { SocialLinks } from "./_components/social-links";
import { UserIndicator } from "./_components/user-indicator";

// Toggle for underground UI - set to false for clean/professional look
const UNDERGROUND_UI_ENABLED = false;

export default function Home() {
  return (
    <main className="min-h-dvh overflow-hidden bg-black text-white">
      <OpeningAnimation />
      <VideoBackground underground={UNDERGROUND_UI_ENABLED} />
      {UNDERGROUND_UI_ENABLED && <UndergroundOverlay />}

      <SocialLinks className="fixed left-3 top-3 z-20" />
      <UserIndicator />
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

        {/* Corner text elements for underground feel */}
        {UNDERGROUND_UI_ENABLED && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 1 }}
              className="absolute top-8 right-8 hidden md:block text-[10px] uppercase tracking-[0.2em] text-red-500/40 font-mono rotate-90 origin-top-right"
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
          </>
        )}
      </section>
    </main>
  );
}
