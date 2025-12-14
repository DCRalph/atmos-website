"use client";

import { useState } from "react";
import Image from "next/image";
import { type GigMedia } from "~Prisma/browser";

type MediaGalleryProps = {
  media: GigMedia[];
};

export function MediaGallery({ media }: MediaGalleryProps) {
  const [selectedMedia, setSelectedMedia] = useState<GigMedia | null>(null);

  if (media.length === 0) {
    return null;
  }

  // Separate featured and regular media
  const featuredMedia = media.filter((item) => item.featured);
  const regularMedia = media.filter((item) => !item.featured);

  return (
    <div className="space-y-8">
      {/* Featured Media Section */}
      {featuredMedia.length > 0 && (
        <div>
          <h3 className="mb-4 text-2xl font-bold tracking-wide">Featured</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featuredMedia.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-video cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
                onClick={() => setSelectedMedia(item)}
              >
                {item.type === "photo" ? (
                  <Image
                    src={item.url}
                    alt="Featured photo"
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <video
                    src={item.url}
                    className="h-full w-full object-cover"
                    controls={false}
                    muted
                    playsInline
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-white text-sm font-semibold">
                    {item.type === "photo" ? "View Photo" : "View Video"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regular Media Section */}
      {regularMedia.length > 0 && (
        <div>
          <h3 className="mb-4 text-2xl font-bold tracking-wide">
            {featuredMedia.length > 0 ? "Gallery" : "Media"}
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {regularMedia.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-video cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
                onClick={() => setSelectedMedia(item)}
              >
                {item.type === "photo" ? (
                  <Image
                    src={item.url}
                    alt="Gallery photo"
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <video
                    src={item.url}
                    className="h-full w-full object-cover"
                    controls={false}
                    muted
                    playsInline
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-white text-sm font-semibold">
                    {item.type === "photo" ? "View Photo" : "View Video"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media Modal */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <button
            className="absolute right-4 top-4 text-white text-2xl hover:text-white/70"
            onClick={() => setSelectedMedia(null)}
          >
            ×
          </button>
          <div className="relative max-h-[90vh] max-w-[90vw]">
            {selectedMedia.type === "photo" ? (
              <Image
                src={selectedMedia.url}
                alt="Full size photo"
                width={1920}
                height={1080}
                className="max-h-[90vh] w-auto rounded-lg object-contain"
              />
            ) : (
              <video
                src={selectedMedia.url}
                className="max-h-[90vh] w-auto rounded-lg"
                controls
                autoPlay
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

