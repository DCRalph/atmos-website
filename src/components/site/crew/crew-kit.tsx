"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FaInstagram, FaSoundcloud } from "react-icons/fa6";
import type { ResolvedCrewDisplay } from "~/lib/crew-display";
import { cn } from "~/lib/utils";
import { Media } from "../ui";

/** Member photo with hard edges, or their initial when there's no photo. */
export function Portrait({
  member,
  className,
  sizes,
  priority,
}: {
  member: ResolvedCrewDisplay;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (member.image)
    return (
      <Media
        src={member.image}
        alt={member.name}
        sizes={sizes}
        className={className}
        priority={priority}
      />
    );
  return (
    <div
      role="img"
      aria-label={member.name}
      className={cn(
        "@container flex items-center justify-center overflow-hidden bg-white/[0.06]",
        className,
      )}
    >
      <span className="t-display text-[40cqw] text-white/45">
        {member.name.trim().slice(0, 1).toUpperCase() || "?"}
      </span>
    </div>
  );
}

const iconLink =
  "flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-white hover:text-white";

/** Instagram, SoundCloud and, when their artist profile is published, a link to it. */
export function MemberLinks({
  member,
  className,
}: {
  member: ResolvedCrewDisplay;
  className?: string;
}) {
  if (!member.instagram && !member.soundcloud && !member.profileHandle)
    return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {member.instagram ? (
        <a
          href={member.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${member.name} on Instagram`}
          className={iconLink}
        >
          <FaInstagram className="size-4" />
        </a>
      ) : null}
      {member.soundcloud ? (
        <a
          href={member.soundcloud}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${member.name} on SoundCloud`}
          className={iconLink}
        >
          <FaSoundcloud className="size-4" />
        </a>
      ) : null}
      {member.profileHandle ? (
        <Link
          href={`/@${member.profileHandle}`}
          className="t-label inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[10px] text-black transition-colors hover:bg-[var(--site-accent)] hover:text-[var(--site-accent-ink)]"
        >
          View profile <ArrowUpRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
