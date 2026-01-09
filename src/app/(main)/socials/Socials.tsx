"use client"

import type React from "react"

import Link from "next/link"
import { StaticBackground } from "~/components/static-background"
import { FaSpotify, FaYoutube, FaInstagram, FaTiktok, FaFacebook, FaSoundcloud } from "react-icons/fa6"
import { motion } from "motion/react"
import { ExternalLink } from "lucide-react"

type SocialLink = {
  label: string
  href: string
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  description: string
  username: string
  color: string
}

const socialLinks: SocialLink[] = [
  {
    label: "INSTAGRAM",
    href: "https://instagram.com/atmos.nz",
    Icon: FaInstagram,
    description: "Latest drops, artists, and behind-the-scenes.",
    username: "@atmos.nz",
    color: "#E1306C",
  },
  {
    label: "TIKTOK",
    href: "https://tiktok.com/@atmos_tv",
    Icon: FaTiktok,
    description: "Fast cuts, live moments, and trends.",
    username: "@atmos_tv",
    color: "#00F2EA",
  },
  {
    label: "YOUTUBE",
    href: "https://youtube.com/@ATMOS_TV",
    Icon: FaYoutube,
    description: "Sets, recaps, and long-form visuals.",
    username: "@ATMOS_TV",
    color: "#FF0000",
  },
  {
    label: "FACEBOOK",
    href: "https://facebook.com/atmos.nz",
    Icon: FaFacebook,
    description: "Announcements and community updates.",
    username: "atmos.nz",
    color: "#1877F2",
  },
  {
    label: "SOUNDCLOUD",
    href: "https://soundcloud.com/atmosmedia",
    Icon: FaSoundcloud,
    description: "Mixes and exclusive audio.",
    username: "atmosmedia",
    color: "#FF5500",
  },
  {
    label: "SPOTIFY",
    href: "https://open.spotify.com/user/31zgkcouzyfpwhb3pfixdpvlfaom?si=a7f5f0fae13e4b1b",
    Icon: FaSpotify,
    description: "Playlists and curated sounds.",
    username: "ATMOS",
    color: "#1DB954",
  },
]

export default function SocialsPage() {
  return (
    <main className="bg-black text-white min-h-screen">
      <StaticBackground imageSrc="/home/CAGED 2-95.jpg" />

      <section className="relative z-10 min-h-screen px-4 py-16 sm:py-24">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <motion.div
            className="mb-16 text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-[0.15em] text-white mb-4">
              FOLLOW ATMOS
            </h1>
            <div className="h-1 w-24 bg-red-500 mx-auto mb-6" />
            <p className="text-base sm:text-lg text-white/60 tracking-wider uppercase font-mono">
              One presence across every platform
            </p>
          </motion.div>

          {/* Social Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {socialLinks.map((social, index) => (
              <SocialCard key={social.label} social={social} index={index} />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function SocialCard({
  social,
  index,
}: {
  social: SocialLink
  index: number
}) {
  const { label, href, Icon, description, username, color } = social

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link href={href} target="_blank" rel="noopener noreferrer" className="group block h-full">
        <div
          className="relative h-full bg-zinc-950 border-2 border-zinc-800 p-6 transition-all duration-300 hover:border-red-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
          style={{ "--social-color": color, "--social-color-bg": `${color}15` } as React.CSSProperties}
        >
          {/* Red accent bar on left */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 transform scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-top bg-accent-muted"
          />

          {/* Icon */}
          <div className="flex items-center justify-between mb-4">
            <div
              className="p-3 bg-zinc-900 border-2 border-zinc-800 transition-all duration-300 group-hover:border-(--social-color) group-hover:bg-(--social-color-bg)"
            >
              <Icon className="h-6 w-6 text-white" />
            </div>

            <h3 className="text-xl font-black tracking-[0.15em] text-white">{label}</h3>


            <div className="text-red-500 opacity-0 group-hover:opacity-100 group-hover:text-(--social-color) transition-all duration-300">
              <ExternalLink className="h-5 w-5" />
            </div>

          </div>

          {/* Content */}
          <div className="space-y-3">
            <p
              className="text-sm font-mono tracking-wider transition-colors duration-300 group-hover:opacity-100 opacity-80"
              style={{ color }}
            >
              {username}
            </p>
            <p className="text-sm text-white/50 leading-relaxed">{description}</p>
          </div>

        </div>
      </Link>
    </motion.div>
  )
}
