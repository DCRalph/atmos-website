import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { EventStaffRole, TierSalesChannel, type Prisma } from "~Prisma/client";
import { DEFAULT_ACCESS_LEVEL } from "~/lib/ticketing/access-levels";
import {
  accessLevelCode,
  assertIssuableLevels,
} from "~/server/ticketing/access-level-store";
import { toAllocationBudget } from "~/lib/ticketing/capacity";
import { compCountForEvent } from "~/server/ticketing/inventory";

/**
 * The tiers and door staff of an event, saved as whole lists.
 *
 * The admin editor holds the event as one draft and saves it with one button,
 * so this takes the plan as the admin sees it: every tier in order, every
 * staff member with a role. Rows that have gone are deleted, rows without an
 * id are created, and the rest are updated in place. Both run inside the
 * caller's inventory lock so the allocation check reads the same rows the
 * checkout does.
 */

type Tx = Prisma.TransactionClient;

export const tierPlanSchema = z.object({
  /** Absent for a tier that doesn't exist yet. */
  id: z.string().optional(),
  name: z.string().trim().min(1, "Give every tier a name"),
  description: z.string().trim().nullable().optional(),
  priceCents: z.number().int().min(0),
  allocation: z.number().int().min(0),
  /** Tickets per purchase. Above 1 makes it a group tier. */
  groupSize: z.number().int().min(1).max(20).default(1),
  /** Off the public list until the tier above stops selling. */
  releaseAfterPrevious: z.boolean().default(false),
  /** Online, at the door, or both. Door-only tiers are the door allocation. */
  salesChannel: z.enum(TierSalesChannel).default(TierSalesChannel.ALL),
  salesStartAt: z.date().nullable().optional(),
  salesEndAt: z.date().nullable().optional(),
  isActive: z.boolean().default(true),
  isHidden: z.boolean().default(false),
  maxPerOrder: z.number().int().min(1).max(50).default(10),
  maxPerEmail: z.number().int().min(1).nullable().optional(),
  requiresApproval: z.boolean().default(false),
  accessLevel: accessLevelCode.default(DEFAULT_ACCESS_LEVEL),
});

export type TierPlanInput = z.infer<typeof tierPlanSchema>;

export const staffPlanSchema = z.object({
  userId: z.string(),
  role: z.enum([EventStaffRole.SCANNER, EventStaffRole.MANAGER]),
});

export type StaffPlanInput = z.infer<typeof staffPlanSchema>;

/**
 * Replace the event's tiers with `plan`, in that order.
 *
 * Refuses a plan that puts more on sale than the room allows once the comp
 * allowance is set aside, unless the event is already over and the plan makes
 * it no worse — the cap may have been lowered, the allowance raised, or comps
 * issued past it, and every tier still has to be editable in that state. Also refuses shrinking a tier under what it has
 * already sold or held, and deleting a tier with tickets in it.
 */
export async function applyTierPlan(
  tx: Tx,
  eventId: string,
  plan: TierPlanInput[],
): Promise<void> {
  const [event, existing, comps] = await Promise.all([
    tx.ticketEvent.findUniqueOrThrow({
      where: { id: eventId },
      select: { capacity: true, compAllowance: true },
    }),
    tx.ticketTier.findMany({
      where: { eventId },
      select: {
        id: true,
        name: true,
        allocation: true,
        soldCount: true,
        heldCount: true,
        accessLevel: true,
        _count: { select: { tickets: true } },
      },
    }),
    compCountForEvent(tx, eventId),
  ]);
  const existingById = new Map(existing.map((tier) => [tier.id, tier]));

  // A tier left on a level since archived still saves; only a level being
  // newly put on sale has to be live.
  await assertIssuableLevels(
    tx,
    plan
      .filter(
        (row) =>
          !row.id || existingById.get(row.id)?.accessLevel !== row.accessLevel,
      )
      .map((row) => row.accessLevel),
  );

  for (const row of plan) {
    if (!row.id) continue;
    const current = existingById.get(row.id);
    if (!current) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `"${row.name}" is no longer on this event. Reload and try again.`,
      });
    }
    const committed = current.soldCount + current.heldCount;
    if (row.allocation < committed) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${committed} already sold or held in ${current.name} — its allocation can't go below that.`,
      });
    }
  }

  const keep = new Set(plan.map((row) => row.id).filter(Boolean));
  const removed = existing.filter((tier) => !keep.has(tier.id));
  const withTickets = removed.find((tier) => tier._count.tickets > 0);
  if (withTickets) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Tickets have been issued in ${withTickets.name} — switch it off instead of removing it.`,
    });
  }

  const budget = toAllocationBudget({
    capacity: event.capacity,
    allocated: existing.reduce((sum, tier) => sum + tier.allocation, 0),
    comps,
    compAllowance: event.compAllowance,
  });
  const planned = plan.reduce((sum, row) => sum + row.allocation, 0);
  if (
    budget.allocatable !== null &&
    planned > budget.allocatable &&
    planned > budget.allocated
  ) {
    const comped =
      budget.compsReserved > 0
        ? `, ${budget.compsReserved} of which ${budget.compsReserved === 1 ? "is" : "are"} kept for comps`
        : "";
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `The tiers put ${planned} tickets on sale against a cap of ${budget.capacity}${comped}. Trim one so the plan fits the room.`,
    });
  }

  if (removed.length > 0) {
    await tx.ticketTier.deleteMany({
      where: { id: { in: removed.map((tier) => tier.id) } },
    });
  }

  for (const [index, row] of plan.entries()) {
    const { id, ...fields } = row;
    const data = {
      name: fields.name,
      description: fields.description ?? null,
      priceCents: fields.priceCents,
      allocation: fields.allocation,
      groupSize: fields.groupSize,
      releaseAfterPrevious: fields.releaseAfterPrevious,
      salesChannel: fields.salesChannel,
      salesStartAt: fields.salesStartAt ?? null,
      salesEndAt: fields.salesEndAt ?? null,
      isActive: fields.isActive,
      isHidden: fields.isHidden,
      maxPerOrder: fields.maxPerOrder,
      maxPerEmail: fields.maxPerEmail ?? null,
      requiresApproval: fields.requiresApproval,
      accessLevel: fields.accessLevel,
      sortOrder: index,
    };
    if (id) {
      await tx.ticketTier.update({ where: { id }, data });
    } else {
      await tx.ticketTier.create({ data: { ...data, eventId } });
    }
  }
}

/**
 * Replace the event's door staff with `plan`. Being on the list is what
 * grants door access, so whoever is missing from it loses theirs.
 */
export async function applyStaffPlan(
  tx: Tx,
  eventId: string,
  plan: StaffPlanInput[],
  createdBy: string,
): Promise<void> {
  const wanted = new Map(plan.map((row) => [row.userId, row.role]));

  await tx.ticketEventStaff.deleteMany({
    where: { eventId, userId: { notIn: [...wanted.keys()] } },
  });

  for (const [userId, role] of wanted) {
    await tx.ticketEventStaff.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { role },
      create: { eventId, userId, role, createdBy },
    });
  }
}
