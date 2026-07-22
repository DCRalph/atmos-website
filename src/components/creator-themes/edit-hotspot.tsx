"use client";

import { Pencil } from "lucide-react";
import { type ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

type Position =
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left"
  | "center";

const positionClasses: Record<Position, string> = {
  "top-right": "top-2 right-2",
  "top-left": "top-2 left-2",
  "bottom-right": "bottom-2 right-2",
  "bottom-left": "bottom-2 left-2",
  "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
};

/**
 * A small "edit" affordance placed on top of a region of the theme canvas.
 *
 * The parent region is expected to have `relative` + a `group` class (or just
 * `group`) and sized so the absolutely-positioned button sits inside it. The
 * button stays invisible until the region is hovered or receives keyboard
 * focus; once the popover is open the surrounding region keeps the button
 * visible via `group-has-[[data-state=open]]`.
 */
export function EditHotspot({
  label,
  position = "top-right",
  className,
  contentClassName,
  align = "end",
  children,
}: {
  label: string;
  position?: Position;
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(
            "absolute z-20 inline-flex h-7 w-7 items-center justify-center rounded-full",
            "bg-background/80 text-foreground backdrop-blur-sm",
            "border shadow-sm",
            "opacity-0 transition-opacity duration-150",
            "hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            "group-hover:opacity-100 group-focus-within:opacity-100",
            "data-[state=open]:opacity-100",
            positionClasses[position],
            className,
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn("w-80 space-y-3", contentClassName)}
      >
        <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
          {label}
        </div>
        {children}
      </PopoverContent>
    </Popover>
  );
}
