"use client";

import Image from "next/image";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { SocialPlatform } from "~/lib/social-pills";

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
};

export function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "h-8 w-8",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </Button>
  );
}

export function ToolbarSeparator() {
  return <span className="bg-border mx-1 h-6 w-px" aria-hidden />;
}

export function PlatformIcon({
  platform,
  size = 16,
  className,
}: {
  platform: SocialPlatform;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={platform.iconSrc}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
