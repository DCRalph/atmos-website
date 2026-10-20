"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { VideoPlayer, type VideoPlayback } from "./video-player";

export type ViewerMedia = {
  id: string;
  type: "photo" | "video";
  src: string;
  alt: string;
  download?: string;
};

export type ViewerSelection = { index: number; playback?: VideoPlayback };

const button =
  "inline-flex size-11 shrink-0 items-center justify-center text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-[#c6ff33]";

/** Shared public/admin viewer. Only the selected video mounts, so hidden clips cannot play. */
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
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const many = media.length > 1;
  function move(offset: number) {
    onSelectionChange({
      index: (selection.index + offset + media.length) % media.length,
    });
  }
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
          move(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 pt-[env(safe-area-inset-top)] md:px-6">
        <Dialog.Title className="min-w-0 truncate py-4 text-sm">
          {item.alt}
        </Dialog.Title>
        <Dialog.Description className="sr-only">
          Media viewer. Use the previous and next buttons to browse. Escape
          closes.
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
      <div className="relative min-h-0 flex-1">
        {item.type === "video" ? (
          <VideoPlayer
            key={item.id}
            src={item.src}
            label={item.alt}
            initialPlayback={selection.playback}
            fill
            className="pb-[env(safe-area-inset-bottom)]"
          />
        ) : (
          <div
            className="relative size-full touch-pan-y"
            onPointerDown={(event) => {
              pointerStart.current = { x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              pointerStart.current = null;
            }}
            onPointerUp={(event) => {
              const start = pointerStart.current;
              pointerStart.current = null;
              if (!many || !start) return;
              const distance = event.clientX - start.x;
              if (
                Math.abs(distance) > 60 &&
                Math.abs(distance) > Math.abs(event.clientY - start.y)
              )
                move(distance > 0 ? -1 : 1);
            }}
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              sizes="100vw"
              className="object-contain"
              draggable={false}
            />
          </div>
        )}
      </div>
      {many && (
        <div className="flex shrink-0 items-center justify-center gap-8 border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            className={button}
            aria-label="Previous media"
            onClick={() => move(-1)}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            className={button}
            aria-label="Next media"
            onClick={() => move(1)}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </Dialog.Content>
  );
}
