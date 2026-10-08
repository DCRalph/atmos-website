/**
 * How much of the room the tiers are allowed to sell.
 *
 * The cap on an event is a statement about the venue, so everything that puts a
 * body in it comes off the same number. Comps are the one thing allowed to be
 * issued past the cap — the decision to squeeze one more artist in is made in
 * the room, not by a form — but they are still people, so they come off what
 * the tiers may put on sale rather than being waved through twice.
 *
 * The comp allowance is held back the same way before a single comp is issued:
 * a 300 room with 20 comps planned has 280 to sell, not 300 until the guest
 * list lands and then 280 with the last 20 already gone.
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
  /** The planned comp budget, or null if nobody set one. */
  compAllowance: number | null;
  /** Seats kept off sale for comps: see `compReservation`. */
  compsReserved: number;
  /** What the tiers may hold between them: `capacity − compsReserved`. */
  allocatable: number | null;
  /** Still to be handed to a tier. Null when uncapped. */
  unallocated: number | null;
  /** How far the tiers are already past the budget. 0 when within it. */
  overAllocatedBy: number;
};

/**
 * Seats kept off sale for comps: the whole allowance until more than that have
 * been issued, then however many were. Issuing a comp inside the allowance
 * takes a seat that was already set aside, so it never shrinks what is for sale.
 */
export function compReservation(
  compAllowance: number | null,
  comps: number,
): number {
  return Math.max(compAllowance ?? 0, comps);
}

/** The budget as it falls out of the numbers behind it. */
export function toAllocationBudget({
  capacity,
  allocated,
  comps,
  compAllowance,
}: {
  capacity: number | null;
  allocated: number;
  comps: number;
  compAllowance: number | null;
}): AllocationBudget {
  const compsReserved = compReservation(compAllowance, comps);
  const allocatable =
    capacity === null ? null : Math.max(0, capacity - compsReserved);

  return {
    capacity,
    allocated,
    comps,
    compAllowance,
    compsReserved,
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
    budget.compsReserved > 0
      ? `, ${budget.compsReserved} of which ${budget.compsReserved === 1 ? "is" : "are"} kept for comps`
      : "";

  return (
    `That puts ${total} tickets on sale against a cap of ${budget.capacity}${comped}` +
    ` — the other tiers hold ${others}, so this one can be at most ${roomForTier(budget, currentAllocation)}.`
  );
}

/**
 * Tickets a set of order lines puts in the room. `quantity` counts purchases,
 * and a purchase of a group tier is `groupSize` people.
 */
export function ticketCount(
  lines: readonly { quantity: number; groupSize: number }[],
): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.groupSize, 0);
}
