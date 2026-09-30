"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
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
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  side?: "center" | "right" | "bottom";
  trigger?: ReactNode;
  children: ReactNode;
  className?: string;
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
              <Dialog.Title className="t-display text-2xl">
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

/** Full-screen image viewer. Arrow keys step, Escape closes; images are never cropped. */
export function Lightbox({
  images,
  index,
  onIndexChange,
}: {
  images: readonly { src: string; alt: string }[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const { portalContainer } = useSite();
  const current = index === null ? undefined : images[index];
  const step = (dir: 1 | -1) =>
    index !== null &&
    onIndexChange((index + dir + images.length) % images.length);

  return (
    <Dialog.Root
      open={index !== null}
      onOpenChange={(open) => !open && onIndexChange(null)}
    >
      <Dialog.Portal container={portalContainer}>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-[70] bg-black/90 backdrop-blur-md" />
        <Dialog.Content
          className="fixed inset-0 z-[71] flex flex-col outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
        >
          <div className="flex items-center justify-between p-4 md:p-6">
            <Dialog.Title className="t-label text-[12px] text-white/70 tabular-nums">
              {index === null ? "" : `${index + 1} / ${images.length}`}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Use the arrow keys to move between images.
            </Dialog.Description>
            <Dialog.Close asChild>
              <IconButton label="Close viewer">
                <X className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="relative flex-1">
            {current ? (
              <Image
                key={current.src}
                src={current.src}
                alt={current.alt}
                fill
                sizes="100vw"
                unoptimized={current.src.endsWith(".gif")}
                className="animate-in fade-in-0 object-contain duration-200"
              />
            ) : null}
            {images.length > 1 ? (
              <>
                <IconButton
                  label="Previous image"
                  onClick={() => step(-1)}
                  className="absolute top-1/2 left-3 -translate-y-1/2 md:left-6"
                >
                  <ChevronLeft className="size-5" />
                </IconButton>
                <IconButton
                  label="Next image"
                  onClick={() => step(1)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 md:right-6"
                >
                  <ChevronRight className="size-5" />
                </IconButton>
              </>
            ) : null}
          </div>
          <p className="p-4 text-center text-[14px] text-white/70 md:p-6">
            {current?.alt}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
