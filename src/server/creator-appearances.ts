import "server-only";

import type { Prisma } from "~Prisma/client";

/**
 * The gigs an artist has been on.
 *
 * Read through `gig_set_artist` rather than off the run sheet row, because a
 * back to back is one row with two people in it and both of them played the
 * gig. That also means an artist can hold several rows for one night — an
 * opening set and a closing set, or a solo slot and a back to back — so the
 * duplicates are collapsed here rather than by a `distinct` the join cannot
 * express.
 *
 * Columns are named rather than included: a run sheet row also carries set
 * times and internal notes, and every caller of this is a public page.
 */

export const APPEARANCE_SELECT = {
  id: true,
  item: {
    select: {
      role: true,
      sortOrder: true,
      gig: {
        select: {
          id: true,
          title: true,
          subtitle: true,
          gigStartTime: true,
          gigEndTime: true,
          posterFileUploadId: true,
          mode: true,
        },
      },
    },
  },
} satisfies Prisma.GigSetArtistSelect;

export const APPEARANCE_ORDER = [
  { item: { gig: { gigStartTime: "desc" } } },
  { item: { sortOrder: "asc" } },
] satisfies Prisma.GigSetArtistOrderByWithRelationInput[];

type Appearance = Prisma.GigSetArtistGetPayload<{
  select: typeof APPEARANCE_SELECT;
}>;

export type GigAttribution = {
  id: string;
  role: string | null;
  gig: Appearance["item"]["gig"];
};

/** One entry per gig, keeping the first appearance in the given order. */
export function toGigAttributions(
  appearances: readonly Appearance[],
): GigAttribution[] {
  const seen = new Set<string>();

  return appearances.flatMap((appearance) => {
    const gig = appearance.item.gig;
    if (seen.has(gig.id)) return [];
    seen.add(gig.id);
    return [{ id: appearance.id, role: appearance.item.role, gig }];
  });
}
