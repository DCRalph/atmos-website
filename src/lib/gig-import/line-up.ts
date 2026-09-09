/**
 * Which of the names a post billed still have nobody behind them.
 *
 * Asked of the draft rather than of the handle. A handle is answered once its
 * slot holds as many artists as the caption named, however that happened: a
 * profile created for it, or an existing profile pointed at it by hand.
 *
 * That distinction is the whole reason this is not a lookup. Instagram handles
 * change and profiles do not, so `@teiko` may well be answered by a profile
 * called `@tk`. Asking "does a profile with this handle exist" would leave that
 * name listed as unresolved forever.
 */

export type LineUpSlot = {
  /** Every handle the post billed in this slot, in billing order. */
  handles: string[];
};

export type FilledSet = {
  /** The slot's index in the post's line-up. */
  sortOrder: number;
  /** How many artists the slot holds now. */
  artistCount: number;
};

export type UnresolvedHandle = { handle: string; slotIndex: number };

export function unresolvedHandles(
  slots: readonly LineUpSlot[],
  sets: readonly FilledSet[],
): UnresolvedHandle[] {
  const filledBySlot = new Map(
    sets.map((set) => [set.sortOrder, set.artistCount]),
  );

  return slots.flatMap((slot, slotIndex) => {
    const filled = filledBySlot.get(slotIndex) ?? 0;
    // A back to back is answered one name at a time, so what is still waiting
    // is whatever the slot names beyond what it already holds.
    return slot.handles.slice(filled).map((handle) => ({ handle, slotIndex }));
  });
}
