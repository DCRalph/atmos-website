"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import JSZip from "jszip";
import { Check, Download } from "lucide-react";
import { getMediaDisplayUrl } from "~/lib/media-url";
import useMasonry from "~/hooks/useMasonry";

/** Use local API URL for fetches to avoid S3 CORS. Relative path = same origin. */
function getDownloadUrl(item: MediaItem): string | null {
  const id = item.fileUpload?.id ?? item.fileUploadId;
  if (id) return `/api/media/${id}`;
  return getMediaDisplayUrl(item) || null;
}

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
    width?: number | null;
    height?: number | null;
  } | null;
};

type MediaGalleryProps = {
  media: MediaItem[];
  gigTitle?: string;
};

// Helper to get filename for download
function getDownloadFilename(item: MediaItem, index: number): string {
  const base =
    item.fileUpload?.name ?? `image-${item.id}`;
  const ext = base.includes(".") ? base.split(".").pop() ?? "jpg" : "jpg";
  const nameWithoutExt = base.replace(/\.[^/.]+$/, "") || `image-${index}`;
  return `${nameWithoutExt}.${ext}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "-").replace(/\s+/g, "-").trim() || "gallery";
}

export function MediaGallery({ media, gigTitle }: MediaGalleryProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Close overlay when tapping outside (touch + mouse)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (galleryRef.current?.contains(target)) return;
      setActiveItemId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const masonryRef = useMasonry(media.length, {
    gap: 16,
    columns: { default: 2, md: 2, lg: 3, xl: 4 },
  });

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const downloadSingle = useCallback(async (item: MediaItem, index: number) => {
    const url = getDownloadUrl(item);
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = getDownloadFilename(item, index);
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Fallback: open in new tab
      window.open(url, "_blank");
    }
  }, []);

  const downloadAsZip = useCallback(async () => {
    setActiveItemId(null);
    const items = media.filter(
      (m) => m.type === "photo" && selectedIds.has(m.id)
    );
    if (items.length === 0) return;
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      await Promise.all(
        items.map(async (item, i) => {
          const url = getDownloadUrl(item);
          if (!url) return;
          try {
            const res = await fetch(url);
            const blob = await res.blob();
            zip.file(getDownloadFilename(item, i), blob);
          } catch {
            // Skip failed fetches (e.g. CORS)
          }
        })
      );
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `${sanitizeFilename(gigTitle ?? "gallery")}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setIsDownloading(false);
    }
  }, [media, selectedIds, gigTitle]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setActiveItemId(null);
  }, []);

  if (media.length === 0) {
    return null;
  }

  // Separate featured and regular media, sorted by sortOrder
  const featuredMedia = media
    .filter((item) => item.section === "featured")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const regularMedia = media
    .filter((item) => item.section === "gallery")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const allPhotoItems = [...featuredMedia, ...regularMedia].filter(
    (m) => m.type === "photo"
  );
  const selectedCount = allPhotoItems.filter((m) => selectedIds.has(m.id))
    .length;

  const renderMediaItem = (
    item: MediaItem,
    index: number,
    layoutClass: string
  ) => {
    const url = getMediaDisplayUrl(item);
    const isPhoto = item.type === "photo";
    const isSelected = selectedIds.has(item.id);

    const isOverlayVisible = activeItemId === item.id;

    return (
      <div
        key={item.id}
        role="group"
        tabIndex={0}
        aria-label={`${isPhoto ? "Photo" : "Video"}, tap to show options`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          setActiveItemId((prev) => (prev === item.id ? null : item.id));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setActiveItemId((prev) => (prev === item.id ? null : item.id));
          }
        }}
        className={`group hover:border-accent-muted relative overflow-hidden rounded-none border-2 border-white/10 bg-black/50 transition-all hover:shadow-[0_0_15px_var(--accent-muted)] touch-manipulation ${layoutClass}`}
        style={
          isPhoto && item.fileUpload?.width && item.fileUpload?.height
            ? {
                aspectRatio: `${item.fileUpload.width} / ${item.fileUpload.height}`,
              }
            : isPhoto
              ? { aspectRatio: "4 / 3" }
              : undefined
        }
      >
        {isPhoto ? (
          <Image
            src={url}
            alt="Gallery photo"
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <video
            src={url}
            className="h-full w-full object-cover"
            controls={false}
            muted
            playsInline
          />
        )}
        {/* Hover/tap overlay with controls - visible on hover (desktop) or tap (touch) */}
        <div
          className={`absolute inset-0 flex items-center justify-center gap-3 bg-black/60 transition-opacity ${
            isOverlayVisible
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto"
          }`}
        >
          {isPhoto && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleSelection(item.id);
              }}
              className={`flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-full border-2 transition-colors active:scale-95 ${
                isSelected
                  ? "border-accent-strong bg-accent-strong text-black"
                  : "border-white/80 bg-white/20 text-white hover:bg-white/40"
              }`}
              aria-label={isSelected ? "Deselect" : "Select"}
            >
              <Check className="h-5 w-5" strokeWidth={3} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              downloadSingle(item, index);
            }}
            className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-full border-2 border-white/80 bg-white/20 text-white transition-colors active:scale-95 hover:bg-white/40"
            aria-label="Download"
          >
            <Download className="h-5 w-5" />
          </button>
        </div>
        {/* Selected indicator */}
        {isPhoto && isSelected && (
          <div className="absolute right-2 top-2 rounded-full bg-accent-strong px-2 py-0.5 text-xs font-bold text-black">
            ✓
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={galleryRef}>
      <div className="space-y-8">
        {/* Featured Media Section */}
        {featuredMedia.length > 0 && (
          <div className="hover:border-accent-muted/50 border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all hover:shadow-[0_0_20px_var(--accent-muted)] sm:p-8">
            <h3 className="border-accent-strong mb-6 border-l-4 pl-4 text-2xl font-black tracking-wider uppercase">
              Featured
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featuredMedia.map((item, i) =>
                renderMediaItem(item, i, "aspect-video")
              )}
            </div>
          </div>
        )}

        {/* Regular Media Section */}
        {regularMedia.length > 0 && (
          <div className="hover:border-accent-muted/50 border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all hover:shadow-[0_0_20px_var(--accent-muted)] sm:p-8">
            <h3 className="border-accent-strong mb-6 border-l-4 pl-4 text-2xl font-black tracking-wider uppercase">
              {featuredMedia.length > 0 ? "Gallery" : "Media"}
            </h3>
            <div ref={masonryRef} className="relative w-full">
              {regularMedia.map((item, i) =>
                renderMediaItem(
                  item,
                  featuredMedia.length + i,
                  item.type === "photo" ? "" : "aspect-video"
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pill-shaped selection bar at bottom - safe area for mobile */}
      {selectedCount > 0 && (
        <div
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 touch-manipulation items-center gap-3 rounded-full border-2 border-white/20 bg-black/90 px-4 py-3 shadow-lg backdrop-blur-md sm:gap-4 sm:px-6"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          role="status"
          aria-live="polite"
        >
          <span className="text-sm font-medium text-white">
            {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
          </span>
          <div className="h-4 w-px bg-white/30" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadAsZip}
              disabled={isDownloading}
              aria-label={isDownloading ? "Preparing download" : "Download as ZIP"}
              className="flex min-h-[44px] touch-manipulation items-center justify-center gap-2 rounded-full bg-accent-strong px-4 py-2.5 text-sm font-bold text-black transition-opacity active:scale-95 hover:opacity-90 disabled:opacity-50"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">
                {isDownloading ? "Preparing…" : "Download as ZIP"}
              </span>
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-full px-3 py-2 text-sm text-white/80 transition-colors active:scale-95 hover:bg-white/10 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
