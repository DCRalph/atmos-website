"use client";

import {
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";

export type VideoBackgroundRef = {
  togglePlayPause: () => void;
  isPlaying: boolean;
  onStateChange?: (isPlaying: boolean) => void;
};

type VideoBackgroundProps = {
  onStateChange?: (isPlaying: boolean) => void;
};

export const VideoBackground = forwardRef<
  VideoBackgroundRef,
  VideoBackgroundProps
>(({ onStateChange }, ref) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [showStaticImage, setShowStaticImage] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleStateChange = useCallback(
    (playing: boolean) => {
      setIsPlaying(playing);
      onStateChange?.(playing);
    },
    [onStateChange],
  );

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      // Pause video and fade in static image
      videoRef.current.pause();
      setShowStaticImage(true);
      handleStateChange(false);
    } else {
      // Fade out static image, then play video
      setShowStaticImage(false);
      // Wait for fade out animation before playing video
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play();
          handleStateChange(true);
        }
      }, 500); // Match transition duration
    }
  }, [isPlaying, handleStateChange]);

  useImperativeHandle(ref, () => ({
    togglePlayPause,
    isPlaying,
    onStateChange: handleStateChange,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 z-0 opacity-50 select-none">
      <div className="relative h-dvh w-full">
        {/* Video */}
        <motion.video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover opacity-100"
          animate={{ opacity: showStaticImage ? 0 : 1 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <source src="/home/atmos-home.mp4" type="video/mp4" />
        </motion.video>

        {/* Static Image Overlay */}
        <AnimatePresence>
          {showStaticImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <Image
                src="/home/atmos-1.jpg"
                alt="Background"
                fill
                className="object-cover"
                quality={90}
                sizes="100vw"
                preload
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-0 bg-black/50" />
      </div>
    </div>
  );
});

VideoBackground.displayName = "VideoBackground";
