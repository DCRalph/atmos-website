"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { LexicalContent } from "~/components/lexical";
import { SoundCloudPlayer } from "~/components/soundcloud-player";
import { YouTubePlayer } from "~/components/youtube-player";
import { Lightbox, useLightbox } from "~/components/site/overlays";
import type { ProfileSection } from "~/lib/artist-sections";
import { LinkRows, Photo, socialMeta } from "./parts";
import type { PublicProfile } from "./types";

type Of<T extends ProfileSection["type"]> = Extract<
  ProfileSection,
  { type: T }
>;

/**
 * How a layout draws the two sections built from the artist's lineups. The
 * rest of the section types look the same in every layout.
 */
export type GigSectionRenderers = {
  upcoming: (props: {
    section: Of<"GIG_LIST">;
    profile: PublicProfile;
  }) => ReactNode;
  past: (props: {
    section: Of<"PAST_GIGS">;
    profile: PublicProfile;
  }) => ReactNode;
};

/** The DOM id of a section, for in-page links and the Stage tabs. */
export const sectionAnchor = (section: Pick<ProfileSection, "id">) =>
  `s-${section.id}`;

/**
 * Everything below a layout's hero, in the artist's order. `inset` is the
 * horizontal padding of the layout's content column; sections that bleed to
 * the edge (carousels, sticky bars) undo it themselves.
 */
export function ProfileSections({
  profile,
  gigs,
  accent,
  tone,
  className,
}: {
  profile: PublicProfile;
  gigs: GigSectionRenderers;
  accent: string;
  tone: "dark" | "light";
  className?: string;
}) {
  if (!profile.sections.length) return null;
  return (
    <div className={cn("flex flex-col gap-10 md:gap-14", className)}>
      {profile.sections.map((section, i) => (
        <div
          key={section.id}
          id={sectionAnchor(section)}
          className={cn(
            "min-w-0 scroll-mt-36",
            // More room above a heading than below it.
            section.type === "HEADING" && i > 0 && "mt-6 md:mt-12",
          )}
        >
          <Section
            section={section}
            profile={profile}
            gigs={gigs}
            accent={accent}
            tone={tone}
          />
        </div>
      ))}
    </div>
  );
}

function Section({
  section,
  profile,
  gigs,
  accent,
  tone,
}: {
  section: ProfileSection;
  profile: PublicProfile;
  gigs: GigSectionRenderers;
  accent: string;
  tone: "dark" | "light";
}) {
  switch (section.type) {
    case "HEADING":
      return <Heading section={section} />;
    case "RICH_TEXT":
      return (
        <div className="cp-prose max-w-[65ch]">
          <LexicalContent
            value={section.lexical}
            namespace={`artist-section-${section.id}`}
            contentClassName="break-words !whitespace-normal"
          />
        </div>
      );
    case "IMAGE":
      return (
        <div className="cp-photo max-w-[1100px] overflow-hidden rounded-[var(--cp-r-media)]">
          <Image
            src={section.src}
            alt={section.alt}
            width={1600}
            height={1067}
            sizes="(min-width: 1024px) 70vw, 100vw"
            unoptimized={section.src.endsWith(".gif")}
            className="block h-auto max-h-[85vh] w-full object-cover"
          />
        </div>
      );
    case "GALLERY":
      return <Gallery srcs={section.srcs} name={profile.name} />;
    case "SOUNDCLOUD_TRACK":
    case "SOUNDCLOUD_PLAYLIST":
      return (
        <div className="max-w-[1100px] overflow-hidden rounded-[var(--cp-r-media)]">
          <SoundCloudPlayer
            url={section.url}
            size={section.type === "SOUNDCLOUD_PLAYLIST" ? "square" : "default"}
            params={{ color: accent.replace("#", ""), visual: true }}
          />
        </div>
      );
    case "YOUTUBE_VIDEO":
      return (
        <div className="max-w-[1100px] overflow-hidden rounded-[var(--cp-r-media)]">
          <YouTubePlayer
            videoId={section.videoId}
            title={`${profile.name} video`}
          />
        </div>
      );
    case "SPOTIFY_EMBED":
      return (
        <iframe
          title={`${profile.name} on Spotify`}
          src={
            tone === "dark" ? withParam(section.src, "theme", "0") : section.src
          }
          height={section.tall ? 352 : 152}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="block w-full max-w-[1100px] rounded-[12px]"
        />
      );
    case "SOCIAL_LINKS":
      return (
        <LinkRows
          links={profile.socials.map((s) => {
            const { name, handle } = socialMeta(s);
            return {
              label: name,
              detail: handle ? `@${handle}` : null,
              url: s.url,
            };
          })}
          className="max-w-[1100px]"
        />
      );
    case "LINK_LIST":
      return <LinkRows links={section.links} className="max-w-[1100px]" />;
    case "GIG_LIST":
      return gigs.upcoming({ section, profile });
    case "PAST_GIGS":
      return gigs.past({ section, profile });
    case "DIVIDER":
      return <hr className="border-[var(--cp-line)]" />;
    case "SPACER":
      return <div aria-hidden className="h-8 md:h-16" />;
    case "CUSTOM_EMBED":
      return (
        <iframe
          title="Embedded content"
          src={section.url}
          allow="autoplay; encrypted-media; picture-in-picture"
          loading="lazy"
          className="block aspect-video w-full max-w-[1100px] rounded-[var(--cp-r-media)] bg-[var(--cp-raised)]"
        />
      );
  }
}

const headingSizes = {
  1: "text-[clamp(2.75rem,8vw,6rem)]",
  2: "text-[clamp(2.25rem,6vw,4.75rem)]",
  3: "text-[clamp(1.75rem,4vw,3rem)]",
  4: "text-[clamp(1.25rem,2.6vw,2rem)]",
} as const;

function Heading({ section }: { section: Of<"HEADING"> }) {
  // The artist's level 1 is still a section heading: the page's h1 is their name.
  const Tag = section.level <= 2 ? "h2" : section.level === 3 ? "h3" : "h4";
  return (
    <Tag
      className={cn(
        "cp-display [overflow-wrap:anywhere]",
        headingSizes[section.level],
        section.align === "center" && "text-center",
        section.align === "right" && "text-right",
      )}
    >
      {section.text}
    </Tag>
  );
}

/** First photo large, the rest beside it; any photo opens the lightbox. */
function Gallery({ srcs, name }: { srcs: string[]; name: string }) {
  const lightbox = useLightbox();
  const images = srcs.map((src, i) => ({
    src,
    alt: `${name}, photo ${i + 1} of ${srcs.length}`,
  }));
  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {images.map((img, i) => (
          <button
            key={`${img.src}-${i}`}
            type="button"
            onClick={() => lightbox.open(i)}
            aria-label={`Open ${img.alt}`}
            className={cn(
              "group relative overflow-hidden rounded-[var(--cp-r-media)]",
              i === 0 && srcs.length > 2
                ? "col-span-2 aspect-[3/2] md:row-span-2 md:aspect-auto"
                : "aspect-[3/2]",
            )}
          >
            <Photo
              src={img.src}
              alt=""
              sizes={i === 0 ? "50vw" : "25vw"}
              className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>
      <Lightbox images={images} {...lightbox.props} />
    </>
  );
}

function withParam(src: string, key: string, value: string) {
  const url = new URL(src);
  url.searchParams.set(key, value);
  return url.toString();
}
