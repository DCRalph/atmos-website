"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import { FaInstagram, FaSoundcloud, FaSpotify } from "react-icons/fa6";
import { cn } from "~/lib/utils";
import { contentItems, crew, gallery, type MockContent } from "../fixtures";
import { Lightbox, useLightbox } from "../overlays";
import { IconButton, Media, VariantTag } from "../primitives";

const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

const dateFmt = new Intl.DateTimeFormat("en-NZ", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Pacific/Auckland",
});

/**
 * Mix player. Playback is simulated at 30x so the scrubber visibly moves;
 * the real one would wrap the SoundCloud widget.
 */
function MixPlayer({ mix }: { mix: MockContent }) {
  const duration = mix.duration ?? 3600;
  const [wantsPlay, setWantsPlay] = useState(false);
  const [position, setPosition] = useState(754);
  // Reaching the end stops playback without an extra state write.
  const playing = wantsPlay && position < duration;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => setPosition((p) => Math.min(p + 30, duration)),
      1000,
    );
    return () => clearInterval(id);
  }, [playing, duration]);

  const pct = (position / duration) * 100;

  return (
    <article className="grid overflow-hidden border border-white/10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Media
        src={mix.image}
        alt=""
        sizes="(min-width: 768px) 45vw, 100vw"
        className="aspect-square md:aspect-auto md:min-h-[360px]"
      />
      <div className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex items-center gap-2 text-white/60">
          <FaSoundcloud className="size-5" />
          <span className="mx-label text-[10px]">
            {mix.platform} · {dateFmt.format(mix.date)}
          </span>
        </div>
        <h3 className="mx-display text-[clamp(1.75rem,3.2vw,2.75rem)]">
          {mix.title}
        </h3>
        <p className="max-w-[52ch] text-[15px] text-white/70">{mix.blurb}</p>

        <div className="mt-auto space-y-3">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => {
                if (position >= duration) setPosition(0);
                setWantsPlay(!playing);
              }}
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--mx-accent)] text-[var(--mx-accent-ink)] transition-[filter] hover:brightness-110"
            >
              {playing ? (
                <Pause className="size-6" fill="currentColor" />
              ) : (
                <Play className="ml-0.5 size-6" fill="currentColor" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <label htmlFor={`scrub-${mix.id}`} className="sr-only">
                Position
              </label>
              <input
                id={`scrub-${mix.id}`}
                type="range"
                min={0}
                max={duration}
                step={1}
                value={position}
                onChange={(e) => setPosition(Number(e.target.value))}
                aria-valuetext={`${clock(position)} of ${clock(duration)}`}
                style={{
                  background: `linear-gradient(to right, var(--mx-accent) ${pct}%, rgb(255 255 255 / 0.18) ${pct}%)`,
                }}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
              <div className="mx-num mt-2 flex justify-between text-[12px] text-white/55">
                <span>{clock(position)}</span>
                <span>-{clock(duration - position)}</span>
              </div>
            </div>
          </div>
          <a
            href="#"
            className="mx-label inline-flex items-center gap-1 text-[11px] text-white/70 hover:text-white"
          >
            Open on SoundCloud <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

function PlaylistCard({ item }: { item: MockContent }) {
  const Icon = item.platform === "Spotify" ? FaSpotify : FaSoundcloud;
  return (
    <a
      href="#"
      className="group grid grid-cols-[96px_1fr] items-center gap-5 border border-white/10 p-3 pr-5 transition-colors hover:bg-white/[0.04]"
    >
      <Media src={item.image} alt="" sizes="96px" className="aspect-square" />
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-white/60">
          <Icon className="size-4" />
          <span className="mx-label text-[10px]">{item.platform} playlist</span>
        </p>
        <p className="mx-display mt-2 text-xl">{item.title}</p>
        <p className="mt-1.5 line-clamp-2 text-[13px] text-white/60">
          {item.blurb}
        </p>
      </div>
    </a>
  );
}

function Gallery() {
  const [emblaRef, embla] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
  });
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const lb = useLightbox();

  const sync = useCallback(() => {
    if (!embla) return;
    setSelected(embla.selectedScrollSnap());
    setSnaps(embla.scrollSnapList());
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    embla.on("select", sync).on("reInit", sync).on("init", sync);
    queueMicrotask(sync);
    return () => {
      embla.off("select", sync).off("reInit", sync).off("init", sync);
    };
  }, [embla, sync]);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4 px-5 md:px-10">
        <h3 className="mx-display text-[clamp(1.75rem,3.2vw,2.75rem)]">
          From the floor
        </h3>
        <div className="flex gap-2">
          <IconButton
            label="Previous photos"
            disabled={!canPrev}
            onClick={() => embla?.scrollPrev()}
          >
            <ChevronLeft className="size-5" />
          </IconButton>
          <IconButton
            label="Next photos"
            disabled={!canNext}
            onClick={() => embla?.scrollNext()}
          >
            <ChevronRight className="size-5" />
          </IconButton>
        </div>
      </div>
      <div
        ref={emblaRef}
        className="overflow-hidden px-5 md:px-10"
        aria-roledescription="carousel"
      >
        <div className="flex gap-3">
          {gallery.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => lb.open(i)}
              aria-label={`Open photo: ${img.alt}`}
              className="relative aspect-[3/2] w-[85%] shrink-0 overflow-hidden sm:w-[48%] lg:w-[32%]"
            >
              <Image
                src={img.src}
                alt=""
                fill
                sizes="(min-width: 1024px) 32vw, 85vw"
                className="object-cover transition-transform duration-500 ease-out hover:scale-[1.03]"
              />
            </button>
          ))}
        </div>
      </div>
      <div
        className="mt-5 flex items-center justify-center gap-1.5"
        role="tablist"
        aria-label="Choose slide"
      >
        {snaps.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={selected === i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => embla?.scrollTo(i)}
            className="flex h-6 items-center"
          >
            <span
              className={cn(
                "block h-1 rounded-full transition-all duration-300",
                selected === i
                  ? "w-8 bg-white"
                  : "w-3 bg-white/25 hover:bg-white/50",
              )}
            />
          </button>
        ))}
      </div>
      <Lightbox images={gallery} {...lb.props} />
    </div>
  );
}

function CrewGrid() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 px-5 sm:grid-cols-3 md:px-10 lg:grid-cols-6">
      {crew.map((c) => (
        <article key={c.name} className="group">
          <div className="relative aspect-[4/5] overflow-hidden bg-white/5">
            <Image
              src={c.image}
              alt={c.name}
              fill
              sizes="(min-width: 1024px) 16vw, 50vw"
              className="object-cover grayscale transition-[filter,transform] duration-500 ease-out group-focus-within:grayscale-0 group-hover:scale-[1.03] group-hover:grayscale-0"
            />
            <div className="absolute inset-x-2 bottom-2 flex translate-y-2 gap-1.5 opacity-0 transition-[opacity,transform] duration-200 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100">
              <a
                href="#"
                aria-label={`${c.name} on Instagram`}
                className="mx-glass flex size-10 items-center justify-center rounded-full"
              >
                <FaInstagram className="size-4" />
              </a>
              <a
                href="#"
                aria-label={`${c.name} on SoundCloud`}
                className="mx-glass flex size-10 items-center justify-center rounded-full"
              >
                <FaSoundcloud className="size-4" />
              </a>
            </div>
          </div>
          <h3 className="mx-display mt-3 truncate text-lg">{c.name}</h3>
          <p className="mx-label mt-1.5 text-[9px] leading-snug text-white/55">
            {c.role}
          </p>
        </article>
      ))}
    </div>
  );
}

export function ContentSection() {
  const [mix, ...playlists] = contentItems;
  return (
    <div className="space-y-16 pb-16">
      <div>
        <VariantTag>Mix player · play, pause, drag the scrubber</VariantTag>
        <div className="grid gap-4 px-5 md:px-10 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {mix ? <MixPlayer mix={mix} /> : null}
          <div className="grid content-start gap-4">
            {playlists.map((p) => (
              <PlaylistCard key={p.id} item={p} />
            ))}
          </div>
        </div>
      </div>
      <div>
        <VariantTag>Gallery · swipe or drag, tap to open</VariantTag>
        <Gallery />
      </div>
      <div>
        <VariantTag>Crew · hover or tab for links</VariantTag>
        <CrewGrid />
      </div>
    </div>
  );
}
