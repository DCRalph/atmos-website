"use client";

import Image from "next/image";

export function SimpleLogo() {
  return (
    <div className="relative w-full aspect-4/1">
      <Image
        src="/logo/atmos-white.png"
        alt="Atmos Logo"
        fill
        className="object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]"
        sizes="100vw"
      />
    </div>
  );
}

