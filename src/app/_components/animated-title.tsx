"use client";

import { useEffect, useMemo, useState } from "react";
import { Anton, Bebas_Neue, Oswald, Playfair_Display, Orbitron } from "next/font/google";

const anton = Anton({ weight: "400", subsets: ["latin"] });
const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"] });
const oswald = Oswald({ weight: "700", subsets: ["latin"] });
const playfair = Playfair_Display({ weight: "700", subsets: ["latin"] });
const orbitron = Orbitron({ weight: "700", subsets: ["latin"] });

type Variant = "solid" | "outline";

type StyleConfig = {
  fontClass: string;
  italic: boolean;
  glow: boolean;
  variant: Variant;
  color: string;
};

const NEON_COLORS = [
  "#39ff14", // neon green
  "#00ffff", // cyan
  "#ff00ff", // magenta
  "#ffff00", // yellow
  "#00b3ff", // neon blue
  "#ff073a", // neon red
  "#ff2dfc", // hot pink
];

export function AnimatedTitle({ text = "ATMOS", intervalMs = 1600 }: { text?: string; intervalMs?: number }) {
  const styles = useMemo<StyleConfig[]>(
    () => [
      // { fontClass: anton.className, italic: false, variant: "solid", color: NEON_COLORS[0]! },
      { fontClass: bebas.className + " tracking-widest", italic: false, variant: "outline", color: NEON_COLORS[2]!, glow: true },
      // { fontClass: oswald.className, italic: true, variant: "solid", color: NEON_COLORS[4]! },
      { fontClass: playfair.className, italic: true, variant: "outline", color: NEON_COLORS[1]!, glow: true },
      { fontClass: orbitron.className, italic: false, variant: "solid", color: NEON_COLORS[3]!, glow: true },
      { fontClass: anton.className + " tracking-widest", italic: false, variant: "outline", color: "#ffffff", glow: false },
    ],
    []
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % styles.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [styles.length, intervalMs]);

  const { fontClass, italic, variant, color, glow } = styles[index]!;

  const commonShadow = `${color} 0 0 12px, ${color} 0 0 28px`;
  const style: React.CSSProperties =
    variant === "outline"
      ? {
        color: "transparent",
        WebkitTextStrokeWidth: 2,
        WebkitTextStrokeColor: color,
        // textShadow: commonShadow,
        ...(glow && {
          textShadow: commonShadow,
        }),
      }
      : {
        color,
        // textShadow: commonShadow,
        ...(glow && {
          textShadow: commonShadow,
        }),
      };

  return (
    <h1
      className={`${fontClass} ${italic ? "italic" : ""} select-none text-6xl font-extrabold leading-none tracking-tight md:text-8xl`}
      style={style}
    >
      {text}
    </h1>
  );
}


