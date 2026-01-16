"use client"

import type React from "react"

import Link from "next/link"
import { StaticBackground } from "~/components/static-background"
import { FaSpotify, FaYoutube, FaInstagram, FaTiktok, FaFacebook, FaSoundcloud } from "react-icons/fa6"
import { motion } from "motion/react"
import { AnimatedPageHeader } from "~/components/animated-page-header"
import { AccentGlowCard } from "~/components/ui/accent-glow-card"
import Image from "next/image"

type SocialLink = {
  label: string
  href: string
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  image?: string
  description: string
  username: string
  color: string
}

const socialLinks: SocialLink[] = [
  {
    label: "INSTAGRAM",
    href: "https://instagram.com/atmos.nz",
    Icon: FaInstagram,
    image: "/socials/instagram.png",
    description: "Latest drops, artists, and behind-the-scenes.",
    username: "@atmos.nz",
    color: "#E1306C",
  },
  {
    label: "TIKTOK",
    href: "https://tiktok.com/@atmos_tv",
    Icon: FaTiktok,
    image: "/socials/tiktok.png",
    description: "Fast cuts, live moments, and trends.",
    username: "@atmos_tv",
    color: "#00F2EA",
  },
  {
    label: "YOUTUBE",
    href: "https://youtube.com/@ATMOS_TV",
    Icon: FaYoutube,
    image: "/socials/youtube.png",
    description: "Sets, recaps, and long-form visuals.",
    username: "@ATMOS_TV",
    color: "#FF0000",
  },
  {
    label: "FACEBOOK",
    href: "https://facebook.com/atmos.nz",
    Icon: FaFacebook,
    image: "/socials/facebook.png",
    description: "Announcements and community updates.",
    username: "atmos.nz",
    color: "#1877F2",
  },
  {
    label: "SOUNDCLOUD",
    href: "https://soundcloud.com/atmosmedia",
    Icon: FaSoundcloud,
    image: "/socials/soundcloud.png",
    description: "Mixes and exclusive audio.",
    username: "atmosmedia",
    color: "#FF5500",
  },
  {
    label: "SPOTIFY",
    href: "https://open.spotify.com/user/31zgkcouzyfpwhb3pfixdpvlfaom?si=a7f5f0fae13e4b1b",
    Icon: FaSpotify,
    image: "/socials/spotify.png",
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
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <AnimatedPageHeader
            title="FOLLOW ATMOS"
            subtitle="One presence across every platform"
          />

          {/* Social Cards Vertical Stack */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
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
  const { label, href, Icon, image, description, username, color } = social

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
      <Link href={href} target="_blank" rel="noopener noreferrer" className="block">
        <AccentGlowCard>
          {/* Logo in top-right corner */}
          <div className="absolute top-6 right-6">
            {image && <Image src={image} alt={label} width={80} height={80} />}
            {!image && <Icon className="h-16 w-16 md:h-20 md:w-20" style={{ color }} />}
          </div>

          {/* Content on the left */}
          <div className="pr-24 md:pr-32">
            {/* ATMOS SELECTS */}
            <h3 className="text-sm font-black tracking-wider text-white uppercase mb-1">
              ATMOS SELECTS
            </h3>

            {/* Platform name with date */}
            <div className="flex items-baseline gap-2 mb-3">
              <h4
                className="text-xl md:text-2xl font-black tracking-wider uppercase"
                style={{ color }}
              >
                {label}
              </h4>
            </div>

            {/* Description */}
            <p className="text-sm text-white/90 leading-relaxed">{description}</p>
          </div>
        </AccentGlowCard>
      </Link>
    </motion.div>
  )
}
