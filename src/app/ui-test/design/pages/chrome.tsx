"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu, ShoppingBag, X } from "lucide-react";
import {
  FaInstagram,
  FaSoundcloud,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import { cn } from "~/lib/utils";
import { useBoard } from "../board-state";
import { navLinks } from "../fixtures";
import { AtmosLogo, Button, IconButton } from "../primitives";

export { Footer as SiteFooter } from "../sections/closing";

const socials = [
  { label: "Instagram", Icon: FaInstagram },
  { label: "TikTok", Icon: FaTiktok },
  { label: "YouTube", Icon: FaYoutube },
  { label: "SoundCloud", Icon: FaSoundcloud },
];

function CartButton() {
  const { cartCount, setCartOpen } = useBoard();
  return (
    <button
      type="button"
      onClick={() => setCartOpen(true)}
      aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
      className="relative inline-flex size-11 items-center justify-center rounded-full text-white/80 hover:text-white"
    >
      <ShoppingBag className="size-5" />
      {cartCount ? (
        <span
          key={cartCount}
          className="mx-num animate-in zoom-in-50 absolute top-1 right-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--mx-accent)] text-[9px] font-bold text-[var(--mx-accent-ink)] duration-200"
        >
          {cartCount}
        </span>
      ) : null}
    </button>
  );
}

/**
 * The public site header used by every page draft. Over a hero it's
 * transparent (the hero's own scrim carries contrast); elsewhere it's solid
 * black with a hairline. Below `lg` the links move into a full-screen menu.
 */
export function SiteHeader({
  active,
  overHero = false,
}: {
  active?: string;
  overHero?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <>
      <header
        className={cn(
          "z-40 flex h-16 items-center gap-8 px-5 md:h-20 md:px-10",
          overHero
            ? "absolute inset-x-0 top-0"
            : "relative border-b border-white/10 bg-black",
        )}
      >
        <a href="#" aria-label="Atmos home">
          <AtmosLogo className="w-24 md:w-28" />
        </a>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex gap-7">
            {navLinks.map((l) => (
              <li key={l}>
                <a
                  href="#"
                  aria-current={l === active ? "page" : undefined}
                  className={cn(
                    "mx-label relative text-[11px] transition-colors",
                    l === active
                      ? "text-white after:absolute after:inset-x-0 after:-bottom-2 after:h-0.5 after:bg-[var(--mx-accent)]"
                      : "text-white/65 hover:text-white",
                  )}
                >
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <CartButton />
          <Button size="sm" className="h-10 max-sm:hidden">
            Tickets
          </Button>
          <IconButton
            label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="lg:hidden"
          >
            <Menu className="size-5" />
          </IconButton>
        </div>
      </header>

      {menuOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="animate-in fade-in-0 fixed inset-0 z-[65] duration-200"
        >
          <div className="mx-glass-dark absolute inset-0 border-0 bg-black/80" />
          <div className="relative flex h-full flex-col">
            <div className="flex h-16 items-center justify-between px-5">
              <AtmosLogo className="w-24" />
              <IconButton
                label="Close menu"
                onClick={() => setMenuOpen(false)}
                autoFocus
              >
                <X className="size-5" />
              </IconButton>
            </div>
            <nav aria-label="Main" className="mt-4 flex-1 overflow-y-auto px-5">
              <ul>
                {["Home", ...navLinks, "Equipment", "About"].map((l, i) => (
                  <li
                    key={l}
                    className="animate-in fade-in-0 slide-in-from-left-3 fill-mode-both border-b border-white/10 duration-300"
                    style={{ animationDelay: `${i * 25}ms` }}
                  >
                    <a
                      href="#"
                      onClick={() => setMenuOpen(false)}
                      aria-current={l === active ? "page" : undefined}
                      className={cn(
                        "mx-display flex py-3 text-[2rem]",
                        l === active
                          ? "text-[var(--mx-accent-text)]"
                          : "text-white",
                      )}
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex justify-between p-5">
              {socials.map(({ label, Icon }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex size-11 items-center justify-center text-white/70 hover:text-white"
                >
                  <Icon className="size-5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Page title block for pages without a photo hero. */
export function PageTitle({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <div className="px-5 pt-12 pb-10 md:px-10 md:pt-20 md:pb-14">
      <h1 className="mx-display text-[clamp(2.75rem,9vw,7rem)]">{title}</h1>
      {intro ? (
        <p className="mt-5 max-w-[52ch] text-[16px] text-white/65 md:text-[17px]">
          {intro}
        </p>
      ) : null}
      {children}
    </div>
  );
}
