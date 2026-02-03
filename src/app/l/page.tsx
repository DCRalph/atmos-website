"use client";

import { motion } from "motion/react";
import Link from "next/link";
import {
  Ticket,
  Globe,
  ArrowRight,
  ExternalLink,
  Calendar,
  Clock,
} from "lucide-react";
import Image from "next/image";
import { cn } from "~/lib/utils";
import { FaFacebook, FaSoundcloud, FaTwitter } from "react-icons/fa6";
import { FaSpotify } from "react-icons/fa6";
import { FaYoutube } from "react-icons/fa6";
import { FaInstagram } from "react-icons/fa6";

import { orbitron } from "~/lib/fonts";
import { formatDate, formatTime } from "~/lib/date-utils";

import { api } from "~/trpc/react";

import { links } from "~/app/(main)/socials/Socials";

type SocialLink = {
  platform: string;
  handle?: string;
  description?: string;
  url: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
};

const bigLinks: SocialLink[] = [
  // {
  //   platform: "Tickets",
  //   // handle: "@atmos",
  //   description: "Buy tickets to our events",
  //   url: "https://tickets.com",
  //   icon: Ticket,
  //   color: "#E4405F",
  // },
  {
    platform: "Website",
    handle: "atmosmedia.co.nz",
    description: "Atmos platform",
    url: "/",
    icon: Globe,
    color: "#E4405F",
  },
];

const smallLinks: SocialLink[] = [
  {
    platform: "Instagram",
    handle: "@atmos.nz",
    url: links.instagram,
    icon: FaInstagram,
    color: "#E4405F",
  },
  {
    platform: "TikTok",
    handle: "@atmos_tv",
    url: links.youtube,
    icon: FaYoutube,
    color: "#E4405F",
  },
  {
    platform: "SoundCloud",
    handle: "@atmosmedia",
    url: links.soundcloud,
    icon: FaSoundcloud,
    color: "#E4405F",
  },
  {
    platform: "Spotify",
    handle: "@atmosmedia",
    url: links.spotify,
    icon: FaSpotify,
    color: "#E4405F",
  },
  {
    platform: "YouTube",
    handle: "@ATMOS_TV",
    url: links.youtube,
    icon: FaYoutube,
    color: "#E44405F",
  },
  {
    platform: "Facebook",
    handle: "@atmosmedia",
    url: links.facebook,
    icon: FaFacebook,
    color: "#E4405F",
  },
  {
    platform: "Twitter",
    handle: "@atmosmedia",
    url: links.twitter,
    icon: FaTwitter,
    color: "#E4405F",
  },
];

export default function LinksPage() {
  const upcomingGigs = api.gigs.getUpcoming.useQuery();

  return (
    <div className="flex min-h-screen bg-zinc-900 px-4 pt-4 md:pt-12">
      <div className="shadow-glass mx-auto flex max-w-xl grow flex-col gap-4 rounded-t-xl bg-black p-6 md:gap-8">
        {/* Header */}
        <motion.div
          className="mt-0 text-center select-none md:mt-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <div className="pointer-events-none relative">
              {/* <h1 className="text-6xl font-black uppercase tracking-tighter text-white sm:text-7xl">ATMOS</h1> */}
              <div className="relative h-16 w-48 md:w-72">
                <Image
                  src="/logo/atmos-white.png"
                  alt="ATMOS Logo"
                  fill
                  sizes="30vw"
                  className="object-contain"
                />
              </div>
              <div className="from-accent-muted via-accent-muted absolute -bottom-3 left-0 h-1 w-full bg-linear-to-r to-transparent" />
            </div>
          </div>

          <p className="text-xs font-bold tracking-widest text-white/60 uppercase md:text-sm">
            Connect with us everywhere
          </p>
        </motion.div>

        <SmallLinks links={smallLinks} />

        {upcomingGigs.data && upcomingGigs.data.length > 0 && (
          <UpcomingGigLink gig={upcomingGigs.data[0]!} />
        )}

        <BigLinks links={bigLinks} />

        {/* Footer */}
        <motion.div
          className="mt-auto text-center select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <p className="text-xs font-bold tracking-widest text-white/40 uppercase">
            © 2026 ATMOS. All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

const MotionLink = motion.create(Link);

const BigLinks = ({
  links,
  className,
}: {
  links: SocialLink[];
  className?: string;
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {links.map((link, index) => (
        <MotionLink
          key={link.platform}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group hover:border-accent-muted relative block overflow-hidden border-2 border-white/10 bg-black/90 p-6 transition-all hover:bg-black hover:shadow-[0_0_25px_var(--accent-muted)]"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
        >
          {/* Red accent bar on left */}
          <div className="bg-accent-muted absolute top-0 left-0 h-full w-1 opacity-0 transition-all group-hover:w-2 group-hover:opacity-100" />

          {/* Glow effect */}
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="from-accent-muted/5 absolute inset-0 bg-linear-to-r via-transparent to-transparent" />
          </div>

          <div className="relative flex items-center gap-5">
            {/* Icon */}
            <div className="group-hover:border-accent-muted group-hover:bg-accent-muted/10 flex h-14 w-14 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50 transition-all">
              <link.icon className="group-hover:text-accent-muted h-6 w-6 text-white transition-colors" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <h3
                className={cn(
                  "group-hover:text-accent-muted text-xl font-black tracking-tight text-white uppercase transition-colors sm:text-2xl",
                  orbitron.className,
                )}
              >
                {link.platform}
              </h3>
              <p className="mt-1 text-xs font-bold tracking-wider text-white/50 uppercase">
                {link.handle}
              </p>
              <p className="mt-2 text-sm font-medium text-white/70">
                {link.description}
              </p>
            </div>

            {/* Arrow indicator */}
            <div className="shrink-0 transform transition-transform group-hover:translate-x-1">
              <ExternalLink
                className="group-hover:text-accent-muted h-6 w-6 text-white/30 transition-colors"
                strokeWidth={2.5}
              />
            </div>
          </div>
        </MotionLink>
      ))}
    </div>
  );
};

const SmallLinks = ({
  links,
  className,
}: {
  links: SocialLink[];
  className?: string;
}) => {
  return (
    <motion.div
      className={cn("flex flex-wrap justify-center gap-3", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      {links.map((link, index) => (
        <MotionLink
          key={link.platform}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group hover:border-accent-muted relative flex h-16 w-16 items-center justify-center border-2 border-white/10 bg-black/90 transition-all hover:bg-black hover:shadow-[0_0_20px_var(--accent-muted)]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
          title={link.platform + (link.handle ? ` @${link.handle}` : "")}
        >
          <link.icon className="group-hover:text-accent-muted h-7 w-7 text-white/70 transition-all group-hover:scale-110" />
        </MotionLink>
      ))}
    </motion.div>
  );
};

type UpcomingGig = {
  id: string;
  gigStartTime: Date;
  gigEndTime?: Date | null;
  title: string;
  subtitle: string;
  ticketLink?: string | null;
  posterFileUpload?: { url: string } | null;
};

const UpcomingGigLink = ({ gig }: { gig: UpcomingGig }) => {
  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
    >
      <div className="flex items-center gap-2">
        <div className="bg-accent-muted/30 h-px flex-1" />
        <span className="text-accent-muted text-xs font-black tracking-widest uppercase">
          Next Event
        </span>
        <div className="bg-accent-muted/30 h-px flex-1" />
      </div>

      <div className="group border-accent-muted/50 hover:border-accent-muted relative block overflow-hidden border-2 bg-black/90 p-5 transition-all hover:bg-black hover:shadow-[0_0_30px_var(--accent-muted)]">
        {/* Animated accent bar */}
        <div className="bg-accent-muted absolute top-0 left-0 h-full w-1.5 transition-all group-hover:w-2" />

        {/* Corner accent */}
        <div className="absolute top-0 right-0 h-8 w-8 overflow-hidden">
          <div className="bg-accent-muted/20 group-hover:bg-accent-muted/40 absolute top-0 right-0 h-12 w-12 translate-x-1/2 -translate-y-1/2 rotate-45 transition-all" />
        </div>

        {/* Glow effect */}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="from-accent-muted/10 absolute inset-0 bg-linear-to-r via-transparent to-transparent" />
        </div>

        <div className="relative flex gap-4">
          {/* Poster on the left */}
          {gig.posterFileUpload?.url && (
            <div className="relative h-32 w-24 shrink-0 overflow-hidden border-2 border-white/10 bg-black/20 transition-all group-hover:border-accent-muted/50 sm:h-40 sm:w-28">
              <Image
                src={gig.posterFileUpload.url}
                alt={`${gig.title} poster`}
                fill
                sizes="(max-width: 640px) 96px, 112px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          )}

          {/* Content on the right */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* Date & Time */}
            <div className="flex items-center gap-4">
              <div className="text-accent-muted flex items-center gap-2">
                {/* <Calendar className="h-4 w-4" /> */}
                <span
                  className={cn(
                    "text-lg font-black tracking-tight uppercase",
                    orbitron.className,
                  )}
                >
                  {formatDate(gig.gigStartTime)}
                </span>
              </div>
              {gig.gigEndTime && (
                <div className="flex items-center gap-1.5 text-white/50">
                  {/* <Clock className="h-3.5 w-3.5" /> */}
                  <span className="text-xs font-bold tracking-wider uppercase">
                    {formatTime(gig.gigStartTime)} - {formatTime(gig.gigEndTime)}
                  </span>
                </div>
              )}
            </div>

            {/* Title & Subtitle */}
            <div>
              <h3
                className={cn(
                  "group-hover:text-accent-muted text-xl leading-tight font-black tracking-tight text-white uppercase transition-colors sm:text-2xl",
                  orbitron.className,
                )}
              >
                {gig.title}
              </h3>
              <p className="mt-1 text-sm font-medium text-white/60">
                {gig.subtitle}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Link
                href={`/gigs/${gig.id}`}
                className="group/btn relative flex flex-1 items-center justify-center gap-2 overflow-hidden border-2 border-white/30 bg-transparent px-4 py-2.5 text-center text-xs font-black tracking-wider text-white uppercase transition-all duration-200 hover:border-white hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.15)]"
              >
                <span className="relative z-10 transition-transform duration-200 group-hover/btn:-translate-x-0.5">
                  View Details
                </span>
                <ArrowRight className="relative z-10 h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
              </Link>

              {gig.ticketLink && (
                <Link
                  href={gig.ticketLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/ticket bg-accent-muted hover:bg-accent-muted relative flex items-center gap-2 overflow-hidden px-5 py-2.5 text-xs font-black tracking-wider text-white uppercase transition-all duration-200 hover:shadow-[0_0_25px_var(--accent-muted)]"
                >
                  <Ticket className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover/ticket:scale-110 group-hover/ticket:rotate-[-8deg]" />
                  <span className="relative z-10">Tickets</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
