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
} from "react-icons/fa6";
import { useState } from "react";
import { cn } from "~/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

type Item = {
  label: string;
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>;
};

const items: Item[] = [
  { label: "Instagram", href: "https://instagram.com/atmos_wlg", Icon: FaInstagram },
  { label: "Facebook", href: "https://facebook.com/atmos.nz", Icon: FaFacebook },
  { label: "TikTok", href: "https://tiktok.com/@atmos_tv ", Icon: FaTiktok },
  { label: "YouTube", href: "https://youtube.com/@ATMOS_TV", Icon: FaYoutube },
  { label: "Soundcloud", href: "https://soundcloud.com/atmosmedia ", Icon: FaSoundcloud },
  { label: "Spotify", href: "https://open.spotify.com/user/31zgkcouzyfpwhb3pfixdpvlfaom?si=a7f5f0fae13e4b1b ", Icon: FaSpotify },
];


export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Social links" className={cn("grid grid-cols-1 gap-0 fixed left-3 top-3 z-20", className)}>
      {items.map(({ label, href, Icon }, index) => (
        <ShrinkingCircleItem key={label} label={label} href={href} Icon={Icon} index={index} />
      ))}
    </nav>
  );
}

function ShrinkingCircleItem({
  label,
  href,
  Icon,
  index,
}: {
  label: string;
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);

  // Extract URL without protocol
  const displayUrl = href.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-label={label}
          className={`group relative grid h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 lg:h-16 lg:w-16 place-items-center border-2 border-white/80 ${index != 0 && "border-t-0"} isolate select-none`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
        >
          {/* Base square */}
          <motion.div className="absolute inset-0"
            initial={{ background: `radial-gradient(circle at center, transparent 100%, white 100%, white 100%)` }}
            animate={{ background: hovered ? `radial-gradient(circle at center, transparent 0%, white 0%, white 100%)` : `radial-gradient(circle at center, transparent 100%, white 100%, white 100%)` }}
            transition={{ duration: .5, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* White overlay circle */}
          {/* <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={false}
          animate={{}}
        >
          <motion.div
            className="bg-white rounded-full"
            style={{ width: "140%", height: "140%" }}
            animate={{ scale: hovered ? 0 : 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </motion.div> */}

          <Icon className="relative z-10 size-6 sm:size-7 md:size-8 lg:size-10 text-black transition-all duration-300 group-hover:scale-125 grayscale invert mix-blend-difference" />
          <span className="sr-only">{label}</span>

        </Link>
      </TooltipTrigger>
      <TooltipContent
        side="right"
      >
        <div className="flex flex-col gap-0.5">
          <div className="font-semibold text-sm">{label}</div>
          <div className="text-xs text-black/50">{displayUrl}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}