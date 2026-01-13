"use client";

import Link from "next/link"
import Image from "next/image"
import { orbitron } from "~/lib/fonts"
import { usePathname } from "next/navigation";
import { useIsMobile } from "~/hooks/use-mobile";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { MobileMenuPortal, useMobileMenu } from "~/components/mobile-menu-provider";
import { cn } from "~/lib/utils";

type MenuItem = {
  label: string;
  href: string;
  color: string;
};

const MENU_ITEMS: MenuItem[] = [
  { label: "HOME", href: "/", color: "#dd0000" },
  { label: "ABOUT", href: "/about", color: "#00dd00" },
  { label: "SHOP", href: "/merch", color: "#0000ff" },
  { label: "GIGS", href: "/gigs", color: "#ff6a00" },
  { label: "THE CREW", href: "/crew", color: "#ff00ff" },
  { label: "CONTACT US", href: "/contact", color: "#00ffff" },
  { label: "SOCIALS", href: "/socials", color: "#ff00ff" },
];

const USE_MENU_COLORS = false;

const MotionLink = motion.create(Link);
const MotionButton = motion.create(Button);

interface SlideOverMenuProps {
  isHomePage?: boolean;
}

export default function SlideOverMenu({ isHomePage = false }: SlideOverMenuProps) {
  const isMobile = useIsMobile();

  // On mobile, render through the portal
  if (isMobile) {
    return (
      <MobileMenuPortal>
        <SlideOverMenuContent isHomePage={isHomePage} isMobile={true} />
      </MobileMenuPortal>
    );
  }

  // On desktop, render normally
  return <SlideOverMenuContent isHomePage={isHomePage} isMobile={false} />;
}

interface SlideOverMenuContentProps {
  isHomePage?: boolean;
  isMobile: boolean;
}

function SlideOverMenuContent({ isHomePage = false, isMobile }: SlideOverMenuContentProps) {
  const { setIsMenuOpen } = useMobileMenu();

  // On mobile, wrap in backdrop overlay
  if (isMobile) {
    return (
      <div
        className="fixed inset-0"
        onClick={() => setIsMenuOpen(false)}
      >

        {/* Menu content */}
        <div
          className={cn(
            "flex flex-col absolute right-0 z-10 h-dvh w-64 items-end",
          )}
        >
          {renderMenuContent(isHomePage, isMobile, setIsMenuOpen)}
        </div>
      </div>
    );
  }

  // Desktop rendering (unchanged)
  return (
    // bg-zinc-100 dark:bg-zinc-950 border-r border-black/10 dark:border-white/10
    <div
      className={cn(
        "flex flex-col z-50 h-dvh w-64",
        "fixed top-0", // other pages on desktop
        isHomePage && "sticky", // Home page on desktop
      )}
    >
      {renderMenuContent(isHomePage, isMobile, setIsMenuOpen)}
    </div>
  );
}

function renderMenuContent(isHomePage: boolean, isMobile: boolean, setIsMenuOpen: (open: boolean) => void) {
  return (
    <>
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
            {/* <MotionButton
              className="text-lg uppercase group w-min cursor-pointer m-4 ease-out"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
              }}

              transition={{
                duration: 0.4,
                ease: "anticipate",
              }}

              variants={{
                hidden: {
                  // opacity: 0,
                  x: isMobile ? "150%" : "-150%",
                  y: "-150%",
                },
                visible: {
                  // opacity: 1,
                  x: 0,
                  y: 0,
                },
              }}

              initial="hidden"
              animate="visible"
              exit="hidden"

            >
              <X />
              Close
            </MotionButton> */}

            {/* <div className="fixed z-500 bottom-4 right-4 size-12 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-full hover:bg-white/75 dark:hover:bg-black/75 transition-colors border border-black/10 dark:border-white/10">
              <button
                className="text-lg uppercase text-black dark:text-white group"
                onClick={() => setIsMenuOpen(false)}
              >
                <X />
              </button>
            </div> */}

            {/* centered logo */}
            {/* <motion.div className="p-4 w-screen h-36"


              transition={{ duration: 0.6, ease: "anticipate" }}

              variants={{
                hidden: {
                  //  opacity: 1,
                  y: "-150%"
                },
                visible: {
                  //  opacity: 1,
                  y: 0
                },
              }}

              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <div className="relative w-full h-full">
                <Image
                  src="/logo/atmos-white.png"
                  alt="Atmos Logo"
                  fill
                  preload
                  className="object-contain dark:block hidden"
                  sizes="50vw"
                />
                <Image
                  src="/logo/atmos-black.png"
                  alt="Atmos Logo"
                  fill
                  preload
                  className="object-contain dark:hidden block"
                  sizes="50vw"
                />
              </div>
            </motion.div> */}


          </>
        )}



      <div
        // className={`flex flex-col ${isMobile ? "justify-center" : "justify-start"} flex-1 gap-1 mt-2 ${orbitron.className} ${isMobile ? "mt-16" : "mt-2"}`}
        className={cn(
          "flex flex-col flex-1 gap-1",
          orbitron.className,
          !isMobile && "mt-2",
          isMobile && "items-end mb-24 justify-end",
        )}
      >
        {MENU_ITEMS.map((item, idx) => {
          const index = isMobile ? MENU_ITEMS.length - idx - 1 : idx;
          const width = getWidth(idx, isMobile);
          return (
            <MenuItemComponent closeMenu={() => setIsMenuOpen(false)} item={item} idx={index} key={item.label + "outer"} isMobile={isMobile} width={width} />
          )
        })}
      </div>
    </>
  );
}

const getWidth = (idx: number, isMobile: boolean) => {
  const widths: number[] = [78, 67, 58, 73, 89, 97];
  let w = widths[idx % widths.length]!;
  if (isMobile) {
    w += 20;
  }
  return w;
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1]!, 16),
      g: parseInt(result[2]!, 16),
      b: parseInt(result[3]!, 16),
    }
    : null;
};


function MenuItemComponent({
  closeMenu,
  item,
  idx,
  width,
  isMobile,
}: {
  closeMenu: () => void;
  item: MenuItem;
  idx: number;
  width: number;
  isMobile: boolean;
}) {
  // const width = getWidth(idx, isMobile);
  const hoverWidth = width * 1.2;

  const pathname = usePathname();
  const isActive =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(item.href + "/");

  const uniqueId = `menu-item-${idx}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .${uniqueId}:hover {
            width: var(--hover-width) !important;
          }
        `
      }} />
      <MotionLink
        key={item.label}
        href={item.href}
        className={cn(
          uniqueId,
          "relative text-white uppercase font-light flex items-center text-2xl h-14 tracking-wider hover:font-bold group transition-all ease-out hover:tracking-widest text-nowrap",
          isActive && "font-bold!",
          !USE_MENU_COLORS && "bg-accent-strong hover:bg-accent-muted",
          USE_MENU_COLORS && "hover:brightness-90",
          !isMobile && "pl-8",
          isMobile && "justify-end h-8 pr-8 text-xl"
        )}

        style={{
          width: `${width}%`,
          backgroundColor: USE_MENU_COLORS ? item.color : undefined,
          "--hover-width": `${hoverWidth}%`,
        } as React.CSSProperties & { "--hover-width": string }}

        transition={{
          duration: 0.4,
          ease: "anticipate",
          delay: (idx + 1) * 0.05,
        }}

        variants={{
          hidden: {
            // opacity: 0.8,
            x: isMobile ? "100%" : "-100%",
          },
          visible: {
            // opacity: 1,
            x: 0,
          },
        }}

        initial="hidden"
        animate="visible"
        exit="hidden"

        onClick={(e) => {
          e.stopPropagation();
          closeMenu();
        }}
      >
        {/* <div
          className={cn("absolute h-14 w-32 right-full top-0", !USE_MENU_COLORS && "bg-accent-strong")}
          style={USE_MENU_COLORS ? { backgroundColor: item.color } : undefined}
        /> */}

        {isMobile && (
          <div
            className={cn(
              "absolute h-14 w-32 left-full top-0", !USE_MENU_COLORS && "bg-accent-strong",
              isMobile && "h-8",
              // "bg-blue-500"
            )}
            style={USE_MENU_COLORS ? { backgroundColor: item.color } : undefined}
          />
        )}
        {/* <div className="absolute h-14 w-14 left-[calc(100%+4px)] top-0 bg-white transition-all opacity-0 group-hover:opacity-100" /> */}

        {item.label}
      </MotionLink >
    </>
  );
}