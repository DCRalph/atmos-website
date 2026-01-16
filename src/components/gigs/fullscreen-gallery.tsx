"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getMediaDisplayUrl } from "~/lib/media-url";

type MediaItem = {
  id: string;
  type: string;
  url: string | null;
  section: string;
  sortOrder: number;
  fileUploadId?: string | null;
  fileUpload?: {
    id: string;
    url: string;
    name: string;
    mimeType: string;
  } | null;
};

type FullscreenGalleryProps = {
  media: MediaItem[];
  initialIndex: number;
  onClose: () => void;
};

export function FullscreenGallery({
  media,
  initialIndex,
  onClose,
}: FullscreenGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);
  const [mounted, setMounted] = useState(false);
  const thumbnailsRef = useRef<HTMLDivElement>(null);

  const currentMedia = media[currentIndex];

  // Handle mounting for portal (needed for SSR)
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    console.log("direction", direction);
  }, [direction]);

  const goToNext = useCallback(() => {
    if (currentIndex < media.length - 1) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, media.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const goToIndex = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "ArrowLeft") {
        goToPrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrevious, onClose]);

  // Scroll thumbnail into view when currentIndex changes
  useEffect(() => {
    const container = thumbnailsRef.current;
    if (!container) return;

    const thumbnail = container.children[currentIndex] as HTMLElement;
    if (thumbnail) {
      thumbnail.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIndex]);

  // Lock body scroll when gallery is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
  };

  if (!currentMedia || !mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-500 flex flex-col bg-[#0a1628]"
    >
      {/* Header with close button and counter */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between px-4 py-4 sm:px-6"
      >
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
            {currentIndex + 1} / {media.length}
          </span>
        </div>

        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:scale-105 hover:bg-white/20"
        >
          <X size={20} />
        </button>
      </motion.div>

      {/* Main image container */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 sm:px-16">
        {/* Navigation arrows */}
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className="absolute left-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 sm:left-4"
        >
          <ChevronLeft size={24} />
        </button>

        <button
          onClick={goToNext}
          disabled={currentIndex === media.length - 1}
          className="absolute right-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 sm:right-4"
        >
          <ChevronRight size={24} />
        </button>

        {/* Main image with animation - both images animate simultaneously */}
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentMedia.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.25 },
            }}
            className="absolute inset-0 flex items-center justify-center px-16"
          >
            <div className="relative flex h-full w-full max-w-6xl items-center justify-center">
              {currentMedia.type === "photo" ? (
                <div className="relative h-full w-full">
                  <Image
                    src={getMediaDisplayUrl(currentMedia)}
                    alt={`Image ${currentIndex + 1}`}
                    fill
                    className="object-contain"
                    priority
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                  />
                </div>
              ) : (
                <video
                  src={getMediaDisplayUrl(currentMedia)}
                  className="max-h-full max-w-full rounded-lg"
                  controls
                  autoPlay
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Thumbnail strip */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="border-t border-white/10 bg-black/30 backdrop-blur-md"
      >
        <div
          ref={thumbnailsRef}
          className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 flex gap-2 overflow-x-auto px-4 py-4"
        >
          {media.map((item, index) => {
            const isActive = index === currentIndex;
            return (
              <motion.button
                key={item.id}
                onClick={() => goToIndex(index)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative shrink-0 overflow-hidden rounded-lg transition-all ${
                  isActive
                    ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-[#0a1628]"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <div className="relative h-16 w-24 sm:h-20 sm:w-32">
                  {item.type === "photo" ? (
                    <Image
                      src={getMediaDisplayUrl(item)}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="128px"
                    />
                  ) : (
                    <div className="relative h-full w-full">
                      <video
                        src={getMediaDisplayUrl(item)}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                          <div className="ml-0.5 h-0 w-0 border-t-[5px] border-b-[5px] border-l-8 border-t-transparent border-b-transparent border-l-white" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {/* {isActive && (
                  <motion.div
                    layoutId="activeThumbnail"
                    className="absolute inset-0 rounded-lg ring-2 ring-blue-400"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )} */}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
