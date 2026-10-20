import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  FaInstagram,
  FaSoundcloud,
  FaSpotify,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa6";
import { SOCIALS } from "~/lib/site-constants";
import { AtmosLogo } from "./ui";

const footerSocials = [
  { ...SOCIALS.instagram, Icon: FaInstagram },
  { ...SOCIALS.tiktok, Icon: FaTiktok },
  { ...SOCIALS.youtube, Icon: FaYoutube },
  { ...SOCIALS.soundcloud, Icon: FaSoundcloud },
  { ...SOCIALS.spotify, Icon: FaSpotify },
];

/**
 * Centered brand, socials, legal links and login, with the oversized logo
 * watermarked behind them and cropped by the bottom edge.
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
      <div className="flex flex-col items-center px-5 pt-9 pb-7 text-center md:px-10 md:pt-12 md:pb-9">
        <AtmosLogo className="w-48 md:w-56" />
        <div className="mt-6 flex justify-center gap-1">
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
        <nav aria-label="Footer" className="mt-5">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-white/65">
            {[
              { label: "Terms", href: "/legal/terms" },
              { label: "Privacy", href: "/legal/privacy" },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-white"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/login"
                className="group t-label hover:text-site-accent-text focus-visible:text-site-accent-text active:bg-site-accent active:text-site-accent-ink inline-flex min-h-11 items-center justify-center gap-3 px-1.5 text-[11px] text-white motion-safe:transition-[color,background-color,transform] motion-safe:duration-150 motion-safe:active:scale-[0.98]"
              >
                <span className="after:bg-site-accent relative after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:origin-left after:scale-x-0 group-hover:after:scale-x-100 group-focus-visible:after:scale-x-100 motion-safe:after:transition-transform motion-safe:after:duration-150">
                  Login
                </span>
                <ArrowRight
                  aria-hidden
                  className="size-4 motion-safe:transition-transform motion-safe:duration-150 motion-safe:group-hover:translate-x-[3px] motion-safe:group-focus-visible:translate-x-[3px]"
                />
              </Link>
            </li>
          </ul>
        </nav>
        <p className="mt-2.5 text-[11px] text-white/60 md:text-[12px]">
          © {new Date().getFullYear()} ATMOS. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
