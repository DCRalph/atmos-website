import Image from "next/image";

export function TopRightBadge({ className = "" }: { className?: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Atmos badge"
      className={`relative h-10 w-32 cursor-pointer select-none outline-none transition-transform duration-200 hover:scale-125 ${className}`}
    >
      <Image
        src="/logo/atmos-white.png"
        alt="Atmos Logo"
        fill
        className="object-contain"
      />
    </div>
  );
}


