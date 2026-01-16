import { motion, type MotionProps } from "motion/react";
import * as React from "react";

import { cn } from "~/lib/utils";

type AccentGlowCardProps = {
  className?: string;
  motionProps?: MotionProps;
  innerClassName?: string;
  children: React.ReactNode;
};

export function AccentGlowCard({
  className,
  motionProps,
  innerClassName,
  children,
  ...props
}: AccentGlowCardProps) {
  return (
    <motion.div {...motionProps}
      className={cn(
        "flex",
        className,
      )}>

      <div
        className={cn(
          [
            // Layout + surface
            "group border-accent-strong/80 relative overflow-hidden rounded-none border-2 bg-black/80 backdrop-blur-sm",
            "transition-all",
            "p-6",
            // Hover treatment
            "hover:border-accent-muted hover:bg-black/90",
            // Soft glow that increases on hover (uses CSS var from globals.css)
            // "before:pointer-events-none before:absolute before:inset-[-35%] before:content-['']",
            // "before:bg-[radial-gradient(circle_at_center,var(--accent-muted)_0%,transparent_60%)] before:blur-3xl",
            // "before:opacity-[0.10] before:transition-opacity before:duration-300 group-hover:before:opacity-[0.22]",
            // Accent side line (grows on hover)
            // "after:pointer-events-none after:absolute after:left-0 after:top-0 after:h-full after:w-1 after:content-['']",
            // "after:bg-accent-strong after:transition-all after:duration-300 group-hover:after:w-2",
            // Small glow bump on hover
            "shadow-[0_0_4px_1px_var(--accent-muted)] hover:shadow-[0_0_15px_3px_var(--accent-muted)]",

            "size-full",
            innerClassName,
          ].join(" "),
          // className,
        )}
        {...props}
      >

        <div className="bg-accent-strong/80 group-hover:bg-accent-muted absolute top-0 left-0 h-full w-1 transition-all group-hover:w-2" />

        {children}

      </div>
    </motion.div>
  );
}
