"use client";

import Image from "next/image";
import {
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

/**
 * Pill button. `solid` is the one primary action per view, `accent` is for
 * buy moments, `outline` and `ghost` are secondary, `glass` only over imagery.
 */
export const buttonVariants = cva(
  "t-label inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-[background-color,color,border-color,opacity,filter] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        solid: "rounded-full bg-white text-black hover:bg-white/85",
        accent:
          "rounded-full bg-[var(--site-accent)] text-[var(--site-accent-ink)] hover:brightness-110",
        outline:
          "rounded-full border border-white/40 text-white hover:border-white hover:bg-white/5",
        glass: "glass rounded-full text-white hover:bg-white/15",
        ghost: "rounded-full text-white/70 hover:text-white",
      },
      size: {
        sm: "h-9 px-4 text-[10px]",
        md: "h-11 px-6 text-[12px]",
        lg: "h-14 px-9 text-[14px]",
      },
    },
    defaultVariants: { variant: "solid", size: "md" },
  },
);

export type ButtonStyleProps = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonStyleProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

/** Round icon-only control. Glass by default since it usually floats on media. */
export function IconButton({
  className,
  label,
  children,
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "glass inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:opacity-35",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Poster or photo, hard-edged. The caller sets aspect ratio and radius. */
export function Media({
  src,
  alt,
  className,
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-white/5", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={src.endsWith(".gif")}
        className="object-cover"
      />
    </div>
  );
}

export function AtmosLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo/atmos-white.png"
      alt="Atmos"
      width={5001}
      height={1120}
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}

/** Static skeleton block: the shape of what's coming, no shimmer. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("bg-white/[0.06]", className)} />;
}

const subscribeToSeconds = (onTick: () => void) => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
};

/** Seconds-resolution countdown; null on the server so hydration never disagrees. */
export function useCountdown(target: Date | null) {
  const nowSeconds = useSyncExternalStore(
    subscribeToSeconds,
    () => Math.floor(Date.now() / 1000),
    () => null,
  );
  if (!target || nowSeconds === null) return null;
  const total = Math.max(0, Math.floor(target.getTime() / 1000) - nowSeconds);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Days / hrs / min / sec as glass tiles. Only used over imagery. */
export function CountdownTiles({
  target,
  compact,
}: {
  target: Date;
  compact?: boolean;
}) {
  const t = useCountdown(target);
  const cells = [
    ["Days", t?.days],
    ["Hrs", t?.hours],
    ["Min", t?.minutes],
    ["Sec", t?.seconds],
  ] as const;
  return (
    <div
      className={cn("grid grid-cols-4", compact ? "gap-1.5" : "gap-2")}
      role="timer"
      aria-label="Time until doors"
    >
      {cells.map(([label, value], i) => (
        <div
          key={label}
          className={cn(
            "glass flex flex-col items-center justify-center rounded-xl",
            compact ? "h-16 min-w-14" : "h-24 min-w-20 md:min-w-24",
          )}
        >
          <span
            className={cn(
              "t-display tabular-nums",
              compact ? "text-2xl" : "text-4xl",
              i === 0 && "text-[var(--site-accent-text)]",
            )}
          >
            {value === undefined ? "--" : String(value).padStart(2, "0")}
          </span>
          <span
            className={cn(
              "t-label text-white/65",
              compact ? "mt-1 text-[8px]" : "mt-2 text-[10px]",
            )}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Page title block for pages without a photo hero. */
export function PageTitle({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <div className="px-5 pt-12 pb-10 md:px-10 md:pt-20 md:pb-14">
      <h1 className="t-heading text-[clamp(2.5rem,8vw,6.5rem)]">{title}</h1>
      {intro ? (
        <p className="mt-5 max-w-[52ch] text-[16px] text-white/65 md:text-[17px]">
          {intro}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** Text input style for forms on black. */
export const inputClass =
  "h-12 w-full rounded-full border border-white/15 bg-white/[0.04] px-5 text-[15px] text-white outline-none placeholder:text-white/40 hover:border-white/30 focus:border-white/60 aria-[invalid=true]:border-[var(--site-danger)]";
