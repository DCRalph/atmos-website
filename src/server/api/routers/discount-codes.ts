import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ActivityType, type PrismaClient } from "~Prisma/client";
import { applyPatch, patchOf } from "~/server/api/patch-input";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { normaliseCode } from "~/server/ticketing/discounts";
import {
  assertCodeRules,
  codeFieldsSchema,
} from "~/server/ticketing/code-input";
import { logActivity } from "~/server/utils/activity-log";

/**
 * Admin CRUD for global discount codes: codes that work on any event and only
 * ever take money off. An event's own codes, which can also unlock its hidden
 * tiers, are `eventCodes`.
 */
/**
 * One string, one meaning: an event's own code would win at checkout, so a
 * global code that shares it would be silently dead there.
 */
async function assertCodeFree(
  db: PrismaClient,
  code: string,
  exceptId?: string,
) {
  const [existing, eventCode] = await Promise.all([
    db.discountCode.findFirst({
      where: { code, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    }),
    db.eventCode.findFirst({
      where: { code },
      select: { event: { select: { name: true } } },
    }),
  ]);
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${code} is already in use.`,
    });
  }
  if (eventCode) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${code} is already a code for ${eventCode.event.name}.`,
    });
  }
}

/** What the edit form sends: everything but the on/off switch and start. */
const editableFieldsSchema = codeFieldsSchema.omit({
  isActive: true,
  startsAt: true,
});

export const discountCodesRouter = createTRPCRouter({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.discountCode.findMany({ orderBy: { createdAt: "desc" } });
  }),

  create: adminProcedure
    .input(codeFieldsSchema)
    .mutation(async ({ ctx, input }) => {
      const code = normaliseCode(input.code);
      assertCodeRules(input);

      await assertCodeFree(ctx.db, code);

      const created = await ctx.db.discountCode.create({
        data: {
          code,
          type: input.type,
          value: input.value,
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
        action: `Created discount code ${created.code}`,
        userId: ctx.session.user.id,
        details: { codeId: created.id },
      });

      return created;
    }),

  /**
   * Change a code. Uses already made keep what they were worth; the new terms
   * apply from the next checkout. Fields left out keep their saved value, and
   * `null` clears a limit.
   */
  update: adminProcedure
    .input(patchOf(editableFieldsSchema).extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const current = await ctx.db.discountCode.findUnique({
        where: { id },
        select: {
          code: true,
          type: true,
          value: true,
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
      await assertCodeFree(ctx.db, code, id);

      const updated = await ctx.db.discountCode.update({
        where: { id },
        data: {
          code,
          type: next.type,
          value: next.value,
          maxRedemptions: next.maxRedemptions,
          maxPerEmail: next.maxPerEmail,
          minTickets: next.minTickets,
          endsAt: next.endsAt,
        },
      });

      await logActivity({
        type: ActivityType.DISCOUNT_CODE_UPDATED,
        action: `Updated discount code ${updated.code}`,
        userId: ctx.session.user.id,
        details: { codeId: updated.id },
      });

      return updated;
    }),

  /** The on/off switch in the table. */
  setActive: adminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.discountCode.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });

      await logActivity({
        type: ActivityType.DISCOUNT_CODE_UPDATED,
        action: `${input.isActive ? "Activated" : "Deactivated"} discount code ${updated.code}`,
        userId: ctx.session.user.id,
        details: { codeId: updated.id },
      });

      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const redemptions = await ctx.db.discountRedemption.count({
        where: { codeId: input.id },
      });
      if (redemptions > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This code has been used — deactivate it instead so the sales history stays intact.",
        });
      }

      const deleted = await ctx.db.discountCode.delete({
        where: { id: input.id },
      });

      await logActivity({
        type: ActivityType.DISCOUNT_CODE_DELETED,
        action: `Deleted discount code ${deleted.code}`,
        userId: ctx.session.user.id,
        details: { codeId: deleted.id },
      });

      return { ok: true as const };
    }),
});
