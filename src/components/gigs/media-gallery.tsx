"use client"

import { useState } from "react"
import Image from "next/image"
import { AnimatePresence } from "motion/react"
import { getMediaDisplayUrl } from "~/lib/media-url"
import { FullscreenGallery } from "./fullscreen-gallery"

type MediaItem = {
  id: string
  type: string
  url: string | null
  section: string
  sortOrder: number
  fileUploadId?: string | null
  fileUpload?: {
    id: string
    url: string
    name: string
    mimeType: string
  } | null
}

type MediaGalleryProps = {
  media: MediaItem[]
}

export function MediaGallery({ media }: MediaGalleryProps) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (media.length === 0) {
    return null
  }

  // Separate featured and regular media, sorted by sortOrder
  const featuredMedia = media
    .filter((item) => item.section === "featured")
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const regularMedia = media
    .filter((item) => item.section === "gallery")
    .sort((a, b) => a.sortOrder - b.sortOrder)

  // Combined media array for the gallery
  const allMedia = [...featuredMedia, ...regularMedia]

  const openGallery = (mediaItem: MediaItem) => {
    const index = allMedia.findIndex((m) => m.id === mediaItem.id)
    setSelectedIndex(index >= 0 ? index : 0)
    setGalleryOpen(true)
  }

  return (
    <>
      <div className="space-y-8">
        {/* Featured Media Section */}
        {featuredMedia.length > 0 && (
          <div className="border-2 border-white/10 bg-black/80 backdrop-blur-sm p-6 sm:p-8 hover:border-accent-muted/50 hover:shadow-[0_0_20px_var(--accent-muted)] transition-all">
            <h3 className="mb-6 text-2xl font-black tracking-wider uppercase border-l-4 border-accent-strong pl-4">
              Featured
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featuredMedia.map((item) => {
                const url = getMediaDisplayUrl(item)
                return (
                  <div
                    key={item.id}
                    className="group relative aspect-video cursor-pointer overflow-hidden rounded-none border-2 border-white/10 bg-black/50 transition-all hover:border-accent-muted hover:shadow-[0_0_15px_var(--accent-muted)]"
                    onClick={() => openGallery(item)}
                  >
                    {item.type === "photo" ? (
                      <Image
                        src={url}
                        alt="Featured photo"
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
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="text-white text-sm font-black uppercase tracking-wider">
                        {item.type === "photo" ? "View Photo" : "View Video"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Regular Media Section */}
        {regularMedia.length > 0 && (
          <div className="border-2 border-white/10 bg-black/80 backdrop-blur-sm p-6 sm:p-8 hover:border-accent-muted/50 hover:shadow-[0_0_20px_var(--accent-muted)] transition-all">
            <h3 className="mb-6 text-2xl font-black tracking-wider uppercase border-l-4 border-accent-strong pl-4">
              {featuredMedia.length > 0 ? "Gallery" : "Media"}
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {regularMedia.map((item) => {
                const url = getMediaDisplayUrl(item)
                return (
                  <div
                    key={item.id}
                    className="group relative aspect-video cursor-pointer overflow-hidden rounded-none border-2 border-white/10 bg-black/50 transition-all hover:border-accent-muted hover:shadow-[0_0_15px_var(--accent-muted)]"
                    onClick={() => openGallery(item)}
                  >
                    {item.type === "photo" ? (
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
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="text-white text-sm font-black uppercase tracking-wider">
                        {item.type === "photo" ? "View Photo" : "View Video"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Gallery Overlay */}
      <AnimatePresence>
        {galleryOpen && (
          <FullscreenGallery
            media={allMedia}
            initialIndex={selectedIndex}
            onClose={() => setGalleryOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
