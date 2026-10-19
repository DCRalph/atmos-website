"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
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
          className="animate-in zoom-in-50 bg-site-accent text-site-accent-ink absolute top-1 right-0.5 flex size-4 items-center justify-center rounded-full text-[9px] font-bold tabular-nums duration-200"
        >
          {totalQuantity > 9 ? "9+" : totalQuantity}
        </span>
      ) : null}
    </button>
  );
}

const accountRoles = [
  { permission: "SUPERADMIN", label: "Superadmin" },
  { permission: "ADMIN", label: "Admin" },
  { permission: "EVENT_ORGANISER", label: "Event organiser" },
  { permission: "ARTIST", label: "Artist" },
] as const;

/** Mirrors the main menu, with personal links first and account details below. */
function AccountMenu({ className }: { className: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const utils = api.useUtils();
  const { portalContainer } = useSite();
  const { data: user } = api.user.me.useQuery();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const role =
    accountRoles.find(({ permission }) =>
      user.effectivePermissions.includes(permission),
    )?.label ?? "Member";

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
    { label: "Account", href: "/dashboard/account", show: true },
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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
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
      </Dialog.Trigger>
      <Dialog.Portal container={portalContainer}>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[65]",
            open ? "site-veil-in" : "site-veil-out",
          )}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-0 z-[66] flex h-dvh flex-col text-right text-white outline-none",
            open ? "site-fade-in" : "site-fade-out",
          )}
          onClick={(event) => {
            if (
              event.target instanceof Element &&
              !event.target.closest("a, button, [data-account-details]")
            ) {
              setOpen(false);
            }
          }}
        >
          <Dialog.Title className="sr-only">Account menu</Dialog.Title>
          <div className="flex h-16 shrink-0 items-center justify-between px-5 md:h-20 md:px-10">
            <Dialog.Close asChild>
              <IconButton label="Close account menu">
                <X className="size-5" />
              </IconButton>
            </Dialog.Close>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              aria-label="Atmos home"
            >
              <AtmosLogo className="w-24 md:w-28" />
            </Link>
          </div>
          <nav
            aria-label="Account"
            className="mt-4 min-h-0 flex-1 overflow-y-auto px-5 md:px-10"
          >
            <ul>
              {links.map((link, i) => {
                const active =
                  link.href === "/dashboard"
                    ? pathname === link.href
                    : isActive(pathname, link.href);
                return (
                  <li
                    key={link.href}
                    className={cn(
                      "fill-mode-both motion-reduce:animate-none",
                      i === 2 && "mt-6",
                      open
                        ? "animate-in fade-in-0 slide-in-from-right-6"
                        : "animate-out fade-out-0 slide-out-to-right-6",
                    )}
                    style={{
                      animationDuration: `${LINK_MS}ms`,
                      animationDelay: `${(open ? i : links.length - 1 - i) * LINK_STAGGER_MS}ms`,
                    }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "t-display inline-flex min-h-11 items-center justify-end py-1.5 transition-colors",
                        i < 2 ? "text-[2rem]" : "text-[22px]",
                        active
                          ? "text-site-accent-text"
                          : "hover:text-site-accent-text text-white",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="shrink-0 px-5 pt-6 pb-6 md:px-10">
            <div data-account-details className="ml-auto w-fit max-w-full">
              <p className="text-base font-semibold wrap-anywhere">
                {user.name ?? "Signed in"}
              </p>
              {user.email ? (
                <p className="mt-1 text-sm wrap-anywhere text-white/75">
                  {user.email}
                </p>
              ) : null}
              <p className="t-label mt-2 text-[10px] leading-relaxed text-white/65">
                Role: {role}
              </p>
            </div>
            <button
              type="button"
              className="t-label text-site-danger-text mt-4 inline-flex min-h-11 items-center gap-3 text-[11px] hover:text-white"
              onClick={() => void signOut()}
            >
              Log out <LogOut className="size-4" />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
                      active ? "text-site-accent-text" : "text-white",
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

/** Header ink per tone: `light` is for pages on a light ground (some artist themes). */
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
                        ? `${ink.active} after:bg-site-accent after:absolute after:inset-x-0 after:-bottom-2 after:h-0.5`
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
