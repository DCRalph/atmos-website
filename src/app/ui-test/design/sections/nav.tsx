"use client";

import { useState, type ReactNode } from "react";

import { ArrowUpRight, Menu, ShoppingBag, X } from "lucide-react";
import {
  FaInstagram,
  FaSoundcloud,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import { cn } from "~/lib/utils";
import { navLinks, photos, upcomingGigs, formatDay } from "../fixtures";
import { useBoard } from "../board-state";
import {
  AtmosLogo,
  Button,
  IconButton,
  Media,
  VariantTag,
} from "../primitives";

const socials = [
  { label: "Instagram", Icon: FaInstagram },
  { label: "TikTok", Icon: FaTiktok },
  { label: "YouTube", Icon: FaYoutube },
  { label: "SoundCloud", Icon: FaSoundcloud },
];

/** Compact bar once the hero scrolls away: solid black, hairline, no glass
 *  (there is nothing behind it worth blurring). Links and cart are live. */
function ScrolledBar() {
  const { cartCount, setCartOpen } = useBoard();
  const [active, setActive] = useState<string>("Gigs");
  return (
    <div className="flex h-16 items-center gap-8 border-y border-white/10 bg-black/90 px-5 md:px-10">
      <AtmosLogo className="w-24" />
      <ul className="hidden gap-7 lg:flex">
        {navLinks.map((l) => (
          <li key={l}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActive(l);
              }}
              aria-current={l === active ? "page" : undefined}
              className={cn(
                "mx-label relative text-[11px] transition-colors",
                l === active
                  ? "text-white after:absolute after:inset-x-0 after:-bottom-2 after:h-0.5 after:bg-[var(--mx-accent)]"
                  : "text-white/60 hover:text-white",
              )}
            >
              {l}
            </a>
          </li>
        ))}
      </ul>
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
          className="relative inline-flex size-10 items-center justify-center text-white/80 hover:text-white"
        >
          <ShoppingBag className="size-5" />
          {cartCount ? (
            <span
              key={cartCount}
              className="mx-num animate-in zoom-in-50 absolute top-0.5 right-0 flex size-4 items-center justify-center rounded-full bg-[var(--mx-accent)] text-[9px] font-bold text-[var(--mx-accent-ink)] duration-200"
            >
              {cartCount}
            </span>
          ) : null}
        </button>
        <Button variant="solid" size="sm" className="h-9">
          Tickets
        </Button>
      </div>
    </div>
  );
}

function Phone({ children, label }: { children: ReactNode; label: string }) {
  return (
    <figure className="shrink-0">
      <div className="relative h-[780px] w-[360px] overflow-hidden rounded-[36px] border-[6px] border-white/10 bg-black">
        {children}
      </div>
      <figcaption className="mt-3 text-center font-mono text-[11px] text-white/45 uppercase">
        {label}
      </figcaption>
    </figure>
  );
}

function MobilePage({ page, onMenu }: { page: string; onMenu: () => void }) {
  const gig = upcomingGigs[0];
  const isHome = page === "Home" || page === "Gigs";
  return (
    <>
      {isHome ? (
        <>
          <Media
            src={photos.crowd}
            alt=""
            sizes="360px"
            className="absolute inset-0 h-[560px]"
          />
          <div className="absolute inset-x-0 top-0 h-[560px] bg-gradient-to-t from-black via-black/40 to-black/20" />
        </>
      ) : null}
      <div className="relative flex h-16 items-center justify-between px-4">
        <AtmosLogo className="w-24" />
        <IconButton label="Open menu" onClick={onMenu}>
          <Menu className="size-5" />
        </IconButton>
      </div>
      {isHome ? (
        <div className="relative px-4 pt-[300px]">
          <h1 className="mx-display text-[2.6rem]">{gig.headline}</h1>
          <p className="mx-label mt-3 text-[11px] text-white/75">
            {formatDay(gig.date)} · {gig.venue}
          </p>
          <Button size="lg" className="mt-6 w-full">
            Get tickets
          </Button>
          <Button size="lg" variant="outline" className="mt-3 w-full">
            Lineup
          </Button>
        </div>
      ) : (
        <div className="relative px-4 pt-10">
          <h1
            key={page}
            className="mx-display animate-in fade-in-0 slide-in-from-bottom-2 text-[2.9rem] duration-300"
          >
            {page}
          </h1>
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 bg-white/[0.05]" />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** Full-screen menu: the page blurs behind it, links go huge and stretched. */
function MobileMenu({
  active,
  onNavigate,
  onClose,
}: {
  active: string;
  onNavigate: (page: string) => void;
  onClose: () => void;
}) {
  const { cartCount } = useBoard();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="animate-in fade-in-0 absolute inset-0 z-10 duration-200"
    >
      <div className="mx-glass-dark absolute inset-0 border-0 bg-black/75" />
      <div className="relative flex h-full flex-col">
        <div className="flex h-16 items-center justify-between px-4">
          <AtmosLogo className="w-24" />
          <IconButton label="Close menu" onClick={onClose} autoFocus>
            <X className="size-5" />
          </IconButton>
        </div>
        <nav className="mt-6 flex-1 px-4">
          <ul>
            {["Home", ...navLinks].map((l, i) => (
              <li
                key={l}
                className="animate-in fade-in-0 slide-in-from-left-3 fill-mode-both border-b border-white/10 duration-300"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(l);
                  }}
                  aria-current={l === active ? "page" : undefined}
                  className={cn(
                    "mx-display flex items-center justify-between py-3.5 text-[2rem] transition-colors",
                    l === active
                      ? "text-[var(--mx-accent-text)]"
                      : "text-white hover:text-white/70",
                  )}
                >
                  {l}
                  {l === "Merch" && cartCount ? (
                    <span className="mx-label rounded-[var(--mx-r-chip)] bg-white px-1.5 py-1 text-[9px] text-black">
                      {cartCount} in cart
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-4 p-4">
          <a
            href="#"
            className="mx-glass flex items-center justify-between rounded-[var(--mx-r-panel)] rounded-tl-none p-4"
          >
            <div>
              <p className="mx-label text-[10px] text-white/60">
                Next · {formatDay(upcomingGigs[0].date)}
              </p>
              <p className="mx-display mt-1.5 text-lg">
                {upcomingGigs[0].headline}
              </p>
            </div>
            <ArrowUpRight className="size-5" />
          </a>
          <div className="flex justify-between px-1">
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
    </div>
  );
}

function InteractivePhone({
  initialOpen,
  label,
}: {
  initialOpen: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [page, setPage] = useState("Gigs");
  return (
    <Phone label={label}>
      <MobilePage page={page} onMenu={() => setOpen(true)} />
      {open ? (
        <MobileMenu
          active={page}
          onClose={() => setOpen(false)}
          onNavigate={(p) => {
            setPage(p);
            setOpen(false);
          }}
        />
      ) : null}
    </Phone>
  );
}

export function NavSection() {
  return (
    <div className="space-y-14 pb-16">
      <div>
        <VariantTag>
          Desktop · scrolled state, click links, cart badge is live
        </VariantTag>
        <ScrolledBar />
      </div>
      <div>
        <VariantTag>Mobile · tap the menu, pick a page</VariantTag>
        <div className="no-scrollbar flex gap-8 overflow-x-auto px-5 md:px-10">
          <InteractivePhone initialOpen={false} label="Starts closed" />
          <InteractivePhone initialOpen label="Starts open" />
        </div>
      </div>
    </div>
  );
}
