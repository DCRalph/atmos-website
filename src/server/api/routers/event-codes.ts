import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ActivityType } from "~Prisma/client";
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
      codeFieldsSchema.extend({
        eventId: z.string(),
        /** Tiers it discounts and, if it unlocks, opens. Empty means all. */
        tierIds: z.array(z.string()).default([]),
        unlocksHiddenTiers: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const code = normaliseCode(input.code);
      assertCodeRules(input);

      const [existing, global, tiers] = await Promise.all([
        ctx.db.eventCode.findUnique({
          where: { eventId_code: { eventId: input.eventId, code } },
          select: { id: true },
        }),
        ctx.db.discountCode.findUnique({
          where: { code },
          select: { id: true },
        }),
        ctx.db.ticketTier.count({
          where: { eventId: input.eventId, id: { in: input.tierIds } },
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
      if (tiers !== input.tierIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One of those tiers isn't on this event.",
        });
      }

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

  /** Only the on/off switch: anything else is a new code. */
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
