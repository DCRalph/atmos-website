"use client";

import Link from "next/link"
import Image from "next/image"
import { orbitron } from "~/lib/fonts"
import { usePathname } from "next/navigation";
import { SocialLinks } from "~/components/social-links";
import { useIsMobile } from "~/hooks/use-mobile";
import { motion, type Variants } from "motion/react";
import { X } from "lucide-react";
import { Button } from "~/components/ui/button";

type MenuItem = {
  label: string;
  href: string;
  color: string;
};

const MENU_ITEMS: MenuItem[] = [
  { label: "HOME", href: "/", color: "bg-blue-500" },
  { label: "ABOUT", href: "/about", color: "bg-blue-500" },
  { label: "SHOP", href: "/merch", color: "bg-pink-500" },
  { label: "GIGS", href: "/gigs", color: "bg-lime-500" },
  { label: "THE CREW", href: "/crew", color: "bg-cyan-500" },
  { label: "CONTACT US", href: "/contact", color: "bg-gray-400" },
  { label: "SOCIALS", href: "/socials", color: "bg-green-500" },
];

const MotionLink = motion(Link);
const MotionButton = motion(Button);

interface SlideOverMenuProps {
  setIsMenuOpen: (isOpen: boolean) => void;
  isHomePage?: boolean;
  // isOpen: boolean;
}

export default function SlideOverMenu({ setIsMenuOpen, isHomePage = false }: SlideOverMenuProps) {
  const isMobile = useIsMobile();

  return (
    // bg-zinc-100 dark:bg-zinc-950 border-r border-black/10 dark:border-white/10
    <div className={`flex flex-col z-50 h-dvh w-64 ${isHomePage ? "sticky top-0 left-0" : "fixed top-0 left-0"}`}>

      {/* <SocialLinks /> */}


      {/* Logo at top */}
      {!isMobile &&
        (
          <div className="flex justify-center items-center px-4 mt-8 mb-6">
            <div className="relative w-full h-16">
              <Image
                src="/logo/atmos-white.png"
                alt="Atmos Logo"
                fill
                preload
                className="object-contain dark:block hidden"
                sizes="(max-width: 640px) 10rem, 12rem"
              />
              <Image
                src="/logo/atmos-black.png"
                alt="Atmos Logo"
                fill
                preload
                className="object-contain dark:hidden block"
                sizes="(max-width: 640px) 10rem, 12rem"
              />
            </div>
          </div>
        )}


      {
        isMobile && (
          <>
            <MotionButton
              className="text-lg uppercase group w-min my-4 mx-4 cursor-pointer absolute top-0 left-0 ease-out"
              onClick={() => setIsMenuOpen(false)}

              transition={{
                duration: 0.3,
                ease: "easeOut",
              }}

              variants={{
                hidden: {
                  opacity: 0,
                  x: "-100%",
                  y: "-100%",
                },
                visible: {
                  opacity: 1,
                  x: 0,
                  y: 0,
                },
              }}

              initial="hidden"
              animate="visible"
              exit="hidden"

            >
              <X />
              Menu
            </MotionButton>

            {/* centered logo */}
            <motion.div className="absolute top-24 left-[50vw] -translate-x-1/2 w-[80vw] h-24"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: { opacity: 0, y: "-100%" },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="relative w-full h-full">
                <Image
                  src="/logo/atmos-white.png"
                  alt="Atmos Logo"
                  fill
                  preload
                  className="object-contain dark:block hidden"
                  sizes="(max-width: 640px) 10rem, 12rem"
                />
                <Image
                  src="/logo/atmos-black.png"
                  alt="Atmos Logo"
                  fill
                  preload
                  className="object-contain dark:hidden block"
                  sizes="(max-width: 640px) 10rem, 12rem"
                />
              </div>
            </motion.div>


          </>
        )}





      <div
        className={`flex flex-col ${isMobile ? "justify-center" : "justify-start"} flex-1 gap-1 mt-2 ${orbitron.className} ${isMobile ? "mt-16" : "mt-2"}`}
      >
        {
          MENU_ITEMS.map((item, idx) => (
            <MenuItemComponent closeMenu={() => setIsMenuOpen(false)} item={item} idx={idx} key={item.label} isMobile={isMobile} />
          ))
        }
      </div>

      {/* <SocialLinks side="right" /> */}

    </div>
  )
}

const getWidth = (idx: number, isMobile: boolean) => {
  const widths: number[] = [78, 67, 58, 73, 89, 97];
  let w = widths[idx % widths.length]!;
  if (isMobile) {
    w += 20;
  }
  return w;
}


function MenuItemComponent({
  closeMenu,
  item,
  idx,
  isMobile,
}: {
  closeMenu: () => void;
  item: MenuItem;
  idx: number;
  isMobile: boolean;
}) {
  const width = getWidth(idx, isMobile);
  const hoverWidth = width * 1.2;

  const pathname = usePathname();
  const isActive =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <MotionLink
      key={item.label}
      href={item.href}
      className={`${isActive ? "pl-10 font-bold!" : ""
        } bg-accent text-white uppercase font-light text-2xl py-3 pl-8 tracking-wider hover:font-bold hover:bg-accent-muted transition-all ease-out hover:tracking-widest`}

      style={{
        width: `${width}%`,
        ["--hover-width" as string]: `${hoverWidth}%`,
      }}

      transition={{
        duration: 0.3,
        ease: "easeOut",
        delay: (idx + 1) * 0.05,
      }}

      variants={{
        hidden: {
          opacity: 0,
          x: "-100%",
        },
        visible: {
          opacity: 1,
          x: 0,
        },
      }}

      initial="hidden"
      animate="visible"
      exit="hidden"

      onMouseEnter={(e) => {
        e.currentTarget.style.width = `${hoverWidth}%`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.width = `${width}%`;
      }}

      onClick={closeMenu}
    >
      {item.label}
    </MotionLink >
  );
}