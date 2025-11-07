"use client";

export function VideoBackground({ underground = false }: { underground?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="relative h-dvh w-full">
        <video
          autoPlay
          loop
          muted
          playsInline
          className={`h-full w-full object-cover ${underground ? "opacity-60" : "opacity-100"}`}
        >
          <source src="/home/atmos-home.mp4" type="video/mp4" />
        </video>
        {underground ? (
          <>
            {/* Darker overlay with red tint for underground feel */}
            <div className="absolute inset-0 bg-black/70" />
            <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 via-transparent to-red-950/20" />
            {/* Additional darkening for more exclusive feel */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-black/50" />
        )}
      </div>
    </div>
  );
}
