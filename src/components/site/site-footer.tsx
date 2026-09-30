import Link from "next/link";
import {
  FaInstagram,
  FaSoundcloud,
  FaSpotify,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import { SOCIALS } from "~/lib/site-constants";
import { primaryNav, secondaryNav } from "./nav";
import { AtmosLogo } from "./ui";

const footerSocials = [
  { ...SOCIALS.instagram, Icon: FaInstagram },
  { ...SOCIALS.tiktok, Icon: FaTiktok },
  { ...SOCIALS.youtube, Icon: FaYoutube },
  { ...SOCIALS.soundcloud, Icon: FaSoundcloud },
  { ...SOCIALS.spotify, Icon: FaSpotify },
];

/**
 * Public site footer: brand, socials, every page and the legal links, all in
 * one block with the oversized logo watermarked behind it, cropped by the
 * bottom edge.
 */
export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-white/10 bg-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-5 -bottom-[10vw] -z-10 opacity-[0.07] select-none md:inset-x-10"
      >
        <AtmosLogo className="w-full" />
      </div>
      <div className="grid gap-10 px-5 pt-12 pb-12 md:px-10 md:pb-14 lg:grid-cols-[1fr_auto]">
        <div>
          <AtmosLogo className="w-40" />
          <p className="mt-5 max-w-[36ch] text-[14px] text-white/60">
            Immersive electronic music events in Pōneke, Wellington.
          </p>
          <div className="mt-6 -ml-3 flex gap-1">
            {footerSocials.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex size-11 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon className="size-[18px]" />
              </a>
            ))}
          </div>
          <p className="mt-6 text-[12px] text-white/50">
            © {new Date().getFullYear()} ATMOS. All rights reserved.
          </p>
        </div>
        <nav aria-label="Footer" className="space-y-8">
          <ul className="grid grid-cols-2 gap-x-12 gap-y-4 sm:grid-cols-3">
            {[
              ...primaryNav,
              ...secondaryNav,
              { label: "Tickets", href: "/events" },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="t-label text-[12px] text-white/75 hover:text-white"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-white/55">
            {[
              { label: "Terms", href: "/terms" },
              { label: "Privacy", href: "/privacy" },
              { label: "Login", href: "/login" },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
