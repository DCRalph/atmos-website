"use client";

import Image from "next/image";
import Link from "next/link";

import { SoundCloudPlayer } from "~/components/soundcloud-player";
import { YouTubePlayer } from "~/components/youtube-player";
import { type ContentItem } from "~Prisma/client";
import { cn } from "~/lib/utils";
import { AccentGlowCard } from "~/components/ui/accent-glow-card";

type ContentCardProps = {
  contentItem: ContentItem;
  featured?: boolean;
  className?: string;
};

export function ContentCard({
  contentItem,
  featured = false,
  className,
}: ContentCardProps) {
  const isSoundCloud =
    contentItem.linkType === "SOUNDCLOUD_TRACK" ||
    contentItem.linkType === "SOUNDCLOUD_PLAYLIST";
  const soundCloudUrl = contentItem.embedUrl;
  const isYouTubeVideo = contentItem.linkType === "YOUTUBE_VIDEO";
  const youtubeVideoId = contentItem.embedUrl;
  const hasFeaturedEmbed =
    featured &&
    ((isSoundCloud && soundCloudUrl) || (isYouTubeVideo && youtubeVideoId));

  return (
    <Link
      href={contentItem.link}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block",
        featured ? "col-span-full" : "col-span-full lg:col-span-1",
        className,
      )}
    >
      <AccentGlowCard
        className="cursor-pointer"
        motionProps={{
          initial: { opacity: 0, y: "200px" },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.1 },
          transition: { duration: 0.5, ease: "easeOut" },
        }}
      >

      {contentItem.platform && (
        <div className="absolute top-4 right-4">
          <PlatformIcon platform={contentItem.platform} size={48} />
        </div>
      )}

      <div className={`grid grid-cols-12 gap-6`}>
        <div
          className={cn(
            "flex h-full flex-col gap-6",
            hasFeaturedEmbed
              ? "col-span-full lg:col-span-7"
              : "col-span-full",
          )}
        >
          <div>
            <h3 className="text-xl leading-tight font-black tracking-tight text-white uppercase sm:text-3xl">
              {contentItem.title}
            </h3>
            {contentItem.platform && (
              <PlatformBadge platform={contentItem.platform} />
            )}
            <div className="text-xs font-bold tracking-wider text-white/60 uppercase">
              {contentItem.date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>

          <div>
            {contentItem.dj && (
              <h4 className="text-lg leading-tight font-black tracking-tight text-white uppercase sm:text-xl">
                {contentItem.dj}
              </h4>
            )}

            <p className="text-base font-medium text-white/60">
              {contentItem.description}
            </p>
          </div>
        </div>

        {isSoundCloud && soundCloudUrl && featured && (
          <div
            className="col-span-full lg:col-span-5 mt-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-none border-2 border-white/10 bg-black/60">
              <SoundCloudPlayer
                url={soundCloudUrl}
                size="default"
                params={{
                  auto_play: false,
                  color: "#470082",
                  buying: false,
                  sharing: false,
                  download: false,
                  show_artwork: true,
                  show_playcount: false,
                  show_user: false,
                  single_active: false,
                  visual: true,
                }}
              />
            </div>
          </div>
        )}
        {isYouTubeVideo && youtubeVideoId && featured && (
          <div
            className="col-span-full lg:col-span-5 mt-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-none border-2 border-white/10 bg-black/60">
              <YouTubePlayer
                videoId={youtubeVideoId}
                title={contentItem.title}
              />
            </div>
          </div>
        )}
      </div>

      </AccentGlowCard>
    </Link>
  );
}


const platformColorMap = {
  "Soundcloud": "text-[#ff7700]",
  "Spotify": "text-[#1DB954]",
  "YouTube": "text-[#FF0000]",
};

function PlatformBadge({ platform }: { platform: string }) {
  const color = platformColorMap[platform as keyof typeof platformColorMap];
  return (
    <h3 className={cn(
      "text-lg leading-tight font-black tracking-tight text-white uppercase sm:text-2xl",
      color,
    )}>
      {platform}
    </h3>
  );
}

const platformIconMap = {
  "Soundcloud": "/socials/soundcloud_color.png",
  "Spotify": "/socials/spotify.png",
  "YouTube": "/socials/youtube.png",
};

function PlatformIcon({ platform, size = 32 }: { platform: string, size?: number }) {
  const icon = platformIconMap[platform as keyof typeof platformIconMap];

  if (!icon) return null;

  return (
    <Image src={icon} alt={platform} width={size} height={size} />
  );
}