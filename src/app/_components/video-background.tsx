"use client";

export function VideoBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="relative h-full w-full">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
        >
          <source src="/home/atmos-home.mp4" type="video/mp4" />
        </video>
        {/* Optional overlay to darken/tint the video */}
        <div className="absolute inset-0 bg-black/50" />
      </div>
    </div>
  );
}
