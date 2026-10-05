"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, Menu, ShoppingBag, User, X } from "lucide-react";
import {
  FaInstagram,
  FaSoundcloud,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import { api } from "~/trpc/react";
import { authClient } from "~/lib/auth-client";
import { SOCIALS } from "~/lib/site-constants";
import { cn } from "~/lib/utils";
import { useMerchCart } from "~/components/merch/merch-cart-provider";
import { GradientBlur } from "~/components/gradient-blur";
import {
  HERO_ROUTES,
  HERO_ROUTE_PREFIXES,
  primaryNav,
  secondaryNav,
} from "./nav";
import { useSite } from "./site-provider";
import { AtmosLogo, IconButton } from "./ui";

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

function CartButton({ className }: { className: string }) {
  const { totalQuantity } = useMerchCart();
  const { setCartOpen } = useSite();
  return (
    <button
      type="button"
      onClick={() => setCartOpen(true)}
      aria-label={`Cart, ${totalQuantity} ${totalQuantity === 1 ? "item" : "items"}`}
      className={cn(
        "relative inline-flex size-11 items-center justify-center rounded-full",
        className,
      )}
    >
      <ShoppingBag className="size-5" />
      {totalQuantity ? (
        <span
          key={totalQuantity}
          className="animate-in zoom-in-50 absolute top-1 right-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--site-accent)] text-[9px] font-bold text-[var(--site-accent-ink)] tabular-nums duration-200"
        >
          {totalQuantity > 9 ? "9+" : totalQuantity}
        </span>
      ) : null}
    </button>
  );
}

const menuItem =
  "t-label flex h-11 cursor-default items-center gap-3 rounded-[10px] px-3 text-[11px] text-white/80 outline-none select-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white";

/** Signed-in account menu: the same destinations the old user indicator had. */
function AccountMenu({ className }: { className: string }) {
  const router = useRouter();
  const utils = api.useUtils();
  const { portalContainer } = useSite();
  const { data: user } = api.user.me.useQuery();
  if (!user) return null;

  const signOut = () =>
    authClient.signOut({
      fetchOptions: {
        onSuccess: async () => {
          await utils.user.me.invalidate();
          router.refresh();
        },
      },
    });

  const links = [
    { label: "Dashboard", href: "/dashboard", show: true },
    {
      label: "Event analytics",
      href: "/organiser/events",
      show: user.effectivePermissions.includes("EVENT_ORGANISER"),
    },
    {
      label: "Door scanner",
      href: "/door",
      show: user.effectivePermissions.includes("EVENT_ORGANISER"),
    },
    {
      label: "Admin panel",
      href: "/admin",
      show: user.effectivePermissions.includes("ADMIN"),
    },
  ].filter((l) => l.show);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Account"
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full outline-none",
            className,
          )}
        >
          <User className="size-5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalContainer}>
        <DropdownMenu.Content
          sideOffset={8}
          align="end"
          className="glass-dark glass-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-[90] min-w-60 rounded-[var(--site-r-panel)] rounded-tr-none p-1.5"
        >
          <DropdownMenu.Label className="px-3 pt-2 pb-3">
            <span className="block truncate text-[14px]">
              {user.name ?? "Signed in"}
            </span>
            {user.email ? (
              <span className="mt-0.5 block truncate text-[12px] text-white/55">
                {user.email}
              </span>
            ) : null}
          </DropdownMenu.Label>
          {links.map((l) => (
            <DropdownMenu.Item key={l.href} asChild className={menuItem}>
              <Link href={l.href}>{l.label}</Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1.5 h-px bg-white/10" />
          <DropdownMenu.Item
            className={cn(menuItem, "text-[var(--site-danger-text)]")}
            onSelect={() => void signOut()}
          >
            <LogOut className="size-4" /> Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const menuSocials = [
  { ...SOCIALS.instagram, Icon: FaInstagram },
  { ...SOCIALS.tiktok, Icon: FaTiktok },
  { ...SOCIALS.youtube, Icon: FaYoutube },
  { ...SOCIALS.soundcloud, Icon: FaSoundcloud },
];

// Link slide timing, shared by entry and exit so they mirror each other.
const LINK_MS = 320;
const LINK_STAGGER_MS = 35;
// How long the veil takes to blur in or clear. Keep in step with site.css.
const VEIL_MS = 480;

/**
 * Full-screen phone menu: the page blurs behind it, links go huge. `closing`
 * plays the exit (links slide back out, the veil fades) before unmount.
 */
const menuLinkCount = 1 + primaryNav.length + secondaryNav.length;

function MobileMenu({
  pathname,
  closing,
  onClose,
}: {
  pathname: string;
  closing: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const links = [{ label: "Home", href: "/" }, ...primaryNav, ...secondaryNav];

  return (
    // No animation on this wrapper: tw-animate keyframes set `filter`, and a
    // filtered ancestor stops the backdrop blur below from seeing the page.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-[65]"
    >
      {/* The blur itself ramps up and back down, the page going in and out of focus. */}
      <div
        className={cn(
          "absolute inset-0",
          closing ? "site-veil-out" : "site-veil-in",
        )}
      />
      {/* A tap anywhere that isn't a link or button closes the menu. */}
      <div
        className={cn(
          "relative flex h-full flex-col",
          closing ? "site-fade-out" : "site-fade-in",
        )}
        onClick={(e) => {
          if (e.target instanceof Element && !e.target.closest("a, button")) {
            onClose();
          }
        }}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/" onClick={onClose} aria-label="Atmos home">
            <AtmosLogo className="w-24" />
          </Link>
          <IconButton label="Close menu" onClick={onClose} autoFocus>
            <X className="size-5" />
          </IconButton>
        </div>
        <nav aria-label="Main" className="mt-4 flex-1 overflow-y-auto px-5">
          <ul>
            {links.map((l, i) => {
              const active =
                l.href === "/" ? pathname === "/" : isActive(pathname, l.href);
              return (
                <li
                  key={l.href}
                  className={cn(
                    "fill-mode-both py-1.5",
                    closing
                      ? "animate-out fade-out-0 slide-out-to-left-6"
                      : "animate-in fade-in-0 slide-in-from-left-6",
                  )}
                  // Same slide both ways: in top-down, back out bottom-up.
                  style={{
                    animationDuration: `${LINK_MS}ms`,
                    animationDelay: `${(closing ? links.length - 1 - i : i) * LINK_STAGGER_MS}ms`,
                  }}
                >
                  <Link
                    href={l.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      // Hit area is the word itself, not the whole row.
                      "t-display inline-block text-[2rem]",
                      active ? "text-[var(--site-accent-text)]" : "text-white",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex justify-between px-3 pt-4 pb-6">
          {menuSocials.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex size-16 items-center justify-center text-white/75 hover:text-white"
            >
              <Icon className="size-8" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Header ink per tone: `light` is for pages on a light ground (some creator themes). */
const headerInk = {
  dark: {
    link: "text-white/70 hover:text-white",
    active: "text-white",
    icon: "text-white/80 hover:text-white",
  },
  light: {
    link: "text-black/65 hover:text-black",
    active: "text-black",
    icon: "text-black/75 hover:text-black",
  },
} as const;

/**
 * Public site header. A progressive blur fades down behind it, so it reads
 * over any page without a flat background. Below `lg` the links move into a
 * full-screen menu.
 */
export function SiteHeader({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const ink = headerInk[tone];
  const pathname = usePathname();
  const [menu, setMenu] = useState<"closed" | "open" | "closing">("closed");

  const closeMenu = () => {
    // Taps during the exit animation shouldn't restart it.
    if (menu !== "open") return;
    setMenu("closing");
    setTimeout(
      () => setMenu("closed"),
      Math.max(VEIL_MS, (menuLinkCount - 1) * LINK_STAGGER_MS + LINK_MS),
    );
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 isolate z-40 flex h-16 items-center gap-8 px-5 md:h-20 md:px-10">
        {/* Blur strongest at the top edge, gone a little below the bar. */}
        <GradientBlur
          direction="to-bottom"
          className="absolute inset-0 -bottom-14 -z-10 rotate-180"
        />
        <Link href="/" aria-label="Atmos home">
          <AtmosLogo className="w-24 md:w-28" tone={tone} />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex gap-7">
            {primaryNav.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "t-label relative text-[11px] transition-colors",
                      active
                        ? `${ink.active} after:absolute after:inset-x-0 after:-bottom-2 after:h-0.5 after:bg-[var(--site-accent)]`
                        : ink.link,
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <AccountMenu className={ink.icon} />
          <CartButton className={ink.icon} />
          <IconButton
            label="Open menu"
            onClick={() => setMenu("open")}
            className={cn("ml-1 lg:hidden", tone === "light" && "text-black")}
          >
            <Menu className="size-5" />
          </IconButton>
        </div>
      </header>
      {menu !== "closed" ? (
        <MobileMenu
          pathname={pathname}
          closing={menu === "closing"}
          onClose={closeMenu}
        />
      ) : null}
    </>
  );
}

/** Whether the current route opens on a full-bleed hero (no top padding needed). */
export const useHeroRoute = () => {
  const pathname = usePathname();
  return (
    HERO_ROUTES.includes(pathname) ||
    HERO_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
};
