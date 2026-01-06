"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
import Image from "next/image";

type MediaItem = {
  id: string;
  type: string;
  url: string | null;
  section: string;
  sortOrder: number;
  fileUpload?: {
    id: string;
    url: string;
    name: string;
    mimeType: string;
  } | null;
};

type GigPhotoCarouselProps = {
  media: MediaItem[];
  gigTitle: string;
};

// Helper to get the displayable URL
const getMediaUrl = (item: MediaItem): string => {
  return item.fileUpload?.url ?? item.url ?? "";
};

export function GigPhotoCarousel({ media, gigTitle }: GigPhotoCarouselProps) {
  // Get featured photos first, falling back to gallery photos
  const featuredPhotos = media
    .filter((m) => m.section === "featured" && m.type === "photo")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const galleryPhotos = media
    .filter((m) => m.section === "gallery" && m.type === "photo")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const photosToShow = featuredPhotos.length > 0 ? featuredPhotos : galleryPhotos;

  if (photosToShow.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
          Featured photos
        </p>
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-white/20">
          <p className="text-xs text-white/40">No photos available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/60 px-1">
        Featured photos
      </p>
      <Carousel
        opts={{
          align: "start",
          loop: photosToShow.length > 1,
        }}
        className="relative w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {photosToShow.map((photo) => (
            <CarouselItem key={photo.id} className="pl-2 md:pl-4">
              <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black/20">
                <Image
                  src={getMediaUrl(photo)}
                  alt={`${gigTitle} photo`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {photosToShow.length > 1 && (
          <>
            <CarouselPrevious className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 border-white/20 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 hover:border-white/40" />
            <CarouselNext className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 border-white/20 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 hover:border-white/40" />
          </>
        )}
      </Carousel>
    </div>
  );
}
