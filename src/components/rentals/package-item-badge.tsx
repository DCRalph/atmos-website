"use client";

import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

type PackageItemBadgeProps = {
  quantity: number;
  itemName: string;
  shortName?: string | null;
  description?: string | null;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
};

export function PackageItemBadge({
  quantity,
  itemName,
  shortName,
  description,
  variant = "outline",
  className,
}: PackageItemBadgeProps) {
  const label = `${quantity}x ${shortName ?? itemName}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className={className}>
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={8}
        className="max-w-64 rounded-xl border border-white/10 bg-black p-0 text-white shadow-2xl"
      >
        <div className="space-y-1.5 p-3.5">
          {/* <div className="text-[10px] font-semibold tracking-[0.18em] text-white/60">
            Item
          </div> */}
          <div className="text-sm font-semibold leading-tight">
            {quantity}x {itemName}
          </div>
          {shortName && shortName !== itemName && (
            <div className="text-xs text-white/70">{shortName}</div>
          )}
          {description && (
            <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs leading-relaxed text-white/80">
              {description}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
