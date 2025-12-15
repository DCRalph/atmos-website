"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  FaSpotify,
  FaYoutube,
  FaInstagram,
  FaTiktok,
  FaFacebook,
  FaSoundcloud,
  FaPlus,
} from "react-icons/fa6";
import { useState } from "react";
import { cn } from "~/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { orbitron } from "~/lib/fonts";

type ColorConfig =
  | string // Single color
  | { type: "gradient"; colors: string[]; angle?: number } // Gradient
  | { type: "multi"; colors: string[] }; // Multiple colors

type Item = {
  label: string;
  href: string;
  Icon: React.ComponentType<
    React.SVGProps<SVGSVGElement> & { size?: number }
  >;
  color?: ColorConfig;
};

const items: Item[] = [
  { label: "All Socials", href: "/socials/", Icon: FaPlus },
  {
    label: "Instagram",
    href: "https://instagram.com/atmos.nz",
    Icon: FaInstagram,
    color: {
      type: "gradient",
      colors: ["#833AB4", "#FD1D1D", "#FCB045"],
      angle: 45,
    },
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@atmos_tv",
    Icon: FaTiktok,
    color: {
      type: "multi",
      colors: ["#000000", "#FF0050"],
    },
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@ATMOS_TV",
    Icon: FaYoutube,
    color: "#FF0000",
  },
  // {
  //   label: "Facebook",
  //   href: "https://facebook.com/atmos.nz",
  //   Icon: FaFacebook,
  //   color: "#1877F2",
  // },
  // {
  //   label: "Soundcloud",
  //   href: "https://soundcloud.com/atmosmedia",
  //   Icon: FaSoundcloud,
  //   color: "#FF3300",
  // },
  // {
  //   label: "Spotify",
  //   href: "https://open.spotify.com/user/31zgkcouzyfpwhb3pfixdpvlfaom?si=a7f5f0fae13e4b1b",
  //   Icon: FaSpotify,
  //   color: "#1DB954",
  // },
];

export function SocialLinks({ className = "", side = "left" }: { className?: string, side?: "left" | "right" }) {
  return (
    <nav
      aria-label="Social links"
      className={cn(
        "absolute bottom-2 sm:bottom-6 z-30 transition-all duration-300",
        `${side === "left" ? "left-2 sm:left-6 " : "right-2 sm:right-6 "}`,
        "grid grid-cols-1",
        // "sm:gap-2",
        "gap-2",
        className
      )}
    >
      {items.map(({ label, href, Icon, color }, index) => (
        <SocialItem
          key={label}
          label={label}
          href={href}
          Icon={Icon}
          color={color}
          index={index}
        />
      ))}
    </nav>
  );
}

function SocialItem({
  label,
  href,
  Icon,
  color,
  index,
}: {
  label: string;
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color?: ColorConfig;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);

  const isPrimary = index === 0;

  // Get gradient string
  const getGradient = (config: ColorConfig): string | null => {
    if (typeof config === "string") return null;
    if (config.type === "gradient") {
      const angle = config.angle ?? 45;
      return `linear-gradient(${angle}deg, ${config.colors.join(", ")})`;
    }
    return null;
  };

  // Get glow color for drop shadow
  const getGlowColor = (config?: ColorConfig): string => {
    if (!config) return "rgba(0,0,0,0.4)";
    if (typeof config === "string") return config;
    if (config.type === "gradient") {
      // Use middle color for glow
      return config.colors[Math.floor(config.colors.length / 2)] ?? config.colors[0] ?? "#000000";
    }
    // For multi-color, use second color or first
    return config.colors[1] ?? config.colors[0] ?? "#000000";
  };

  // Get icon style
  const getIconStyle = (config?: ColorConfig, isHovered?: boolean) => {
    if (!isHovered || !config) {
      return isPrimary
        ? { color: "currentColor" }
        : { color: "currentColor", opacity: 0.8 };
    }

    if (typeof config === "string") {
      return { color: config };
    }

    if (config.type === "gradient") {
      return {
        background: getGradient(config),
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    }

    // For multi-color TikTok, use second color (pink) for icon
    return { color: config.colors[1] ?? config.colors[0] ?? "#FFFFFF" };
  };

  const glowColor = getGlowColor(color);

  const displayUrl =
    href.startsWith("http") || href.startsWith("www")
      ? href.replace(/^https?:\/\//, "").replace(/\/$/, "")
      : "View all socials";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          className="relative flex items-center justify-center"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          whileHover={{ scale: 1.08 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
          }}
        >
          {/* Glow only on hover */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: hovered ? 1 : 0,
              scale: hovered ? 1.35 : 0.9,
              filter: hovered
                ? `drop-shadow(0 0 8px ${glowColor})`
                : "drop-shadow(0 0 4px rgba(0,0,0,0.2))",
            }}
            transition={{
              duration: 0.22,
              ease: [0.22, 1, 0.36, 1],
            }}
          />

          <Link
            href={href}
            aria-label={label}
            className={cn(
              "relative flex items-center justify-center",
              // "size-8 sm:size-10",
              "size-10",
              "text-black/80 dark:text-white/80",
              "transition-colors duration-200",
              "hover:text-black dark:hover:text-white"
            )}
          >
            <Icon
              className={cn(
                // "size-5 sm:size-6 md:size-7",
                "size-8",
                "transition-all duration-200"
              )}
            />
            <span className="sr-only">{label}</span>
          </Link>
        </motion.div>
      </TooltipTrigger>

      <TooltipContent
        side="left"
      >
        <div className="flex flex-col leading-tight">
          <span className={`font-semibold tracking-wide uppercase ${orbitron.className}`}>
            {label}
          </span>
          {/* <span className="text-[9px] text-black/55">{displayUrl}</span> */}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}