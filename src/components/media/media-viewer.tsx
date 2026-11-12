"use client";

import { useEffect, useState } from "react";
import Image, { getImageProps } from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Download, Play, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { VideoPlayer, type VideoPlayback } from "./video-player";

export type ViewerMedia = {
  id: string;
  type: "photo" | "video";
  src: string;
  alt: string;
  download?: string;
};

export type ViewerSelection = { index: number; playback?: VideoPlayback };

/** The viewer asks for photos at this size, and preloading warms the same file. */
const PHOTO_SIZES = "100vw";

const button =
  "inline-flex size-11 shrink-0 items-center justify-center text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-[#c6ff33]";

/**
 * Fetches every photo at the size the viewer shows it, once the page has
 * loaded, so opening the viewer and swiping through it never waits on the
 * network. Low priority, so it never holds up anything on screen.
 */
export function usePreloadViewerPhotos(media: readonly ViewerMedia[]) {
  const key = media
    .flatMap((item) => (item.type === "photo" ? [item.src] : []))
    .join("\n");
  useEffect(() => {
    if (!key) return;
    const preload = () => {
      for (const src of key.split("\n")) {
        const { props } = getImageProps({
          src,
          alt: "",
          fill: true,
          sizes: PHOTO_SIZES,
        });
        const img = new window.Image();
        img.setAttribute("fetchpriority", "low");
        if (props.sizes) img.sizes = props.sizes;
        if (props.srcSet) img.srcset = props.srcSet;
        img.src = props.src;
      }
    };
    if (document.readyState === "complete") {
      preload();
      return;
    }
    window.addEventListener("load", preload, { once: true });
    return () => window.removeEventListener("load", preload);
  }, [key]);
}

/**
 * Shared public/admin viewer. Slides between items with a drag, swipe,
 * two-finger trackpad swipe, arrow keys or the buttons. Only the selected
 * video mounts, so hidden clips cannot play.
 */
export function MediaViewer({
  media,
  selection,
  onSelectionChange,
  container,
}: {
  media: readonly ViewerMedia[];
  selection: ViewerSelection | null;
  onSelectionChange: (selection: ViewerSelection | null) => void;
  container?: HTMLElement | null;
}) {
  return (
    <Dialog.Root
      open={selection !== null}
      onOpenChange={(open) => !open && onSelectionChange(null)}
    >
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/95" />
        {selection && media[selection.index] && (
          <ViewerContent
            media={media}
            selection={selection}
            onSelectionChange={onSelectionChange}
          />
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Drags that start on a control belong to it: a video's scrubber, volume and buttons.
const DRAG_IGNORE =
  "button, a, input, select, [role=slider], [data-radix-popper-content-wrapper]";

/**
 * A horizontal two-finger trackpad swipe moves one item. The wheel events of
 * one swipe, momentum included, arrive in an unbroken stream, so the swipe
 * stays spent until they pause. Handling them also stops the browser reading
 * the swipe as back or forward.
 */
function useWheelSwipe(api: UseEmblaCarouselType[1], enabled: boolean) {
  useEffect(() => {
    if (!api || !enabled) return;
    const node = api.rootNode();
    let travel = 0;
    let spent = false;
    let pause: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      clearTimeout(pause);
      pause = setTimeout(() => {
        travel = 0;
        spent = false;
      }, 180);
      if (spent) return;
      travel += event.deltaX;
      if (Math.abs(travel) < 30) return;
      spent = true;
      if (travel > 0) api.scrollNext();
      else api.scrollPrev();
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      clearTimeout(pause);
    };
  }, [api, enabled]);
}

function ViewerContent({
  media,
  selection,
  onSelectionChange,
}: {
  media: readonly ViewerMedia[];
  selection: ViewerSelection;
  onSelectionChange: (selection: ViewerSelection | null) => void;
}) {
  const item = media[selection.index]!;
  const [opener] = useState(() =>
    typeof document === "undefined" ? null : document.activeElement,
  );
  const many = media.length > 1;
  // Frozen at open: a changing option makes Embla re-init and jump.
  const [startIndex] = useState(selection.index);
  const [track, api] = useEmblaCarousel({
    loop: many,
    startIndex,
    duration: 28,
    watchDrag: many
      ? (_, event) =>
          !(
            event.target instanceof Element && event.target.closest(DRAG_IGNORE)
          )
      : false,
  });
  useWheelSwipe(api, many);

  useEffect(() => {
    if (!api) return;
    const select = () => onSelectionChange({ index: api.selectedScrollSnap() });
    api.on("select", select);
    return () => {
      api.off("select", select);
    };
  }, [api, onSelectionChange]);
  // Follow a selection changed from outside, e.g. by the parent.
  useEffect(() => {
    if (api && api.selectedScrollSnap() !== selection.index) {
      api.scrollTo(selection.index);
    }
  }, [api, selection.index]);

  return (
    <Dialog.Content
      className="fixed inset-0 z-[91] flex h-dvh min-w-0 flex-col bg-black text-white outline-none"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (opener instanceof HTMLElement) opener.focus();
      }}
      onEscapeKeyDown={(event) => {
        if (document.fullscreenElement) event.preventDefault();
      }}
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          !many ||
          (event.target instanceof HTMLElement &&
            event.target.closest(
              "input, select, [role=group], [data-radix-popper-content-wrapper]",
            ))
        )
          return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          if (event.key === "ArrowLeft") api?.scrollPrev();
          else api?.scrollNext();
        }
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 pt-[env(safe-area-inset-top)] md:px-6">
        <Dialog.Title className="min-w-0 truncate py-4 text-sm">
          {item.alt}
        </Dialog.Title>
        <Dialog.Description className="sr-only">
          Media viewer. Swipe, or use the previous and next buttons or arrow
          keys, to browse. Escape closes.
        </Dialog.Description>
        <div className="flex shrink-0 items-center gap-1">
          <span className="px-2 text-xs text-white/60 tabular-nums">
            {selection.index + 1} / {media.length}
          </span>
          {item.download && (
            <a
              href={item.download}
              download
              className={button}
              aria-label="Download original"
            >
              <Download className="size-4" />
            </a>
          )}
          <Dialog.Close asChild>
            <button type="button" className={button} aria-label="Close viewer">
              <X className="size-5" />
            </button>
          </Dialog.Close>
        </div>
      </div>
      <div
        ref={track}
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden",
          many && "cursor-grab active:cursor-grabbing",
        )}
      >
        <div className="flex h-full [touch-action:pan-y_pinch-zoom]">
          {media.map((slide, i) => {
            const current = i === selection.index;
            return (
              <div
                key={slide.id}
                aria-hidden={!current}
                className={cn(
                  "relative h-full min-w-0 shrink-0 grow-0 basis-full transition-[opacity,scale] duration-300 ease-out motion-reduce:transition-none",
                  !current && "scale-90 opacity-30",
                )}
              >
                {slide.type === "photo" ? (
                  <Image
                    src={slide.src}
                    alt={slide.alt}
                    fill
                    sizes={PHOTO_SIZES}
                    loading="eager"
                    draggable={false}
                    className="object-contain select-none"
                  />
                ) : current ? (
                  <VideoPlayer
                    key={slide.id}
                    src={slide.src}
                    label={slide.alt}
                    initialPlayback={selection.playback}
                    fill
                    className="pb-[env(safe-area-inset-bottom)]"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Play className="size-10 text-white/40" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {many && (
        <div className="flex shrink-0 items-center justify-center gap-8 border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            className={button}
            aria-label="Previous media"
            onClick={() => api?.scrollPrev()}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            className={button}
            aria-label="Next media"
            onClick={() => api?.scrollNext()}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </Dialog.Content>
  );
}
