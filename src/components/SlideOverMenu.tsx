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
};

const MENU_ITEMS: MenuItem[] = [
  { label: "HOME", href: "/" },
  { label: "GIGS", href: "/gigs" },
  { label: "CONTENT", href: "/content" },
  { label: "ABOUT", href: "/about" },
  { label: "MERCH", href: "/merch" },
  { label: "SOCIALS", href: "/socials" },
  { label: "THE CREW", href: "/crew" },
  { label: "CONTACT US", href: "/contact" },
];

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
      <div className="h-screen flex flex-col">
        {/* Logo at top */}
        {!isMobile &&
          (
            <div className="flex justify-center items-center px-4 mt-8">
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


        <div className="flex flex-col flex-1 justify-around">

          <div
            className={cn(
              "flex flex-col  gap-1.5",
              orbitron.className,
              !isMobile && "",
              isMobile && "items-end justify-end",
            )}
          >
            {MENU_ITEMS.map((item, idx) => {
              const index = isMobile ? MENU_ITEMS.length - idx - 1 : idx;
              return (
                <MenuItemComponent closeMenu={() => setIsMenuOpen(false)} item={item} idx={index} key={item.label + "outer"} isMobile={isMobile} />
              )
            })}
          </div>
        </div>

      </div>
    </>
  );
}


function MenuItemComponent({
  closeMenu,
  item,
  idx,
  // width,
  isMobile,
}: {
  closeMenu: () => void;
  item: MenuItem;
  idx: number;
  isMobile: boolean;
}) {

  const pathname = usePathname();
  const isActive =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(item.href + "/");

  const uniqueId = `menu-item-${idx}`;

  return (
    <>
      <MotionLink
        key={item.label}
        href={item.href}
        className={cn(
          uniqueId,
          "relative text-white uppercase font-light flex w-fit items-center tracking-wider hover:font-bold group transition-all ease-out hover:tracking-widest text-nowrap",
          isActive && "font-bold!",
          "bg-linear-to-r from-accent-strong via-65% via-accent-strong to-transparent",
          "h-8 text-xl md:h-8 md:text-xl",
          !isMobile && "pl-8 pr-10 hover:pr-20",
          isMobile && "justify-end pr-4 pl-8 hover:pl-16 bg-linear-to-l to-transparent",
          // "shadow-glass"
        )}

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
              "absolute  w-32 left-full top-0 bg-accent-strong",
              "h-8 md:h-14",
              // "bg-blue-500"
            )}
          />
        )}
        {/* <div className="absolute h-14 w-14 left-[calc(100%+4px)] top-0 bg-white transition-all opacity-0 group-hover:opacity-100" /> */}

        {item.label}
      </MotionLink >
    </>
  );
}