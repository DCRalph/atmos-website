import Image from "next/image";

export function TopRightBadge({ className = "" }: { className?: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Atmos badge"
      className={`relative h-10 w-32 cursor-pointer transition-transform duration-200 outline-none select-none hover:scale-125 ${className}`}
    >
      <Image
        src="/logo/atmos-white.png"
        alt="Atmos Logo"
        fill
        className="object-contain"
        sizes="(max-width: 640px) 10rem, 12rem"
      />
    </div>
  );
}
