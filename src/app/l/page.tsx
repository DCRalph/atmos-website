"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { Ticket, Globe, ArrowRight, ExternalLink, Calendar, Clock } from "lucide-react"
import Image from "next/image"
import { cn } from "~/lib/utils"
import { FaFacebook, FaSoundcloud, FaTwitter } from "react-icons/fa6"
import { FaSpotify } from "react-icons/fa6"
import { FaYoutube } from "react-icons/fa6"
import { FaInstagram } from "react-icons/fa6"

import { orbitron } from "~/lib/fonts"
import { formatDate, formatTime } from "~/lib/date-utils"

import { api } from "~/trpc/react"

type SocialLink = {
  platform: string;
  handle?: string;
  description?: string;
  url: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
}

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
]

const smallLinks: SocialLink[] = [
  {
    platform: "Instagram",
    handle: "@atmos.nz",
    url: "https://instagram.com/atmos.nz",
    icon: FaInstagram,
    color: "#E4405F",
  },
  {
    platform: "TikTok",
    handle: "@atmos_tv",
    url: "https://youtube.com/@ATMOS_TV",
    icon: FaYoutube,
    color: "#E4405F",
  },
  {
    platform: "SoundCloud",
    handle: "@atmosmedia",
    url: "https://soundcloud.com/atmosmedia",
    icon: FaSoundcloud,
    color: "#E4405F",
  },
  {
    platform: "Spotify",
    handle: "@atmosmedia",
    url: "https://open.spotify.com/user/31zgkcouzyfpwhb3pfixdpvlfaom?si=a7f5f0fae13e4b1b",
    icon: FaSpotify,
    color: "#E4405F",
  },
  {
    platform: "YouTube",
    handle: "@ATMOS_TV",
    url: "https://youtube.com/@ATMOS_TV",
    icon: FaYoutube,
    color: "#E44405F",
  },
  {
    platform: "Facebook",
    handle: "@atmosmedia",
    url: "https://facebook.com/atmosmedia",
    icon: FaFacebook,
    color: "#E4405F",
  },
  {
    platform: "Twitter",
    handle: "@atmosmedia",
    url: "https://twitter.com/atmosmedia",
    icon: FaTwitter,
    color: "#E4405F",
  },
]


export default function LinksPage() {

  const upcomingGigs = api.gigs.getUpcoming.useQuery()


  return (
    <div className="min-h-screen bg-zinc-900 px-4 pt-4 md:pt-12 flex">
      <div className="mx-auto max-w-xl bg-black rounded-t-xl p-6 flex flex-col gap-4 md:gap-8 grow shadow-glass">
        {/* Header */}
        <motion.div
          className="mt-0 md:mt-8 text-center select-none"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <div className="relative pointer-events-none">
              {/* <h1 className="text-6xl font-black uppercase tracking-tighter text-white sm:text-7xl">ATMOS</h1> */}
              <div className="relative w-48 md:w-72 h-16">
                <Image src="/logo/atmos-white.png" alt="ATMOS Logo" fill sizes="30vw" className="object-contain" />
              </div>
              <div className="absolute -bottom-3 left-0 h-1 w-full bg-linear-to-r from-accent-muted via-accent-muted to-transparent" />
            </div>
          </div>

          <p className="text-xs md:text-sm font-bold uppercase tracking-widest text-white/60">
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
          className="text-center mt-auto select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-white/40">
            © 2026 ATMOS. All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  )
}


const BigLinks = ({ links, className }: { links: SocialLink[], className?: string }) => {
  return (
    <div className={cn("space-y-4", className)}>
      {links.map((link, index) => (
        <motion.a
          key={link.platform}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block overflow-hidden border-2 border-white/10 bg-black/90 p-6 transition-all hover:border-accent-muted hover:bg-black hover:shadow-[0_0_25px_var(--accent-muted)]"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 + (index * 0.1) }}
        >
          {/* Red accent bar on left */}
          <div className="absolute left-0 top-0 h-full w-1 bg-accent-muted opacity-0 transition-all group-hover:w-2 group-hover:opacity-100" />

          {/* Glow effect */}
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="absolute inset-0 bg-linear-to-r from-accent-muted/5 via-transparent to-transparent" />
          </div>

          <div className="relative flex items-center gap-5">
            {/* Icon */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50 transition-all group-hover:border-accent-muted group-hover:bg-accent-muted/10">
              <link.icon className="h-6 w-6 text-white transition-colors group-hover:text-accent-muted" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className={cn("text-xl font-black uppercase tracking-tight text-white transition-colors group-hover:text-accent-muted sm:text-2xl", orbitron.className)}>
                {link.platform}
              </h3>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-white/50">{link.handle}</p>
              <p className="mt-2 text-sm font-medium text-white/70">{link.description}</p>
            </div>

            {/* Arrow indicator */}
            <div className="shrink-0 transform transition-transform group-hover:translate-x-1">
              <ExternalLink
                className="h-6 w-6 text-white/30 transition-colors group-hover:text-accent-muted"
                strokeWidth={2.5}
              />
            </div>
          </div>
        </motion.a>
      ))}
    </div>
  )
}


const SmallLinks = ({ links, className }: { links: SocialLink[], className?: string }) => {
  return (
    <motion.div
      className={cn("flex flex-wrap justify-center gap-3", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      {links.map((link, index) => (
        <motion.a
          key={link.platform}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex h-16 w-16 items-center justify-center border-2 border-white/10 bg-black/90 transition-all hover:border-accent-muted hover:bg-black hover:shadow-[0_0_20px_var(--accent-muted)]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 + (index * 0.05) }}
          title={link.platform + (link.handle ? ` @${link.handle}` : "")}
        >
          <link.icon className="h-7 w-7 text-white/70 transition-all group-hover:scale-110 group-hover:text-accent-muted" />
        </motion.a>
      ))}
    </motion.div>
  )
}


type UpcomingGig = {
  id: string
  gigStartTime: Date
  gigEndTime?: Date | null
  title: string
  subtitle: string
  ticketLink?: string | null
}

const UpcomingGigLink = ({ gig }: { gig: UpcomingGig }) => {
  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
    >
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-accent-muted/30" />
        <span className="text-xs font-black uppercase tracking-widest text-accent-muted">Next Event</span>
        <div className="h-px flex-1 bg-accent-muted/30" />
      </div>

      <div
        className="group relative block overflow-hidden border-2 border-accent-muted/50 bg-black/90 p-5 transition-all hover:border-accent-muted hover:bg-black hover:shadow-[0_0_30px_var(--accent-muted)]"
      >
        {/* Animated accent bar */}
        <div className="absolute left-0 top-0 h-full w-1.5 bg-accent-muted transition-all group-hover:w-2" />

        {/* Corner accent */}
        <div className="absolute right-0 top-0 h-8 w-8 overflow-hidden">
          <div className="absolute right-0 top-0 h-12 w-12 -translate-y-1/2 translate-x-1/2 rotate-45 bg-accent-muted/20 transition-all group-hover:bg-accent-muted/40" />
        </div>

        {/* Glow effect */}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="absolute inset-0 bg-linear-to-r from-accent-muted/10 via-transparent to-transparent" />
        </div>

        <div className="relative flex flex-col gap-4">
          {/* Date & Time */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-accent-muted">
              {/* <Calendar className="h-4 w-4" /> */}
              <span className={cn("text-lg font-black uppercase tracking-tight", orbitron.className)}>
                {formatDate(gig.gigStartTime)}
              </span>
            </div>
            {gig.gigEndTime && (
              <div className="flex items-center gap-1.5 text-white/50">
                {/* <Clock className="h-3.5 w-3.5" /> */}
                <span className="text-xs font-bold uppercase tracking-wider">
                  {formatTime(gig.gigStartTime)} - {formatTime(gig.gigEndTime)}
                </span>
              </div>
            )}
          </div>

          {/* Title & Subtitle */}
          <div>
            <h3 className={cn("text-xl font-black uppercase leading-tight tracking-tight text-white transition-colors group-hover:text-accent-muted sm:text-2xl", orbitron.className)}>
              {gig.title}
            </h3>
            <p className="mt-1 text-sm font-medium text-white/60">{gig.subtitle}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href={`/gigs/${gig.id}`}
              className="group/btn relative flex-1 flex items-center justify-center gap-2 overflow-hidden border-2 border-white/30 bg-transparent px-4 py-2.5 text-center text-xs font-black uppercase tracking-wider text-white transition-all duration-200 hover:border-white hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.15)]"
            >
              <span className="relative z-10 transition-transform duration-200 group-hover/btn:-translate-x-0.5">View Details</span>
              <ArrowRight className="relative z-10 h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
            </Link>

            {gig.ticketLink && (
              <Link
                href={gig.ticketLink}
                target="_blank"
                rel="noopener noreferrer"
                className="group/ticket relative flex items-center gap-2 overflow-hidden bg-accent-muted px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-all duration-200 hover:bg-accent-muted hover:shadow-[0_0_25px_var(--accent-muted)]"
              >
                <Ticket className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover/ticket:rotate-[-8deg] group-hover/ticket:scale-110" />
                <span className="relative z-10">Tickets</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
