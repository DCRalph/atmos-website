/**
 * How much of the room the tiers are allowed to sell.
 *
 * The cap on an event is a statement about the venue, so everything that puts a
 * body in it comes off the same number. Comps are the one thing allowed to be
 * issued past the cap — the decision to squeeze one more artist in is made in
 * the room, not by a form — but they are still people, so they come off what
 * the tiers may put on sale rather than being waved through twice.
 *
 * Deliberately not `server-only`: the tier editor shows the same arithmetic its
 * save will be judged by, and two implementations of that would disagree by the
 * end of the week.
 */

export type AllocationBudget = {
  /** Null when the event is uncapped, in which case nothing here binds. */
  capacity: number | null;
  /** Σ tier allocations, whether or not the tier is currently on sale. */
  allocated: number;
  /** Valid comps, which have already taken their seats out of the cap. */
  comps: number;
  /** What the tiers may hold between them: `capacity − comps`. */
  allocatable: number | null;
  /** Still to be handed to a tier. Null when uncapped. */
  unallocated: number | null;
  /** How far the tiers are already past the budget. 0 when within it. */
  overAllocatedBy: number;
};

/** The budget as it falls out of the three numbers behind it. */
export function toAllocationBudget({
  capacity,
  allocated,
  comps,
}: {
  capacity: number | null;
  allocated: number;
  comps: number;
}): AllocationBudget {
  const allocatable = capacity === null ? null : Math.max(0, capacity - comps);

  return {
    capacity,
    allocated,
    comps,
    allocatable,
    unallocated:
      allocatable === null ? null : Math.max(0, allocatable - allocated),
    overAllocatedBy:
      allocatable === null ? 0 : Math.max(0, allocated - allocatable),
  };
}

/**
 * The most this tier may hold, given what the others already do.
 *
 * Null when the event is uncapped. `currentAllocation` is 0 for a tier that
 * doesn't exist yet.
 */
export function roomForTier(
  budget: AllocationBudget,
  currentAllocation: number,
): number | null {
  if (budget.allocatable === null) return null;
  return Math.max(
    0,
    budget.allocatable - (budget.allocated - currentAllocation),
  );
}

/**
 * Why this tier can't hold that many, or `null` if it can.
 *
 * Only ever refuses a change that makes things worse. An event can already be
 * over its budget — the cap was lowered, or comps were issued past it — and in
 * that state every tier still has to be editable, or the only way back would be
 * to delete tiers that have tickets in them.
 */
export function allocationRefusal({
  budget,
  currentAllocation,
  nextAllocation,
}: {
  budget: AllocationBudget;
  currentAllocation: number;
  nextAllocation: number;
}): string | null {
  if (budget.allocatable === null) return null;

  const total = budget.allocated - currentAllocation + nextAllocation;
  if (total <= budget.allocatable) return null;
  if (total <= budget.allocated) return null;

  const others = budget.allocated - currentAllocation;
  const comped =
    budget.comps > 0
      ? `, ${budget.comps} of which ${budget.comps === 1 ? "has" : "have"} been comped away`
      : "";

  return (
    `That puts ${total} tickets on sale against a cap of ${budget.capacity}${comped}` +
    ` — the other tiers hold ${others}, so this one can be at most ${roomForTier(budget, currentAllocation)}.`
  );
}
