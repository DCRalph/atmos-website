"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Expand,
  Maximize,
  Minimize,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "~/lib/utils";

export type VideoPlayback = {
  time: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  rate: number;
};

function timestamp(seconds: number) {
  const total = Math.floor(Number.isFinite(seconds) ? seconds : 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
}

const control =
  "inline-flex h-11 w-9 shrink-0 cursor-pointer items-center justify-center text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#c6ff33] disabled:cursor-default disabled:opacity-40 @min-[360px]:w-11";

const noSubscribe = () => () => {
  // Fullscreen support stays constant for the lifetime of this document.
};
const readFullscreenSupport = () => document.fullscreenEnabled;
const noFullscreen = () => false;

/** Black stages contain the original frame. Only this custom control bar is shown. */
export function VideoPlayer({
  src,
  label,
  initialPlayback,
  onExpand,
  suspended = false,
  fill = false,
  className,
}: {
  src: string;
  label: string;
  initialPlayback?: VideoPlayback;
  onExpand?: (playback: VideoPlayback) => void;
  suspended?: boolean;
  fill?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(initialPlayback?.muted ?? false);
  const [volume, setVolume] = useState(initialPlayback?.volume ?? 1);
  const [rate, setRate] = useState(initialPlayback?.rate ?? 1);
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsContainer, setSettingsContainer] =
    useState<HTMLElement | null>(null);
  const canFullscreen = useSyncExternalStore(
    noSubscribe,
    readFullscreenSupport,
    noFullscreen,
  );
  const attachVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    // Cached media can finish loading before hydration attaches event handlers.
    if (!video) return;
    if (Number.isFinite(video.duration)) setDuration(video.duration);
    if (video.error) {
      setError(
        "This video could not be loaded. Try again or download the original.",
      );
    }
  }, []);
  const attachFrame = useCallback((frame: HTMLDivElement | null) => {
    frameRef.current = frame;
    if (frame)
      setSettingsContainer(
        frame.closest<HTMLElement>("[role=dialog]") ?? frame,
      );
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const update = () => {
      const frame = frameRef.current;
      const active = document.fullscreenElement === frame;
      setFullscreen(active);
      // Escape scroll clipping in admin dialogs, but stay inside browser fullscreen.
      setSettingsContainer(
        active
          ? frame
          : (frame?.closest<HTMLElement>("[role=dialog]") ?? frame),
      );
    };
    document.addEventListener("fullscreenchange", update);
    return () => {
      video?.pause();
      document.removeEventListener("fullscreenchange", update);
    };
  }, []);

  useEffect(() => {
    if (suspended) videoRef.current?.pause();
  }, [suspended]);

  async function play() {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    try {
      await video.play();
    } catch (cause) {
      // A handoff can unmount a player while its play promise is pending.
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(
        "Unable to play this video. Try again or download the original.",
      );
      setWaiting(false);
    }
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.error) video.load();
      void play();
    } else video.pause();
  }

  function seek(value: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, value));
    setTime(video.currentTime);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frameRef.current?.requestFullscreen();
    } catch {
      setError(
        "Fullscreen is unavailable. You can still watch in this viewer.",
      );
    }
  }

  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <div
      ref={attachFrame}
      role="group"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "@container relative flex min-h-0 min-w-0 flex-col bg-black text-white focus-visible:outline-2 focus-visible:outline-[#c6ff33]",
        fill && "h-full w-full",
        className,
      )}
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.closest("button, input, select, a")
        )
          return;
        switch (event.key.toLowerCase()) {
          case " ":
          case "k":
            event.preventDefault();
            togglePlay();
            break;
          case "arrowleft":
          case "arrowright":
            event.preventDefault();
            event.stopPropagation();
            seek(time + (event.key === "ArrowLeft" ? -10 : 10));
            break;
          case "m":
            event.preventDefault();
            if (videoRef.current) videoRef.current.muted = !muted;
            break;
        }
      }}
    >
      <div className={cn("relative min-h-0", fill ? "flex-1" : "aspect-video")}>
        <video
          ref={attachVideo}
          src={src}
          aria-label={label}
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-contain"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setDuration(Number.isFinite(video.duration) ? video.duration : 0);
            if (!restored.current) {
              restored.current = true;
              video.volume = initialPlayback?.volume ?? 1;
              video.muted = initialPlayback?.muted ?? false;
              video.playbackRate = initialPlayback?.rate ?? 1;
              if (initialPlayback) {
                seek(initialPlayback.time);
                if (initialPlayback.playing) void play();
              }
            }
          }}
          onDurationChange={(event) => {
            const value = event.currentTarget.duration;
            setDuration(Number.isFinite(value) ? value : 0);
          }}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onProgress={(event) => {
            const ranges = event.currentTarget.buffered;
            setBuffered(ranges.length ? ranges.end(ranges.length - 1) : 0);
          }}
          onPlay={() => {
            setPlaying(true);
            setEnded(false);
          }}
          onPause={() => {
            setPlaying(false);
            setWaiting(false);
          }}
          onPlaying={() => setWaiting(false)}
          onWaiting={() => setWaiting(true)}
          onCanPlay={() => setWaiting(false)}
          onSeeked={(event) => {
            setEnded(event.currentTarget.ended);
            setWaiting(false);
          }}
          onEnded={() => {
            setEnded(true);
            setPlaying(false);
          }}
          onError={() => {
            setError(
              "This video could not be loaded. Try again or download the original.",
            );
            setWaiting(false);
            setPlaying(false);
          }}
          onVolumeChange={(event) => {
            setMuted(event.currentTarget.muted);
            setVolume(event.currentTarget.volume);
          }}
          onRateChange={(event) => setRate(event.currentTarget.playbackRate)}
        />
        {waiting && !error && (
          <p
            role="status"
            className="absolute inset-0 grid place-items-center bg-black/40 text-sm"
          >
            Loading video…
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="absolute inset-0 grid place-items-center bg-black/80 p-5 text-center text-sm"
          >
            <p>{error}</p>
          </div>
        )}
      </div>
      <div className="relative shrink-0 border-t border-white/10 bg-black px-2">
        <div className="flex min-w-0 flex-wrap items-center @min-[360px]:gap-1">
          <button
            type="button"
            className={control}
            onClick={togglePlay}
            aria-label={ended ? "Replay" : playing ? "Pause" : "Play"}
          >
            {ended ? (
              <RotateCcw className="size-4" />
            ) : playing ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </button>
          <div className="relative order-first flex h-11 min-w-8 flex-1 basis-full items-center @min-[360px]:order-none @min-[360px]:basis-auto">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 h-1 bg-white/15"
            >
              <div
                className="absolute h-full bg-white/30"
                style={{
                  width: `${duration ? (buffered / duration) * 100 : 0}%`,
                }}
              />
              <div
                className="absolute h-full bg-[#c6ff33]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <input
              aria-label="Seek"
              aria-valuetext={`${timestamp(time)} of ${timestamp(duration)}`}
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={time}
              disabled={!duration}
              onChange={(event) => seek(Number(event.target.value))}
              className="relative h-11 w-full cursor-pointer accent-[#c6ff33] opacity-0 hover:opacity-100 focus-visible:opacity-100"
            />
          </div>
          <span className="shrink-0 px-1 text-[11px] tabular-nums" aria-hidden>
            {timestamp(time)} / {timestamp(duration)}
          </span>
          <button
            type="button"
            className={control}
            aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              if (video.volume === 0) video.volume = 1;
              video.muted = !(muted || volume === 0);
            }}
          >
            {muted || volume === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </button>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={control}
                aria-label="Video settings"
              >
                <MoreHorizontal className="size-5" />
              </button>
            </Popover.Trigger>
            <Popover.Portal container={settingsContainer}>
              <Popover.Content
                side="top"
                align="end"
                sideOffset={8}
                className="z-20 w-60 space-y-4 border border-white/20 bg-black p-4 text-sm text-white shadow-xl"
              >
                <label className="flex items-center justify-between gap-3">
                  Speed
                  <select
                    aria-label="Playback speed"
                    value={rate}
                    onChange={(event) => {
                      if (videoRef.current)
                        videoRef.current.playbackRate = Number(
                          event.target.value,
                        );
                    }}
                    className="h-9 border border-white/20 bg-black px-2 text-white focus-visible:outline-[#c6ff33]"
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                      <option key={speed} value={speed}>
                        {speed}×
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3">
                  Volume
                  <input
                    aria-label="Volume"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(event) => {
                      const video = videoRef.current;
                      if (!video) return;
                      video.volume = Number(event.target.value);
                      video.muted = false;
                    }}
                    className="h-9 w-28 accent-[#c6ff33]"
                  />
                </label>
                <div className="flex justify-between border-t border-white/15 pt-2">
                  <button
                    type="button"
                    className="flex min-h-11 items-center gap-2"
                    disabled={!duration}
                    onClick={() => seek(time - 10)}
                    aria-label="Back 10 seconds"
                  >
                    <SkipBack className="size-4" />
                    10s
                  </button>
                  <button
                    type="button"
                    className="flex min-h-11 items-center gap-2"
                    disabled={!duration}
                    onClick={() => seek(time + 10)}
                    aria-label="Forward 10 seconds"
                  >
                    10s
                    <SkipForward className="size-4" />
                  </button>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          {onExpand ? (
            <button
              type="button"
              className={cn(control, "w-auto gap-2 px-2")}
              aria-label="View larger"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                const playback = {
                  time: video.currentTime,
                  playing: !video.paused,
                  muted: video.muted,
                  volume: video.volume,
                  rate: video.playbackRate,
                };
                video.pause();
                onExpand(playback);
              }}
            >
              <Expand className="size-4" />
              <span className="hidden text-xs @min-[440px]:inline">
                View larger
              </span>
            </button>
          ) : canFullscreen ? (
            <button
              type="button"
              className={control}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => void toggleFullscreen()}
            >
              {fullscreen ? (
                <Minimize className="size-4" />
              ) : (
                <Maximize className="size-4" />
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
