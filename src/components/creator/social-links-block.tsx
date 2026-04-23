"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  resolveSocialPlatform,
  type SocialPlatform,
} from "~/lib/social-pills";
import { type PublicSocial } from "./block-renderer";

type Props = {
  socials: PublicSocial[];
  accent?: string | null;
};

export function SocialLinksBlock({ socials, accent }: Props) {
  if (!socials || socials.length === 0) {
    return (
      <span className="text-muted-foreground text-sm">
        No socials configured
      </span>
    );
  }

  const accentStyle: React.CSSProperties = accent
    ? ({ ["--social-accent" as string]: accent } as React.CSSProperties)
    : {};

  return (
    <div
      className="flex h-full w-full flex-wrap content-start gap-2"
      style={accentStyle}
    >
      {socials.map((s, i) => {
        const platform = resolveSocialPlatform(s.platform, s.url);
        return (
          <SocialChip
            key={`${s.platform}-${s.url}-${i}`}
            platform={platform}
            social={s}
          />
        );
      })}
    </div>
  );
}

function SocialChip({
  platform,
  social,
}: {
  platform: SocialPlatform | null;
  social: PublicSocial;
}) {
  const name = platform?.name ?? social.platform ?? "Link";
  const subtitle =
    social.label && social.label !== name ? social.label : handleFrom(platform, social.url);

  return (
    <Link
      href={social.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${name}${subtitle ? ` — ${subtitle}` : ""}`}
      className="group bg-card/60 hover:bg-card relative flex min-w-0 items-center gap-2.5 overflow-hidden rounded-full border pr-3 pl-1.5 py-1.5 text-sm transition-all  hover:shadow-md focus-visible:ring-2 focus-visible:ring-(--social-accent,currentColor) focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(120px 60px at var(--x, 50%) 50%, color-mix(in oklch, var(--social-accent, var(--foreground)) 14%, transparent), transparent 70%)",
        }}
      />
      <span className="bg-background/90 relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10">
        {platform ? (
          <Image
            src={platform.iconSrc}
            alt=""
            width={28}
            height={28}
            className="size-5 object-contain"
          />
        ) : (
          <ExternalLink className="text-muted-foreground size-3.5" />
        )}
      </span>
      <span className="relative flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13px] font-semibold">{name}</span>
        {subtitle && (
          <span className="text-muted-foreground truncate text-[11px] font-medium">
            {subtitle}
          </span>
        )}
      </span>
    </Link>
  );
}

function handleFrom(platform: SocialPlatform | null, url: string): string {
  if (!platform) {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }
  const handle = platform.extractHandle(url);
  if (handle) {
    return platform.supportsHandleInput ? `@${handle}` : handle;
  }
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
