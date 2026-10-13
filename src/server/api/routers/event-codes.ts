import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ActivityType, EventCodeType, type PrismaClient } from "~Prisma/client";
import { applyPatch, patchOf } from "~/server/api/patch-input";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { normaliseCode } from "~/server/ticketing/discounts";
import {
  assertCodeRules,
  eventCodeFieldsSchema,
} from "~/server/ticketing/code-input";
import { logActivity } from "~/server/utils/activity-log";

/**
 * Admin CRUD for one event's own codes, managed from that event's page. Unlike
 * a global code, one of these can be scoped to some of the event's tiers, or
 * be an UNLOCK code that opens hidden ones: the key to a presale or a guest
 * list.
 */

/**
 * The code string is free on this event and isn't a global code, and every
 * tier named is this event's. An UNLOCK code's tiers must be hidden, or it
 * would unlock something already on sale. `exceptId` is the code being edited.
 */
async function assertCodeFree(
  db: PrismaClient,
  {
    eventId,
    code,
    type,
    tierIds,
    exceptId,
  }: {
    eventId: string;
    code: string;
    type: EventCodeType;
    tierIds: string[];
    exceptId?: string;
  },
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
    db.ticketTier.findMany({
      where: { eventId, id: { in: tierIds } },
      select: { name: true, isHidden: true },
    }),
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
  if (tiers.length !== tierIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "One of those tiers isn't on this event.",
    });
  }
  const visible = tiers.find((tier) => !tier.isHidden);
  if (type === EventCodeType.UNLOCK && visible) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${visible.name} isn't hidden, so anyone can already buy it. Mark it hidden under Tiers first.`,
    });
  }
}

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
    .input(eventCodeFieldsSchema.extend({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const code = normaliseCode(input.code);
      assertCodeRules(input);

      await assertCodeFree(ctx.db, {
        eventId: input.eventId,
        code,
        type: input.type,
        tierIds: input.tierIds,
      });

      const created = await ctx.db.eventCode.create({
        data: {
          eventId: input.eventId,
          code,
          type: input.type,
          value: input.value,
          tierIds: input.tierIds,
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
   * were worth; the new terms apply from the next checkout. Fields left out
   * keep their saved value.
   */
  update: adminProcedure
    .input(
      patchOf(
        eventCodeFieldsSchema.omit({ isActive: true, startsAt: true }),
      ).extend({ id: z.string() }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const current = await ctx.db.eventCode.findUnique({
        where: { id },
        select: {
          eventId: true,
          code: true,
          type: true,
          value: true,
          tierIds: true,
          maxRedemptions: true,
          maxPerEmail: true,
          minTickets: true,
          startsAt: true,
          endsAt: true,
        },
      });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Code not found" });
      }
      const next = applyPatch(current, patch);
      const code = normaliseCode(next.code);
      assertCodeRules(next);
      await assertCodeFree(ctx.db, {
        eventId: current.eventId,
        code,
        type: next.type,
        tierIds: next.tierIds,
        exceptId: id,
      });

      const updated = await ctx.db.eventCode.update({
        where: { id },
        data: {
          code,
          type: next.type,
          value: next.value,
          tierIds: next.tierIds,
          maxRedemptions: next.maxRedemptions,
          maxPerEmail: next.maxPerEmail,
          minTickets: next.minTickets,
          endsAt: next.endsAt,
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
