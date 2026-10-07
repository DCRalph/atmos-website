import "server-only";

import type { Prisma } from "~Prisma/client";
import { buildMediaUrl } from "~/lib/media-url";
import { isGigPast } from "~/lib/date-utils";
import { toSections } from "~/lib/artist-sections";
import {
  APPEARANCE_ORDER,
  APPEARANCE_SELECT,
  APPEARANCE_WHERE,
  toGigAttributions,
} from "~/server/artist-appearances";
import type {
  ProfileSet,
  PublicProfile,
} from "~/components/artist-profile/types";

/** Everything a public profile page reads, in one query. */
export const PUBLIC_PROFILE_INCLUDE = {
  blocks: { orderBy: [{ y: "asc" }, { x: "asc" }] },
  socials: { orderBy: { sortOrder: "asc" } },
  themeRef: { select: { tokens: true } },
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
    sections: toSections(row.blocks, {
      socials: row.socials.length,
      upcoming: upcoming.length,
      past: past.length,
      mediaUrl: buildMediaUrl,
    }),
    upcoming,
    past,
  };
}
