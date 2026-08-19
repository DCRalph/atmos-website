"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container";

const links = [
  { label: "Instagram", href: "https://instagram.com/atmos.nz", external: true },
  { label: "Gigs", href: "/gigs", external: false },
  { label: "Contact", href: "/contact", external: false },
];

// Closing section: logo over a dark photo with somewhere to go next.
export function ClosingSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { containerRef } = useMainLayoutScrollContainer();
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: ref,
    offset: ["start end", "end end"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.8], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.8], [0.85, 1]);
  const y = useTransform(scrollYProgress, [0, 0.8], [60, 0]);
  const backgroundScale = useTransform(scrollYProgress, [0, 1], [1.08, 1]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[80vh] items-center justify-center overflow-hidden border-t border-white/10"
    >
      {/* Background */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{ scale: backgroundScale }}
      >
        <motion.img
          src="/home/atmos-8.jpg"
          alt=""
          className="h-full w-full object-cover brightness-[0.15]"
          style={{ opacity }}
          crossOrigin="anonymous"
        />
      </motion.div>

      <motion.div
        className="relative z-10 flex flex-col items-center gap-10 px-6 text-center"
        style={{ scale, opacity, y }}
      >
        <Image
          src="/logo/atmos-white.png"
          alt="Atmos"
          width={200}
          height={48}
          className="h-12 w-auto md:h-16"
        />
        <div className="flex flex-wrap items-center justify-center gap-8 text-[13px] tracking-[0.15em] text-white/70 uppercase">
          {links.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="border-b border-white/30 pb-0.5 transition-colors hover:border-white hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="border-b border-white/30 pb-0.5 transition-colors hover:border-white hover:text-white"
              >
                {link.label}
              </Link>
            ),
          )}
        </div>
      </motion.div>
    </section>
  );
}
