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
 * ticket/buy moments, `outline` and `glass` are secondary (glass only over
 * imagery). `block` is the hard-edged full-width bar used at the foot of cards.
 */
export const buttonVariants = cva(
  "mx-label inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-[background-color,color,border-color,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        solid: "rounded-full bg-white text-black hover:bg-white/85",
        accent:
          "rounded-full bg-[var(--mx-accent)] text-[var(--mx-accent-ink)] hover:brightness-110",
        outline:
          "rounded-full border border-white/40 text-white hover:border-white hover:bg-white/5",
        glass: "mx-glass rounded-full text-white hover:bg-white/15",
        ghost: "rounded-full text-white/70 hover:text-white",
        block:
          "w-full rounded-none bg-white text-black hover:bg-[var(--mx-accent)] hover:text-[var(--mx-accent-ink)]",
      },
      size: {
        sm: "h-8 px-4 text-[10px]",
        md: "h-11 px-6 text-[12px]",
        lg: "h-14 px-9 text-[15px]",
      },
    },
    defaultVariants: { variant: "solid", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type="button"
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
        "mx-glass inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:opacity-35",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Poster/photo with hard edges. Radius is applied by the caller, never here. */
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

const subscribeToSeconds = (onTick: () => void) => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
};

/** Seconds-resolution countdown. Null on the server and first paint so the
 *  server and client clocks never disagree during hydration. */
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

// ---------------------------------------------------------------------------
// Board chrome: labels for the mock sheet itself, not part of the system.

export function BoardSection({
  id,
  title,
  note,
  children,
  className,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-20 border-t border-white/10", className)}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 px-5 pt-16 pb-8 md:px-10">
        <h2 className="mx-display text-[clamp(1.75rem,3.2vw,3rem)]">{title}</h2>
        {note ? (
          <p className="max-w-[52ch] text-sm text-white/55">{note}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** Tag identifying a variant on the board, e.g. "A · Split". */
export function VariantTag({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mb-3 px-5 font-mono text-[11px] tracking-wide text-white/45 uppercase md:px-10",
        className,
      )}
    >
      {children}
    </p>
  );
}
