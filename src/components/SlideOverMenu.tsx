"use client";

import Link from "next/link"
import Image from "next/image"
import { orbitron } from "~/lib/fonts"
import { useState } from "react";
import { usePathname } from "next/navigation";

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
  { label: "SOCIALS", href: "/socials", color: "bg-green-500" },
];

interface SlideOverMenuProps {
  setIsMenuOpen: (isOpen: boolean) => void;
  isHomePage?: boolean;
}

export default function SlideOverMenu({ setIsMenuOpen, isHomePage = false }: SlideOverMenuProps) {

  return (
    <div className={`flex flex-col z-50 h-dvh w-64 bg-black ${isHomePage ? "sticky top-0 left-0" : "fixed top-0 left-0"}`}>

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
      <div className={`flex flex-col flex-1 gap-1 ${orbitron.className}`}>
        {MENU_ITEMS.map((item, idx) => (
          <MenuItemComponent item={item} idx={idx} key={item.label} />
        ))}
      </div>
    </div>
  )
}

const getWidth = (idx: number) => {
  const widths: number[] = [78, 67, 52, 77, 89, 97];
  return widths[idx % widths.length]!;
}

function MenuItemComponent({ item, idx }: { item: MenuItem, idx: number }) {
  // Deterministic "random" value based on idx
  const width = getWidth(idx);
  const hoverWidth = width * 1.2;

  const pathname = usePathname();

  const isActive =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <Link
      key={item.label}
      href={item.href}
      className={`${isActive ? "pl-10 font-bold!" : ""} bg-red-600 text-white uppercase font-light text-lg py-2 pl-8 tracking-wider hover:font-bold hover:opacity-90 transition-all hover:tracking-widest`}
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