"use client";

import LiteYouTubeEmbed from "react-lite-youtube-embed";

import { cn } from "~/lib/utils";

export type YouTubePlayerProps = {
  videoId: string;
  title: string;
  className?: string;
};

export function YouTubePlayer({
  videoId,
  title,
  className,
}: YouTubePlayerProps) {
  return (
    <div className={cn("w-full", className)}>
      <LiteYouTubeEmbed id={videoId} title={title} />
    </div>
  );
}
