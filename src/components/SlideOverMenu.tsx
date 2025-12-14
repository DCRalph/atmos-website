import Link from "next/link"
import Image from "next/image"

type MenuItem = {
  label: string;
  href: string;
  color: string;
};

const MENU_ITEMS: MenuItem[] = [
  { label: "HOME", href: "/", color: "bg-blue-500" },
  { label: "ABOUT", href: "/about", color: "bg-red-500" },
  { label: "SHOP", href: "/merch", color: "bg-pink-500" },
  { label: "GIGS", href: "/gigs", color: "bg-lime-500" },
  { label: "THE CREW", href: "/crew", color: "bg-cyan-500" },
  { label: "CONTACT US", href: "/contact", color: "bg-gray-400" },
];

interface SlideOverMenuProps {
  setIsMenuOpen: (isOpen: boolean) => void;
  isMobile: boolean;
}

export default function SlideOverMenu({ setIsMenuOpen, isMobile }: SlideOverMenuProps) {


  return (
    <div className={`flex flex-col z-50 h-dvh w-64 bg-black/90 border-r border-white/10 sticky top-0 left-0`}>
      {/* Logo at top */}
      <div className="flex justify-center items-center px-4 my-8">
        <div className="relative w-full h-16">
          <Image
            src="/logo/atmos-white.png"
            alt="Atmos Logo"
            fill
            preload
            className="object-contain"
          />
        </div>
      </div>

      {/* Menu buttons */}
      <div className="flex flex-col flex-1 gap-1">
        {MENU_ITEMS.map((item, idx) => (
          <MenuItemComponent item={item} idx={idx} key={item.label} />
        ))}
      </div>
    </div>
  )
}

function MenuItemComponent({ item, idx }: { item: MenuItem, idx: number }) {
  // Deterministic "random" value based on idx
  const width = ((idx * 37 + 17) % 51) + 50;
  const hoverWidth = width * 1.2;

  return (
    <Link
      key={item.label}
      href={item.href}
      className={`bg-red-600 text-white uppercase font-light text-lg py-2 pl-8 hover:font-semibold hover:opacity-90 transition-all tracking-wide`}
      style={{
        width: `${width}%`,
        ['--hover-width' as string]: `${hoverWidth}%`
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.width = `${hoverWidth}%`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.width = `${width}%`;
      }}
    >
      {item.label}
    </Link>
  )
}