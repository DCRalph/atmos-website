"use client";

import LiteYouTubeEmbed from "react-lite-youtube-embed";

import { cn } from "~/lib/utils";

export type YouTubePlayerProps = {
  videoId: string;
  title: string;
  /** Fill the parent's box instead of sizing itself at 16:9. The poster is cropped to fit. */
  fill?: boolean;
  className?: string;
};

export function YouTubePlayer({
  videoId,
  title,
  fill = false,
  className,
}: YouTubePlayerProps) {
  return (
    <div
      className={cn(
        "w-full",
        // The embed's own stylesheet is unlayered, so it beats Tailwind's
        // layered utilities without `!`.
        fill && "h-full [&_.yt-lite]:aspect-auto! [&_.yt-lite]:h-full!",
        className,
      )}
    >
      <LiteYouTubeEmbed
        id={videoId}
        title={title}
        params="rel=0"
        poster="maxresdefault"
      />
    </div>
  );
}
