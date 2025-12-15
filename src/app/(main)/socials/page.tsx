"use client";

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
import { cn } from "~/lib/utils";

type SocialLink = {
  label: string;
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  description?: string;
  accent: string;
  platform: 'instagram' | 'tiktok' | 'default';
};

const socialLinks: SocialLink[] = [
  {
    label: "Instagram",
    href: "https://instagram.com/atmos.nz",
    Icon: FaInstagram,
    description: "Latest drops, artists, and behind-the-scenes.",
    accent: "bg-[#F56040]",
    platform: "instagram",
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@atmos_tv",
    Icon: FaTiktok,
    description: "Fast cuts, live moments, and trends.",
    accent: "bg-[#FF0050]",
    platform: "tiktok",
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@ATMOS_TV",
    Icon: FaYoutube,
    description: "Sets, recaps, and long-form visuals.",
    accent: "bg-[#FF0000]",
    platform: "default",
  },
  {
    label: "Facebook",
    href: "https://facebook.com/atmos.nz",
    Icon: FaFacebook,
    description: "Announcements and community updates.",
    accent: "bg-[#1877F2]",
    platform: "default",
  },
  {
    label: "SoundCloud",
    href: "https://soundcloud.com/atmosmedia",
    Icon: FaSoundcloud,
    description: "Mixes and exclusive audio.",
    accent: "bg-[#FF5500]",
    platform: "default",
  },
  {
    label: "Spotify",
    href: "https://open.spotify.com/user/31zgkcouzyfpwhb3pfixdpvlfaom?si=a7f5f0fae13e4b1b",
    Icon: FaSpotify,
    description: "Playlists and curated sounds.",
    accent: "bg-[#1DB954]",
    platform: "default",
  },
];

export default function SocialsPage() {
  return (
    <main className="bg-black text-white">
      <StaticBackground imageSrc="/home/CAGED 2-95.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-16 sm:py-24">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white/90">
              FOLLOW ATMOS
            </h1>
            <p className="mt-4 text-sm sm:text-base text-white/60">
              One presence across every platform. Same energy, different formats.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {socialLinks.map((social, index) => (
              <SocialCard key={social.label} social={social} index={index} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function SocialCard({
  social,
  index,
}: {
  social: SocialLink;
  index: number;
}) {
  const { label, href, Icon, description, accent, platform } = social;

  const softWhiteGlow = "0 0 26px rgba(255,255,255,0.36)";

  const displayUrl = href
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^www\./, "");

  // Instagram gradient
  const instagramGradient = "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)";

  // TikTok colors
  const tiktokPink = "#FE2C55";
  const tiktokBlue = "#25F4EE";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group block h-full"
      >
        <div className="relative h-full rounded-2xl px-5 py-5 sm:px-6 sm:py-6 bg-white/3 backdrop-blur-md border border-white/6 transition-all duration-300 hover:border-white/14 hover:-translate-y-1 hover:shadow-[0_18px_60px_rgba(0,0,0,0.6)] overflow-hidden">

          {/* Instagram hover background */}
          {platform === "instagram" && (
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: instagramGradient }}
            >
              <div className="absolute inset-0 bg-black/20 rounded-2xl" />
            </div>
          )}

          {/* TikTok hover background - 2-tone split */}
          {platform === "tiktok" && (
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
              {/* Pink half */}
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: `linear-gradient(45deg, ${tiktokPink} 0%, ${tiktokPink} 50%, ${tiktokBlue} 50%, ${tiktokBlue} 100%)`,
                }}
              />
              <div className="absolute inset-0 bg-black/15 rounded-2xl" />
            </div>
          )}

          {/* Default hover background */}
          {platform === "default" && (
            <div
              className={cn("absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300", accent)}
            />
          )}

          {/* Top subtle divider */}
          <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent opacity-40" />

          <div className="relative z-10 flex flex-col items-start gap-3">
            {/* Icon + glow */}
            <div className="relative">
              {/* Glow halo centered on icon */}
              <motion.div
                className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
                initial={{ opacity: 0, scale: 0.5 }}
                whileHover={{
                  opacity: 1,
                  scale: 1.15,
                  // boxShadow: platform === "default" ? `${softWhiteGlow}, ${accentGlow}` : "0 0 20px rgba(255,255,255,0.4)",
                  backgroundColor: "rgba(255,255,255,0.06)",
                }}
                transition={{
                  duration: 0.22,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/2 border border-white/14 transition-all duration-300 group-hover:bg-white/5 group-hover:border-white/40"
                style={{
                  boxShadow: "0 0 14px rgba(0,0,0,0.7)",
                }}
              >
                <Icon
                  className="h-5 w-5 text-white/88 transition-all duration-300 group-hover:text-white"
                />
              </div>
            </div>

            {/* Label */}
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-medium tracking-wide text-white transition-all duration-300 group-hover:drop-shadow-sm">
                {label}
              </h3>
            </div>
          </div>

          {/* Accent bottom bar on hover */}
          <motion.div
            className="pointer-events-none absolute bottom-0 left-5 right-5 h-px origin-center bg-linear-to-r from-transparent via-white/40 to-transparent opacity-0"
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </Link>
    </motion.div>
  );
}
