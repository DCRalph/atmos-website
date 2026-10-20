import type { Prisma } from "~Prisma/client";

export const CONTENT_ARTWORK_INCLUDE = {
  image: { select: { url: true, status: true } },
} satisfies Prisma.ContentItemInclude;

/** Deleted uploads are omitted so public cards fall back to their text. */
export function withContentArtwork<
  T extends { image: { url: string; status: string } | null },
>({ image, ...item }: T) {
  return { ...item, imageUrl: image?.status === "OK" ? image.url : null };
}
