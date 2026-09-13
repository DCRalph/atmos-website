"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion } from "motion/react";
import { X } from "lucide-react";

/**
 * A gig poster, full screen.
 *
 * A portal onto true black with the poster contained rather than covered: the
 * hero crops the artwork to fit, and seeing it whole is the only reason this
 * view exists. Escape, the backdrop and the close button all dismiss it.
 *
 * Not for a TBA gig. That poster is a teaser and the page blurs it on purpose,
 * so the caller keeps the button away rather than this undoing it.
 *
 * Portals straight to `document.body` with no mounted guard, because it is only
 * ever rendered from a click and so never runs on the server.
 */
export function PosterLightbox({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} poster`}
      onClick={onClose}
      className="fixed inset-0 z-500 flex items-center justify-center bg-black p-4 sm:p-8"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close poster"
        className="absolute top-4 right-4 z-10 flex items-center gap-2 border border-white/20 bg-black/40 px-4 py-2.5 text-sm font-bold tracking-wider text-white uppercase backdrop-blur-md transition-all hover:border-white/50 hover:bg-black/60"
      >
        <X className="h-4 w-4" />
        Close
      </button>

      <div className="relative h-full w-full">
        <Image
          src={url}
          alt={`${title} poster`}
          fill
          priority
          sizes="100vw"
          className="object-contain"
        />
      </div>
    </motion.div>,
    document.body,
  );
}
