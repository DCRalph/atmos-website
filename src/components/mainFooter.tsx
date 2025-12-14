"use client";

import Link from "next/link";
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa6";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { authClient } from "~/lib/auth-client";

const footerLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Merch", href: "/merch" },
  { label: "Gigs", href: "/gigs" },
  { label: "Crew", href: "/crew" },
  { label: "Contact", href: "/contact" },
] as const;

const footerSocials = [
  { label: "Instagram", href: "https://instagram.com/atmos.nz", Icon: FaInstagram },
  { label: "TikTok", href: "https://tiktok.com/@atmos_tv", Icon: FaTiktok },
  { label: "YouTube", href: "https://youtube.com/@ATMOS_TV", Icon: FaYoutube },
] as const;


export function MainFooter() {
  const year = new Date().getFullYear();
  const { data: user, isLoading: userLoading } = api.user.me.useQuery();

  const handleLogout = () => {
    authClient.signOut();
  };

  return (
    <footer className="w-full">
      {/* top highlight line */}
      <div className="h-px w-full bg-linear-to-r from-transparent via-black/20 to-transparent dark:via-white/35" />

      <div className="border-t border-black/10 bg-white/75 text-black backdrop-blur-md dark:border-white/10 dark:bg-black/55 dark:text-white">
        <div className="mx-auto max-w-6xl p-4">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" aria-label="ATMOS home" className="shrink-0">
              <div className="relative aspect-4/1 w-40 sm:w-48">
                <Image
                  src="/logo/atmos-white.png"
                  alt="ATMOS Logo"
                  fill
                  priority
                  sizes="(max-width: 640px) 10rem, 12rem"
                  className="object-contain"
                />
              </div>
            </Link>

            <nav
              aria-label="Footer"
              className="flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs uppercase tracking-wider text-black/70 dark:text-white/70 sm:w-auto sm:justify-center"
            >
              {footerLinks.map((l) => (
                <Link key={l.href} href={l.href} className="transition-colors hover:text-black dark:hover:text-white">
                  {l.label}
                </Link>
              ))}

              {
                user && (
                  <Link href="/dashboard" className="transition-colors hover:text-black dark:hover:text-white">
                    Dashboard
                  </Link>
                )
              }

              {
                !userLoading &&
                !user && (
                  <Link href="/login" className="transition-colors hover:text-black dark:hover:text-white">
                    Login
                  </Link>
                )
              }

              {userLoading && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}

            </nav>

            {/* <div className="flex flex-col items-center sm:items-end"> */}
            <div className="flex items-center justify-center gap-1">
              {footerSocials.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md text-black/70 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/70 dark:hover:text-white dark:focus-visible:ring-white/30"
                >
                  <s.Icon className="h-5 w-5" />
                </Link>
              ))}
            </div>


          </div>
          {/* </div> */}
        </div>
      </div>
    </footer>
  );
}