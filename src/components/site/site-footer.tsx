import Link from "next/link";
import {
  FaInstagram,
  FaSoundcloud,
  FaSpotify,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import { CONTACT, SOCIALS } from "~/lib/site-constants";
import { primaryNav, secondaryNav } from "./nav";
import { AtmosLogo } from "./ui";

const footerSocials = [
  { ...SOCIALS.instagram, Icon: FaInstagram },
  { ...SOCIALS.tiktok, Icon: FaTiktok },
  { ...SOCIALS.youtube, Icon: FaYoutube },
  { ...SOCIALS.soundcloud, Icon: FaSoundcloud },
  { ...SOCIALS.spotify, Icon: FaSpotify },
];

/** Public site footer: brand, socials, every page, legal, and the oversized logo sign-off. */
export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="grid gap-10 px-5 py-12 md:px-10 lg:grid-cols-[1fr_auto]">
        <div>
          <AtmosLogo className="w-40" />
          <p className="mt-5 max-w-[36ch] text-[14px] text-white/60">
            Immersive electronic music events in Pōneke, Wellington.
          </p>
          <div className="mt-6 flex gap-1">
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
        </div>
        <nav aria-label="Footer">
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
        </nav>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 px-5 py-5 text-[12px] text-white/55 md:px-10">
        <p>© {new Date().getFullYear()} ATMOS. All rights reserved.</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/login" className="hover:text-white">
            Login
          </Link>
          <a href={`mailto:${CONTACT.email}`} className="hover:text-white">
            {CONTACT.email}
          </a>
        </div>
      </div>
      <div
        aria-hidden
        className="h-[clamp(4rem,14vw,13rem)] overflow-hidden px-5 opacity-[0.07] select-none md:px-10"
      >
        <AtmosLogo className="w-full" />
      </div>
    </footer>
  );
}
