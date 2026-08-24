import { sortSchedule } from "./schedule";

/**
 * The line-up, as everyone who is not an admin sees it.
 *
 * Built by hand rather than by stripping fields off a run sheet row, so a
 * column added to `GigScheduleItem` next year cannot ride along into a public
 * payload by default. `line-up.test.ts` fails if this grows a key.
 *
 * Set times never appear, and neither does anything that is not a set. Running
 * order does, because it always has: it is the order of the array. An artist
 * playing twice is one name on the bill, at the position of their first set.
 */

/** What a run sheet row has to offer before it can become a line-up entry. */
export type LineUpSource = {
  id: string;
  kind: string;
  role: string | null;
  startsAt: Date | null;
  sortOrder: number;
  creatorProfile: {
    id: string;
    handle: string;
    displayName: string;
    avatarFileId: string | null;
    tagline: string | null;
    isPublished: boolean;
    claimStatus: string;
  } | null;
};

export type PublicLineUpEntry = {
  id: string;
  role: string | null;
  creatorProfile: NonNullable<LineUpSource["creatorProfile"]>;
};

/** The keys a public line-up entry has. Asserted by the test. */
export const PUBLIC_LINE_UP_KEYS = ["id", "role", "creatorProfile"] as const;

export function toPublicLineUp<T extends LineUpSource>(
  items: readonly T[],
): PublicLineUpEntry[] {
  const seen = new Set<string>();

  return sortSchedule(items).flatMap((item) => {
    const profile = item.creatorProfile;
    if (item.kind !== "SET" || !profile) return [];
    if (seen.has(profile.id)) return [];
    seen.add(profile.id);

    return [
      {
        id: item.id,
        role: item.role,
        creatorProfile: {
          id: profile.id,
          handle: profile.handle,
          displayName: profile.displayName,
          avatarFileId: profile.avatarFileId,
          tagline: profile.tagline,
          isPublished: profile.isPublished,
          claimStatus: profile.claimStatus,
        },
      },
    ];
  });
}
