"use client";

import type React from "react";

import Link from "next/link";
import { StaticBackground } from "~/components/static-background";
import {
  FaSpotify,
  FaYoutube,
  FaInstagram,
  FaTiktok,
  FaFacebook,
  FaSoundcloud,
} from "react-icons/fa6";
import { motion } from "motion/react";
import { AnimatedPageHeader } from "~/components/animated-page-header";
import { AccentGlowCard } from "~/components/ui/accent-glow-card";
import Image from "next/image";

type SocialLink = {
  media?: "ATMOS SELECTS" | "ATMOS TV" | "ATMOS NZ";
  label: string;
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  image?: string;
  description: string;
  username: string;
  color: string;
};

export const links = {
  instagram: "https://instagram.com/atmos.nz",
  tiktok: "https://tiktok.com/@atmos_tv",
  youtube: "https://youtube.com/@ATMOS_TV",
  facebook: "https://facebook.com/atmos.nz",
  soundcloud: "https://soundcloud.com/atmosmedia",
  spotify: "https://open.spotify.com/user/31zgkcouzyfpwhb3pfixdpvlfaom?si=a7f5f0fae13e4b1b",
  twitter: "https://twitter.com/atmosmedia"
} as const;

const socialLinks: SocialLink[] = [
  {
    media: "ATMOS NZ",
    label: "INSTAGRAM",
    href: links.instagram,
    Icon: FaInstagram,
    image: "/socials/instagram.png",
    description: "Latest drops, artists, and behind-the-scenes.",
    username: "@atmos.nz",
    color: "#E1306C",
  },
  {
    media: "ATMOS TV",
    label: "TIKTOK",
    href: links.tiktok,
    Icon: FaTiktok,
    image: "/socials/tiktok.png",
    description: "Fast cuts, live moments, and trends.",
    username: "@atmos_tv",
    color: "#00F2EA",
  },
  {
    media: "ATMOS TV",
    label: "YOUTUBE",
    href: links.youtube,
    Icon: FaYoutube,
    image: "/socials/youtube.png",
    description: "Sets, recaps, and long-form visuals.",
    username: "@ATMOS_TV",
    color: "#FF0000",
  },
  {
    media: "ATMOS NZ",
    label: "FACEBOOK",
    href: links.facebook,
    Icon: FaFacebook,
    image: "/socials/facebook.png",
    description: "Announcements and community updates.",
    username: "atmos.nz",
    color: "#1877F2",
  },
  {
    media: "ATMOS NZ",
    label: "SOUNDCLOUD",
    href: links.soundcloud,
    Icon: FaSoundcloud,
    image: "/socials/soundcloud.png",
    description: "Mixes and exclusive audio.",
    username: "atmosmedia",
    color: "#FF5500",
  },
  {
    media: "ATMOS NZ",
    label: "SPOTIFY",
    href: links.spotify,
    Icon: FaSpotify,
    image: "/socials/spotify.png",
    description: "Playlists and curated sounds.",
    username: "ATMOS",
    color: "#1DB954",
  },
];

export default function SocialsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <StaticBackground imageSrc="/home/CAGED 2-95.jpg" />

      <section className="relative z-10 min-h-screen px-4 py-16 sm:py-24">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <AnimatedPageHeader
            title="FOLLOW ATMOS"
            subtitle="One presence across every platform"
          />

          {/* Social Cards Vertical Stack */}
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            {socialLinks.map((social, index) => (
              <SocialCard key={social.label} social={social} index={index} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function SocialCard({ social, index }: { social: SocialLink; index: number }) {
  const { media, label, href, Icon, image, description, username, color } = social;

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
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <AccentGlowCard>
          {/* Logo in top-right corner */}
          <div className="absolute top-6 right-6">
            {image && <Image src={image} alt={label} width={80} height={80} />}
            {!image && (
              <Icon className="h-16 w-16 md:h-20 md:w-20" style={{ color }} />
            )}
          </div>

          {/* Content on the left */}
          <div className="pr-24 md:pr-32">
            {/* ATMOS SELECTS */}
            <h3 className="mb-1 text-sm font-black tracking-wider text-white uppercase">
              {media}
            </h3>

            {/* Platform name with date */}
            <div className="mb-3 flex items-baseline gap-2">
              <h4
                className="text-xl font-black tracking-wider uppercase md:text-2xl"
                style={{ color }}
              >
                {label}
              </h4>
            </div>

            {/* Description */}
            <p className="text-sm leading-relaxed text-white/90">
              {description}
            </p>
          </div>
        </AccentGlowCard>
      </Link>
    </motion.div>
  );
}
