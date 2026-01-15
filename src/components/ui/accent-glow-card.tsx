import * as React from "react"

import { cn } from "~/lib/utils"

type AccentGlowCardProps = React.ComponentProps<"div"> & {
  asChild?: boolean
}

export function AccentGlowCard({
  className,
  asChild = false,
  children,
  ...props
}: AccentGlowCardProps) {

  return (
    <div
      className={cn(
        [
          // Layout + surface
          "group relative overflow-hidden rounded-none border-2 border-white/10 bg-black/80 backdrop-blur-sm",
          "transition-all",
          // Hover treatment
          "hover:border-accent-muted/50 hover:bg-black/90",
          // Soft glow that increases on hover (uses CSS var from globals.css)
          // "before:pointer-events-none before:absolute before:inset-[-35%] before:content-['']",
          // "before:bg-[radial-gradient(circle_at_center,var(--accent-muted)_0%,transparent_60%)] before:blur-3xl",
          // "before:opacity-[0.10] before:transition-opacity before:duration-300 group-hover:before:opacity-[0.22]",
          // Accent side line (grows on hover)
          // "after:pointer-events-none after:absolute after:left-0 after:top-0 after:h-full after:w-1 after:content-['']",
          // "after:bg-accent-strong after:transition-all after:duration-300 group-hover:after:w-2",
          // Small glow bump on hover
          "shadow-[0_0_4px_var(--accent-muted)] hover:shadow-[0_0_15px_var(--accent-muted)]",
        ].join(" "),
        className
      )}
      {...props}
    >
      {/* <> */}
      <div className="absolute left-0 top-0 h-full w-1 bg-accent-strong transition-all group-hover:w-2" />
      {children}
      {/* </> */}
    </div>
  )
}

