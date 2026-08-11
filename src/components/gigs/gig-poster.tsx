"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { orbitron } from "~/lib/fonts";

type GigPosterProps = {
  posterUrl?: string | null;
  title: string;
  isTba?: boolean;
  /** Shared layout id for the poster transition into the gig detail page. */
  layoutId?: string;
  sizes?: string;
  priority?: boolean;
  /** Sizing for the "TBA..." overlay, tuned per card size. */
  tbaClassName?: string;
  className?: string;
};

/**
 * Poster area for a gig card. Always occupies the same 3:4 box so cards in a
 * grid line up, whether the gig has a poster, is in TBA mode, or has neither.
 */
export function GigPoster({
  posterUrl,
  title,
  isTba = false,
  layoutId,
  sizes = "(max-width: 768px) 50vw, 33vw",
  priority = false,
  tbaClassName = "text-4xl sm:text-5xl md:text-6xl",
  className,
}: GigPosterProps) {
  return (
    <motion.div
      layoutId={layoutId}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className={cn(
        "relative aspect-3/4 w-full shrink-0 overflow-hidden bg-black/40",
        className,
      )}
    >
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={isTba ? "TBA poster" : `${title} poster`}
          fill
          sizes={sizes}
          priority={priority}
          className={cn(
            "object-cover",
            isTba
              ? "blur-md"
              : "transition-transform duration-300 group-hover:scale-105",
          )}
        />
      ) : (
        <PosterFallback title={title} isTba={isTba} />
      )}

      {isTba && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <h3
            className={cn(
              "font-black tracking-tight text-white uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]",
              tbaClassName,
            )}
          >
            TBA...
          </h3>
        </div>
      )}
    </motion.div>
  );
}

/** Stand-in artwork for gigs with no poster uploaded. */
function PosterFallback({ title, isTba }: { title: string; isTba: boolean }) {
  return (
    <div className="from-accent-strong/40 absolute inset-0 flex items-center justify-center bg-linear-to-br via-black to-black">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(255,255,255,0.5) 10px, rgba(255,255,255,0.5) 11px)",
        }}
      />
      {!isTba && (
        <div className="relative flex w-full flex-col items-center gap-3 px-4">
          <Image
            src="/logo/atmos-white.png"
            alt=""
            width={500}
            height={112}
            sizes="(max-width: 768px) 50vw, 33vw"
            className="w-2/3 opacity-25"
          />
          <span
            className={cn(
              "line-clamp-3 text-center text-xs font-black tracking-widest text-white/60 uppercase sm:text-sm",
              orbitron.className,
            )}
          >
            {title}
          </span>
        </div>
      )}
    </div>
  );
}
