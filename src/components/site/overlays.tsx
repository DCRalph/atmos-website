"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useSite } from "./site-provider";
import { IconButton } from "./ui";

/**
 * Glass modal. `center` is a notched panel, `right` a full-height sheet (cart,
 * filters), `bottom` a phone-style sheet. Portals inside `.site`.
 */
export function SiteDialog({
  open,
  onOpenChange,
  title,
  description,
  side = "center",
  trigger,
  children,
  className,
  titleAsWritten,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  side?: "center" | "right" | "bottom";
  trigger?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Title keeps its own casing (e.g. an artist or gig name). */
  titleAsWritten?: boolean;
}) {
  const { portalContainer } = useSite();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal container={portalContainer}>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "glass-dark glass-float fixed z-[71] flex flex-col duration-200 outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            side === "center" &&
              "data-[state=open]:zoom-in-95 top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--site-r-panel)] rounded-tl-none",
            side === "right" &&
              "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 w-full max-w-[440px] border-y-0 border-r-0",
            side === "bottom" &&
              "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[var(--site-r-panel)] border-x-0 border-b-0",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
            <div>
              <Dialog.Title
                className={cn(
                  "t-display text-2xl",
                  titleAsWritten && "normal-case",
                )}
              >
                {title}
              </Dialog.Title>
              <Dialog.Description
                className={
                  description ? "mt-2 text-[14px] text-white/65" : "sr-only"
                }
              >
                {description ?? title}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close" className="size-10">
                <X className="size-4" />
              </IconButton>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const DialogClose = Dialog.Close;

type LightboxImage = { src: string; alt: string };

/**
 * Full-screen image viewer. Swipe or drag (mouse too), arrow keys or the
 * buttons slide between images; Escape closes. Images are never cropped.
 */
export function Lightbox({
  images,
  index,
  onIndexChange,
}: {
  images: readonly LightboxImage[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const { portalContainer } = useSite();

  return (
    <Dialog.Root
      open={index !== null}
      onOpenChange={(open) => !open && onIndexChange(null)}
    >
      <Dialog.Portal container={portalContainer}>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-[70] bg-black/90 backdrop-blur-md" />
        {index === null ? null : (
          <LightboxContent
            images={images}
            index={index}
            onIndexChange={onIndexChange}
          />
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** How many images either side of the current one to load ahead. */
const PRELOAD = 2;

/**
 * The open viewer. Mounted per open, so the carousel starts on the tapped
 * image. Only images near the current one render, so neighbours are
 * preloaded and long galleries don't fetch everything at once.
 */
function LightboxContent({
  images,
  index,
  onIndexChange,
}: {
  images: readonly LightboxImage[];
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const many = images.length > 1;
  // Frozen at open: a changing option makes Embla re-init and jump.
  const [startIndex] = useState(index);
  const [track, api] = useEmblaCarousel({
    loop: many,
    startIndex,
    // Flicks carry momentum: harder ones glide past several photos, then
    // ease onto one. Higher duration means a longer, softer glide.
    skipSnaps: true,
    duration: 30,
    watchDrag: many,
  });

  useEffect(() => {
    if (!api) return;
    const select = () => onIndexChange(api.selectedScrollSnap());
    api.on("select", select);
    return () => {
      api.off("select", select);
    };
  }, [api, onIndexChange]);

  const near = (i: number) => {
    const d = Math.abs(i - index);
    return Math.min(d, images.length - d) <= PRELOAD;
  };

  return (
    <Dialog.Content
      className="fixed inset-0 z-[71] flex flex-col outline-none"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") api?.scrollNext();
        if (e.key === "ArrowLeft") api?.scrollPrev();
      }}
    >
      <div className="flex items-center justify-between p-4 md:p-6">
        <Dialog.Title className="t-label text-[12px] text-white/70 tabular-nums">
          {`${index + 1} / ${images.length}`}
        </Dialog.Title>
        <Dialog.Description className="sr-only">
          Swipe or use the arrow keys to move between images.
        </Dialog.Description>
        <Dialog.Close asChild>
          <IconButton label="Close viewer">
            <X className="size-5" />
          </IconButton>
        </Dialog.Close>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={track}
          className={cn(
            "h-full overflow-hidden",
            many && "cursor-grab active:cursor-grabbing",
          )}
        >
          <div className="flex h-full [touch-action:pan-y_pinch-zoom]">
            {images.map((img, i) => (
              <div
                key={i}
                aria-hidden={i !== index}
                className={cn(
                  "relative h-full min-w-0 shrink-0 grow-0 basis-full transition-[opacity,scale] duration-300 ease-out motion-reduce:transition-none",
                  i !== index && "scale-90 opacity-30",
                )}
              >
                {near(i) ? (
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    sizes="100vw"
                    loading="eager"
                    draggable={false}
                    unoptimized={img.src.endsWith(".gif")}
                    className="object-contain select-none"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
        {many ? (
          <>
            <IconButton
              label="Previous image"
              onClick={() => api?.scrollPrev()}
              className="absolute top-1/2 left-3 -translate-y-1/2 md:left-6"
            >
              <ChevronLeft className="size-5" />
            </IconButton>
            <IconButton
              label="Next image"
              onClick={() => api?.scrollNext()}
              className="absolute top-1/2 right-3 -translate-y-1/2 md:right-6"
            >
              <ChevronRight className="size-5" />
            </IconButton>
          </>
        ) : null}
      </div>
      <p className="p-4 text-center text-[14px] text-white/70 md:p-6">
        {images[index]?.alt}
      </p>
    </Dialog.Content>
  );
}

/** State for a lightbox: `open(i)` shows image i, spread `props` onto <Lightbox>. */
export function useLightbox() {
  const [index, setIndex] = useState<number | null>(null);
  return {
    index,
    open: setIndex,
    props: { index, onIndexChange: setIndex },
  } as const;
}
