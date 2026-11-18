/**
 * The event activity feed: sales, refunds, the door and admin changes in one
 * list, newest first. The server reads each source a page at a time and
 * `mergeActivityPage` stitches them together.
 *
 * Paging is by (time, id), never by offset, so a scan landing while somebody
 * scrolls neither repeats a row nor skips one. Ids from different tables are
 * compared as plain strings, which is only a tiebreak for rows in the same
 * millisecond, but it is a total order, and that is all keyset paging needs.
 *
 * Client-safe.
 */

export const ACTIVITY_KINDS = ["sales", "refunds", "door", "changes"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export type ActivityCursor = { at: Date; id: string };

export function encodeActivityCursor({ at, id }: ActivityCursor): string {
  return `${at.toISOString()}|${id}`;
}

/** Null for anything that isn't a cursor this module wrote. */
export function decodeActivityCursor(
  cursor: string | undefined,
): ActivityCursor | null {
  if (!cursor) return null;
  const split = cursor.indexOf("|");
  if (split < 0) return null;
  const at = new Date(cursor.slice(0, split));
  const id = cursor.slice(split + 1);
  if (Number.isNaN(at.getTime()) || !id) return null;
  return { at, id };
}

/**
 * One page from several sources. Each source must already be sorted newest
 * first and hold at most `limit` rows from before the cursor. If any source
 * came back full, there may be more, so the page ends where it was cut.
 */
export function mergeActivityPage<T extends ActivityCursor>(
  sources: readonly (readonly T[])[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const merged = sources
    .flat()
    .sort(
      (a, b) =>
        b.at.getTime() - a.at.getTime() ||
        (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    );
  const items = merged.slice(0, limit);
  const last = items.at(-1);
  const more =
    merged.length > limit || sources.some((rows) => rows.length >= limit);
  return {
    items,
    nextCursor: more && last ? encodeActivityCursor(last) : null,
  };
}
