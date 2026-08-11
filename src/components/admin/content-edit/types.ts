import type { ContentLinkType } from "~Prisma/browser";

/** A content item as the editor holds it before Save. */
export type ContentDraft = {
  type: string;
  title: string;
  platform: string;
  dj: string;
  description: string;
  date: Date | undefined;
  linkType: ContentLinkType;
  link: string;
  /** A SoundCloud player URL, or a YouTube video id, depending on `linkType`. */
  embedUrl: string;
};
