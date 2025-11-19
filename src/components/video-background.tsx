"use client";

export function VideoBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none opacity-50">
      <div className="relative h-dvh w-full">
        <video
          autoPlay
          loop
          muted
          playsInline
          className={`h-full w-full object-cover opacity-100`}
        >
          <source src="/home/atmos-home.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/50" />
      </div>
    </div>
  );
}
