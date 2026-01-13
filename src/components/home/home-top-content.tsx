"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, Play, Pause, Mouse } from "lucide-react";
import { OpeningAnimation } from "~/components/opening-animation";
import { VideoBackground, type VideoBackgroundRef } from "~/components/video-background";
import { LiveGigPopup } from "~/components/live-gig-popup";
import { SimpleLogo } from "~/components/simple-logo";
import { SocialLinks } from "~/components/social-links";

export function HomeTopContent() {
  const videoRef = useRef<VideoBackgroundRef>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  return (
    <div className="h-full">
      <OpeningAnimation />
      <VideoBackground ref={videoRef} onStateChange={setIsPlaying} />

      <LiveGigPopup />
      <SocialLinks side="left" />


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
            className="group flex items-center gap-1 justify-center text-white/80 transition hover:text-white"
          >
            <ChevronDown className="size-6 transition-all duration-200 group-hover:scale-110 group-hover:text-white" strokeWidth={1} />
            <p className="text-sm">Scroll</p>
            <ChevronDown className="size-6 transition-all duration-200 group-hover:scale-110 group-hover:text-white" strokeWidth={1} />
          </button>
        </motion.div>

        {/* Play/Pause Button */}
        {/* <div className="absolute transition-all bottom-2 left-2 sm:bottom-6 sm:left-6 z-30">
          <button
            onClick={() => videoRef.current?.togglePlayPause()}
            aria-label={isPlaying ? "Pause video" : "Play video"}
            className="group flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur-sm transition-all hover:border-white/35 hover:text-white hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-0"
          >
            <motion.div
              initial={false}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.3 }}
              key={isPlaying ? "pause" : "play"}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </motion.div>
          </button>
        </div> */}
      </section>

      <div className="absolute w-full h-32 z-10 bg-linear-to-t from-black to-transparent bottom-0 left-0" />
    </div>
  );
}
