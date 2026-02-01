"use client";

import Link from "next/link";
import Image from "next/image";
import { StaticBackground } from "~/components/static-background";
import { motion } from "motion/react";
import { AnimatedPageHeader } from "~/components/animated-page-header";

type SocialLink = {
  label: string;
  href: string;
  image: string;
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
    label: "INSTAGRAM",
    href: links.instagram,
    image: "/socials/instagram.png",
    username: "@atmos.nz",
    color: "#E1306C",
  },
  {
    label: "TIKTOK",
    href: links.tiktok,
    image: "/socials/tiktok.png",
    username: "@atmos_tv",
    color: "#00F2EA",
  },
  {
    label: "YOUTUBE",
    href: links.youtube,
    image: "/socials/youtube.png",
    username: "@ATMOS_TV",
    color: "#FF0000",
  },
  {
    label: "FACEBOOK",
    href: links.facebook,
    image: "/socials/facebook.png",
    username: "atmos.nz",
    color: "#1877F2",
  },
  {
    label: "SOUNDCLOUD",
    href: links.soundcloud,
    image: "/socials/soundcloud.png",
    username: "atmosmedia",
    color: "#FF5500",
  },
  {
    label: "SPOTIFY",
    href: links.spotify,
    image: "/socials/spotify.png",
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
            title="SOCIALS"
            subtitle="One presence across every platform"
          />

          {/* Social Links Grid */}
          <div className="mt-12 grid grid-cols-2 gap-8 sm:grid-cols-3 md:gap-12">
            {socialLinks.map((social, index) => (
              <SocialItem key={social.label} social={social} index={index} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function SocialItem({ social, index }: { social: SocialLink; index: number }) {
  const { label, href, image, username, color } = social;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative"
    >
      {/* Radial blur behind everything */}
      <RadialBlur />

      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative z-10 flex flex-col items-center text-center"
      >
        {/* Image */}
        <Image
          src={image}
          alt={label}
          width={64}
          height={64}
          className="mb-3 h-12 w-12 object-contain transition-transform duration-300 group-hover:scale-110 sm:h-14 sm:w-14 md:h-16 md:w-16"
        />

        {/* Platform Name */}
        <h3
          className="text-sm font-black tracking-wider uppercase sm:text-base"
          style={{ color }}
        >
          {label}
        </h3>

        {/* Handle */}
        <p className="mt-1 text-xs text-white/70 sm:text-sm">{username}</p>
      </Link>
    </motion.div>
  );
}

function RadialBlur() {
  // Gradual blur layers - strongest in center, fading to zero at edges
  // Each layer covers from center to its outer edge, with decreasing blur
  const layers = [
    { blur: 16, outer: 20 },
    { blur: 12, outer: 30 },
    { blur: 8, outer: 40 },
    { blur: 5, outer: 50 },
    { blur: 3, outer: 60 },
    { blur: 1.5, outer: 75 },
    { blur: 0.5, outer: 90 },
  ];

  return (
    <div className="pointer-events-none absolute -inset-16 sm:-inset-20 md:-inset-24">
      {layers.map((layer, i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            zIndex: layers.length - i,
            backdropFilter: `blur(${layer.blur}px)`,
            WebkitBackdropFilter: `blur(${layer.blur}px)`,
            mask: `radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${layer.outer * 0.6}%, rgba(0,0,0,0) ${layer.outer}%)`,
            WebkitMask: `radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${layer.outer * 0.6}%, rgba(0,0,0,0) ${layer.outer}%)`,
          }}
        />
      ))}
    </div>
  );
}
