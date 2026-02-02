"use client";

import Link from "next/link";
import { FaInstagram, FaPlus, FaTiktok, FaYoutube } from "react-icons/fa6";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { authClient } from "~/lib/auth-client";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { orbitron } from "~/lib/fonts";

import { links } from "~/app/(main)/socials/Socials";
import { GradientBlur } from "./gradient-blur";

const footerLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Merch", href: "/merch" },
  { label: "Gigs", href: "/gigs" },
  { label: "Crew", href: "/crew" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
] as const;

const footerSocials = [
  {
    label: "Instagram",
    href: links.instagram,
    Icon: FaInstagram,
    tooltip: "Instagram",
  },
  {
    label: "TikTok",
    href: links.tiktok,
    Icon: FaTiktok,
    tooltip: "TikTok",
  },
  {
    label: "YouTube",
    href: links.youtube,
    Icon: FaYoutube,
    tooltip: "YouTube",
  },
  { label: "Socials", href: "/socials", Icon: FaPlus, tooltip: "Socials" },
] as const;

export function MainFooter() {
  const year = new Date().getFullYear();
  const { data: user, isLoading: userLoading } = api.user.me.useQuery();

  const handleLogout = () => {
    authClient.signOut();
  };

  return (
    <footer className="w-full relative">
      {/* top highlight line */}
      {/* <div className="h-px w-full bg-linear-to-r from-transparent via-black/20 to-transparent dark:via-white/35" /> */}

      {/* <div className="border-t border-black/10 bg-white/75 text-black backdrop-blur-md dark:border-white/10 dark:bg-black/55 dark:text-white"> */}
      <div className="bg-white/75 text-black dark:bg-black/55 dark:text-white backdrop-blur-lg z-10">
      {/* <div className="text-black dark:text-white z-10"> */}
        <div className="mx-auto max-w-6xl p-4">
          <div className="flex flex-col items-center gap-6 sm:items-center sm:justify-between md:flex-row">
            <Link href="/" aria-label="ATMOS home" className="shrink-0">
              <div className="relative aspect-4/1 w-40 sm:w-48">
                <Image
                  src="/logo/atmos-white.png"
                  alt="ATMOS Logo"
                  fill
                  priority
                  sizes="(max-width: 640px) 10rem, 12rem"
                  className="hidden object-contain dark:block"
                />
                <Image
                  src="/logo/atmos-black.png"
                  alt="ATMOS Logo"
                  fill
                  priority
                  sizes="(max-width: 640px) 10rem, 12rem"
                  className="block object-contain dark:hidden"
                />
              </div>
            </Link>

            <nav
              aria-label="Footer"
              className="flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-3 px-8 text-xs tracking-wider text-black/70 uppercase sm:w-auto sm:justify-center sm:px-0 dark:text-white/70"
            >
              {footerLinks.map((l) => (
                <FooterLink key={l.href} link={l} />
              ))}

              {user && (
                <Link
                  href="/dashboard"
                  className="transition-colors hover:text-black dark:hover:text-white"
                >
                  Dashboard
                </Link>
              )}

              {!userLoading && !user && (
                <Link
                  href="/login"
                  className="transition-colors hover:text-black dark:hover:text-white"
                >
                  Login
                </Link>
              )}

              {userLoading && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </nav>

            {/* <div className="flex flex-col items-center sm:items-end"> */}
            <div className="flex items-center justify-center gap-1">
              {footerSocials.map((s) => (
                <FooterSocialLink key={s.href} s={s} />
              ))}
            </div>
          </div>
          {/* </div> */}
        </div>

        {/* Copyright section */}
        {/* <div className="border-t border-black/10 dark:border-white/10"> */}
        <div className="mx-auto max-w-6xl px-4 py-3">
          <p className="text-center text-xs">
            © {year} ATMOS. All rights reserved.
          </p>
        </div>
        {/* </div> */}
      </div>
    </footer>
  );
}

function FooterLink({ link }: { link: (typeof footerLinks)[number] }) {
  const pathname = usePathname();
  const isActive =
    link.href === "/"
      ? pathname === "/"
      : pathname === link.href || pathname.startsWith(link.href + "/");

  return (
    <Link
      key={link.href}
      href={link.href}
      className={`${isActive ? "font-bold! underline" : ""} transition-colors hover:text-black dark:hover:text-white`}
    >
      {link.label}
    </Link>
  );
}

function FooterSocialLink({ s }: { s: (typeof footerSocials)[number] }) {
  const newTab = s.href.includes("https://");
  const target = newTab ? "_blank" : "_self";
  const rel = newTab ? "noreferrer" : undefined;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          key={s.href}
          href={s.href}
          target={target}
          rel={rel}
          aria-label={s.label}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-black/70 transition-colors hover:text-black focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:outline-none dark:text-white/70 dark:hover:text-white dark:focus-visible:ring-white/30"
        >
          <s.Icon className="h-5 w-5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <span
          className={`font-semibold tracking-wide uppercase ${orbitron.className}`}
        >
          {s.tooltip}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
