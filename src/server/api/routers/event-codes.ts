import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ActivityType, type PrismaClient } from "~Prisma/client";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { normaliseCode } from "~/server/ticketing/discounts";
import {
  assertCodeRules,
  codeFieldsSchema,
} from "~/server/ticketing/code-input";
import { logActivity } from "~/server/utils/activity-log";

/**
 * Admin CRUD for one event's own codes, managed from that event's page. Unlike
 * a global code, one of these can be scoped to some of the event's tiers and
 * unlock its hidden ones: the key to a presale or a guest list.
 */
/**
 * The code string is free on this event and isn't a global code, and every
 * tier named is this event's. `exceptId` is the code being edited.
 */
async function assertCodeFree(
  db: PrismaClient,
  {
    eventId,
    code,
    tierIds,
    exceptId,
  }: { eventId: string; code: string; tierIds: string[]; exceptId?: string },
) {
  const [existing, global, tiers] = await Promise.all([
    db.eventCode.findFirst({
      where: {
        eventId,
        code,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    }),
    db.discountCode.findUnique({ where: { code }, select: { id: true } }),
    db.ticketTier.count({ where: { eventId, id: { in: tierIds } } }),
  ]);
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${code} is already a code for this event.`,
    });
  }
  if (global) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${code} is already a global discount code.`,
    });
  }
  if (tiers !== tierIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "One of those tiers isn't on this event.",
    });
  }
}

/** Tiers it discounts and, if it unlocks, opens. Empty means all. */
const tierFieldsSchema = z.object({
  tierIds: z.array(z.string()).default([]),
  unlocksHiddenTiers: z.boolean().default(false),
});

export const eventCodesRouter = createTRPCRouter({
  list: adminProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.eventCode.findMany({
        where: { eventId: input.eventId },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: adminProcedure
    .input(
      codeFieldsSchema
        .extend({ eventId: z.string() })
        .extend(tierFieldsSchema.shape),
    )
    .mutation(async ({ ctx, input }) => {
      const code = normaliseCode(input.code);
      assertCodeRules(input);

      await assertCodeFree(ctx.db, {
        eventId: input.eventId,
        code,
        tierIds: input.tierIds,
      });

      const created = await ctx.db.eventCode.create({
        data: {
          eventId: input.eventId,
          code,
          type: input.type,
          value: input.value,
          tierIds: input.tierIds,
          unlocksHiddenTiers: input.unlocksHiddenTiers,
          maxRedemptions: input.maxRedemptions ?? null,
          maxPerEmail: input.maxPerEmail ?? null,
          minTickets: input.minTickets ?? null,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          isActive: input.isActive,
          createdBy: ctx.session.user.id,
        },
      });

      await logActivity({
        type: ActivityType.DISCOUNT_CODE_CREATED,
        action: `Created event code ${created.code}`,
        userId: ctx.session.user.id,
        details: { eventCodeId: created.id, eventId: created.eventId },
      });

      return created;
    }),

  /**
   * Change a code, including what it unlocks. Uses already made keep what they
   * were worth; the new terms apply from the next checkout.
   */
  update: adminProcedure
    .input(
      codeFieldsSchema
        .omit({ isActive: true, startsAt: true })
        .extend({ id: z.string() })
        .extend(tierFieldsSchema.shape),
    )
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.eventCode.findUnique({
        where: { id: input.id },
        select: { eventId: true, startsAt: true },
      });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Code not found" });
      }
      const code = normaliseCode(input.code);
      assertCodeRules({ ...input, startsAt: current.startsAt });
      await assertCodeFree(ctx.db, {
        eventId: current.eventId,
        code,
        tierIds: input.tierIds,
        exceptId: input.id,
      });

      const updated = await ctx.db.eventCode.update({
        where: { id: input.id },
        data: {
          code,
          type: input.type,
          value: input.value,
          tierIds: input.tierIds,
          unlocksHiddenTiers: input.unlocksHiddenTiers,
          maxRedemptions: input.maxRedemptions ?? null,
          maxPerEmail: input.maxPerEmail ?? null,
          minTickets: input.minTickets ?? null,
          endsAt: input.endsAt ?? null,
        },
      });

      await logActivity({
        type: ActivityType.DISCOUNT_CODE_UPDATED,
        action: `Updated event code ${updated.code}`,
        userId: ctx.session.user.id,
        details: { eventCodeId: updated.id, eventId: updated.eventId },
      });

      return updated;
    }),

  /** The on/off switch in the table. */
  setActive: adminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.eventCode.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });

      await logActivity({
        type: ActivityType.DISCOUNT_CODE_UPDATED,
        action: `${input.isActive ? "Activated" : "Deactivated"} event code ${updated.code}`,
        userId: ctx.session.user.id,
        details: { eventCodeId: updated.id, eventId: updated.eventId },
      });

      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const redemptions = await ctx.db.eventCodeRedemption.count({
        where: { codeId: input.id },
      });
      if (redemptions > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This code has been used — deactivate it instead so the sales history stays intact.",
        });
      }

      const deleted = await ctx.db.eventCode.delete({
        where: { id: input.id },
      });

      await logActivity({
        type: ActivityType.DISCOUNT_CODE_DELETED,
        action: `Deleted event code ${deleted.code}`,
        userId: ctx.session.user.id,
        details: { eventCodeId: deleted.id, eventId: deleted.eventId },
      });

      return { ok: true as const };
    }),
});
