"use client";

import Image from "next/image";

type StaticBackgroundProps = {
  imageSrc: string;
};

export function StaticBackground({ imageSrc }: StaticBackgroundProps) {
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="relative h-full w-full">
        <Image
          src={imageSrc}
          alt="Background"
          fill
          className="object-cover"
          preload={true}
          quality={90}
        />
        {/* Optional overlay to darken/tint the image */}
        <div className="absolute inset-0 bg-black/50" />
      </div>
    </div>
  );
}
