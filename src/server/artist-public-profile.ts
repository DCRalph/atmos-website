import "server-only";

import type { Prisma } from "~Prisma/client";
import { buildMediaUrl } from "~/lib/media-url";
import { isGigPast } from "~/lib/date-utils";
import { readLayout, toSections } from "~/lib/artist-sections";
import { parseTheme } from "~/lib/artist-theme";
import {
  APPEARANCE_ORDER,
  APPEARANCE_SELECT,
  APPEARANCE_WHERE,
  toGigAttributions,
} from "~/server/artist-appearances";
import type {
  EditableProfile,
  ProfileSet,
  PublicProfile,
} from "~/components/artist-profile/types";

/** Everything a public profile page reads, in one query. */
export const PUBLIC_PROFILE_INCLUDE = {
  blocks: { orderBy: [{ y: "asc" }, { x: "asc" }] },
  socials: { orderBy: { sortOrder: "asc" } },
  themeRef: {
    select: {
      id: true,
      name: true,
      tokens: true,
      isSystem: true,
      isPublic: true,
      ownerUserId: true,
    },
  },
  setAppearances: {
    where: APPEARANCE_WHERE,
    orderBy: APPEARANCE_ORDER,
    select: APPEARANCE_SELECT,
  },
} satisfies Prisma.ArtistProfileInclude;

export type PublicProfileRow = Prisma.ArtistProfileGetPayload<{
  include: typeof PUBLIC_PROFILE_INCLUDE;
}>;

/** Trimmed text, or null when there's nothing left. */
const text = (value: string | null) => value?.trim() || null; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing -- an empty string should become null too

/** The render-ready profile for `ArtistProfilePage`. */
export function toPublicProfile(row: PublicProfileRow): PublicProfile {
  const sets: ProfileSet[] = toGigAttributions(row.setAppearances).map(
    ({ id, role, gig }) => ({
      id,
      gig: {
        id: gig.id,
        slug: gig.slug,
        title: gig.title,
        isTba: gig.isTba,
        ticketLink: gig.ticketLink,
      },
      venue: gig.subtitle,
      start: gig.gigStartTime,
      end: gig.gigEndTime,
      poster: gig.posterFileUploadId
        ? buildMediaUrl(gig.posterFileUploadId)
        : null,
      role,
    }),
  );

  // TBA gigs never get here — see `APPEARANCE_WHERE` — so every date is real.
  const upcoming = sets
    .filter((s) => !isGigPast({ gigStartTime: s.start, gigEndTime: s.end }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const past = sets.filter((s) => !upcoming.includes(s));

  return {
    id: row.id,
    handle: row.handle,
    name: row.displayName,
    tagline: text(row.tagline),
    bio: text(row.bio),
    portrait: row.avatarFileId ? buildMediaUrl(row.avatarFileId) : null,
    banner: row.bannerFileId ? buildMediaUrl(row.bannerFileId) : null,
    claimed: row.claimStatus !== "UNCLAIMED",
    socials: row.socials.map((s) => ({
      platform: s.platform,
      url: s.url,
      label: s.label,
    })),
    sections: toSections(readLayout(row.blocks, row.rowHeightPx), {
      socials: row.socials.length,
      upcoming: upcoming.length,
      past: past.length,
      mediaUrl: buildMediaUrl,
    }),
    upcoming,
    past,
  };
}

/**
 * A theme the page editor may change in place: made for this profile (owned
 * by its artist, or by nobody for an unclaimed profile), not shared, and used
 * by no other page. Anything else is copied on its first change, so a change
 * on one page never shows up on another. Used by `customizeTheme`.
 */
export const isOwnTheme = (
  theme: {
    isSystem: boolean;
    isPublic: boolean;
    ownerUserId: string | null;
    profiles: number;
  },
  profileUserId: string | null,
) =>
  !theme.isSystem &&
  !theme.isPublic &&
  theme.ownerUserId === profileUserId &&
  theme.profiles <= 1;

/**
 * What the page editor starts from. Only for the owner and admins.
 * `themeUses` is how many profiles use the profile's theme.
 */
export function toEditableProfile(
  row: PublicProfileRow,
  editor: EditableProfile["editor"],
  themeUses: number,
): EditableProfile {
  const theme = row.themeRef;
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.displayName,
    tagline: row.tagline,
    bio: row.bio,
    avatarFileId: row.avatarFileId,
    bannerFileId: row.bannerFileId,
    accentColor: row.accentColor,
    isPublished: row.isPublished,
    theme: theme
      ? {
          id: theme.id,
          name: theme.name,
          tokens: parseTheme(theme.tokens),
          own: isOwnTheme({ ...theme, profiles: themeUses }, row.userId),
        }
      : null,
    blocks: readLayout(row.blocks, row.rowHeightPx).map((b) => ({
      id: b.id,
      type: b.type,
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      data: b.data,
    })),
    socials: row.socials.map((s) => ({
      platform: s.platform,
      url: s.url,
      label: s.label,
    })),
    editor,
  };
}
