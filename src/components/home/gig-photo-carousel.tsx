"use client";

import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
} from "~/components/ui/carousel";
import Image from "next/image";
import { getMediaDisplayUrl } from "~/lib/media-url";
import { useCallback, useEffect, useRef, useState } from "react";

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
  } | null;
};

type GigPhotoCarouselProps = {
  media: MediaItem[];
  gigTitle: string;
  variant?: "default" | "compact";
  autoPlayDelay?: number;
};

export function GigPhotoCarousel({
  media,
  gigTitle,
  variant = "default",
  autoPlayDelay = 3000,
}: GigPhotoCarouselProps) {
  const featuredPhotos = media
    .filter((m) => m.section === "featured" && m.type === "photo")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const photosToShow = featuredPhotos;

  const [carouselApi, setApi] = useState<CarouselApi | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearAutoPlay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startAutoPlay = useCallback(() => {
    if (!carouselApi || photosToShow.length <= 1) return;

    clearAutoPlay();
    intervalRef.current = setInterval(() => {
      carouselApi.scrollNext();
    }, autoPlayDelay);
  }, [carouselApi, autoPlayDelay, clearAutoPlay, photosToShow.length]);

  // Setup autoplay and event listeners
  useEffect(() => {
    if (!carouselApi || photosToShow.length <= 1) return;

    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap() ?? 0);
    };

    // Reset autoplay on user interaction
    const onPointerDown = () => clearAutoPlay();
    const onPointerUp = () => startAutoPlay();

    carouselApi.on("select", onSelect);
    carouselApi.on("pointerDown", onPointerDown);
    carouselApi.on("pointerUp", onPointerUp);

    // Start autoplay
    startAutoPlay();

    return () => {
      carouselApi.off("select", onSelect);
      carouselApi.off("pointerDown", onPointerDown);
      carouselApi.off("pointerUp", onPointerUp);
      clearAutoPlay();
    };
  }, [carouselApi, startAutoPlay, clearAutoPlay, photosToShow.length]);

  if (photosToShow.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:p-5">
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-white/20">
          <p className="text-xs text-white/40">No photos available</p>
        </div>
      </div>
    );
  }

  const imageContainerClassName =
    variant === "compact"
      ? "relative h-32 sm:h-36 overflow-hidden rounded-lg border border-white/10 bg-black/20"
      : "relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black/20";

  return (
    <div className="flex flex-col gap-3">
      <Carousel
        opts={{
          align: "start",
          loop: photosToShow.length > 1,
        }}
        setApi={setApi}
        className="relative w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {photosToShow.map((photo) => (
            <CarouselItem key={photo.id} className="pl-2 md:pl-4">
              <div className={imageContainerClassName}>
                <Image
                  src={getMediaDisplayUrl(photo)}
                  alt={`${gigTitle} photo`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes={
                    variant === "compact"
                      ? "(max-width: 768px) 100vw, 320px"
                      : "(max-width: 768px) 100vw, 50vw"
                  }
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Optional: Slide indicators */}
      {/* {photosToShow.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {photosToShow.map((_, idx) => (
            <button
              key={idx}
              onClick={() => carouselApi?.scrollTo(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentSlide
                  ? "w-4 bg-white"
                  : "w-1.5 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )} */}
    </div>
  );
}