import type { Prisma } from "~Prisma/client";
import { getYouTubeId, youtubeThumbnail } from "~/lib/youtube";

export const CONTENT_ARTWORK_INCLUDE = {
  image: { select: { url: true, status: true } },
} satisfies Prisma.ContentItemInclude;

/** Custom artwork wins; YouTube videos otherwise use their own thumbnail. */
export function withContentArtwork<
  T extends {
    image: { url: string; status: string } | null;
    linkType: string;
    link: string;
    embedUrl: string | null;
  },
>({ image, ...item }: T) {
  const videoId =
    item.linkType === "YOUTUBE_VIDEO"
      ? (getYouTubeId(item.embedUrl) ?? getYouTubeId(item.link))
      : null;
  return {
    ...item,
    imageUrl:
      image?.status === "OK"
        ? image.url
        : videoId
          ? youtubeThumbnail(videoId)
          : null,
  };
}
