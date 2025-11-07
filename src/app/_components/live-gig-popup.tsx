"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "~/trpc/react";
import { ChevronUp, ChevronDown } from "lucide-react";

export function LiveGigPopup() {
  const { data: todayGigs, isLoading } = api.gigs.getToday.useQuery();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (todayGigs && todayGigs.length > 0) {
      // Show popup after a short delay
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [todayGigs]);

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleExpand = () => {
    setIsMinimized(false);
  };

  if (isLoading || !todayGigs || todayGigs.length === 0) {
    return null;
  }

  const liveGig = todayGigs[0]; // Show the first gig if multiple

  if (!liveGig) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="popup-container"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none p-4"
        >
          <AnimatePresence mode="wait">
            {isMinimized ? (
              // Minimized version - compact bar
              <motion.div
                key="minimized"
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={handleExpand}
                className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-lg border border-red-500/50 bg-black/95 backdrop-blur-md shadow-2xl cursor-pointer hover:border-red-500/80 transition-colors"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Live Badge */}
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-1 flex-shrink-0"
                  >
                    <motion.div
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="h-1.5 w-1.5 rounded-full bg-white"
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                      Live
                    </span>
                  </motion.div>

                  {/* Gig Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      {liveGig.title}
                    </h3>
                    <p className="text-xs text-white/60 truncate">
                      {liveGig.subtitle}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {liveGig.ticketLink && (
                      <a
                        href={liveGig.ticketLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-red-700 whitespace-nowrap"
                      >
                        Tickets
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExpand();
                      }}
                      className="text-white/60 hover:text-white transition-colors p-1"
                      aria-label="Expand"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              // Full version - expanded popup
              <motion.div
                key="expanded"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="pointer-events-auto relative w-full max-w-2xl overflow-hidden rounded-t-lg border border-red-500/50 bg-black/95 backdrop-blur-md shadow-2xl"
              >
                {/* Minimize Button */}
                <button
                  onClick={handleMinimize}
                  className="absolute right-3 top-3 z-10 text-white/60 transition-colors hover:text-white"
                  aria-label="Minimize popup"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>

                {/* Live Badge */}
                <div className="absolute left-4 top-4 z-10">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5"
                  >
                    <motion.div
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="h-2 w-2 rounded-full bg-white"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Live
                    </span>
                  </motion.div>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-4 p-6 pt-16 sm:p-8 sm:pt-20">
                  <div className="flex-1">
                    <h2 className="mb-2 text-2xl sm:text-3xl font-bold tracking-wider text-white">
                      {liveGig.title}
                    </h2>
                    <p className="mb-3 text-base sm:text-lg text-white/80">
                      {liveGig.subtitle}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <div className="text-sm sm:text-base text-white/60">
                        <span className="font-semibold">Today</span>
                        {liveGig.time && (
                          <span className="ml-2">• {liveGig.time}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {liveGig.ticketLink && (
                    <a
                      href={liveGig.ticketLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleMinimize()}
                      className="w-full sm:w-auto rounded-md bg-red-600 px-6 py-3 text-center font-semibold text-white transition-all hover:bg-red-700 whitespace-nowrap"
                    >
                      Get Tickets
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

