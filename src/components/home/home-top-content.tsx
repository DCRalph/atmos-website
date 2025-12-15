"use client";

import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { OpeningAnimation } from "~/components/opening-animation";
import { VideoBackground } from "~/components/video-background";
import { LiveGigPopup } from "~/components/live-gig-popup";
import { SimpleLogo } from "~/components/simple-logo";
import { SocialLinks } from "~/components/social-links";

export function HomeTopContent() {
  return (
    <div className="h-full relative">
      <OpeningAnimation />
      <VideoBackground />

      <LiveGigPopup />
      <SocialLinks side="right" />


      {/* Logo section */}
      <section className="relative flex min-h-dvh items-center justify-center px-4 z-20">
        <div className="text-center w-full max-w-[70vw] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
          {/* <GlitchLogo /> */}
          <SimpleLogo />
        </div>

        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <button
            type="button"
            aria-label="Scroll to content"
            onClick={() => {
              const main = document.getElementById("home-page-main");
              if (!main) return;

              // Scroll exactly one viewport of the scroll container to reveal the next section.
              main.scrollTo({ top: main.clientHeight, behavior: "smooth" });
            }}
            className="group inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur-sm transition hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-0"
          >
            <ChevronDown className="h-5 w-5 transition-transform duration-200 group-hover:translate-y-0.5" />
          </button>
        </motion.div>
      </section>

      <div className="absolute w-full h-32 z-10 bg-linear-to-t from-black to-transparent bottom-0 left-0" />
    </div>
  );
}
