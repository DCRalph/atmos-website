import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ActivityType, DiscountCodeType } from "~Prisma/client";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { normaliseCode } from "~/server/ticketing/discounts";
import { logActivity } from "~/server/utils/activity-log";

/** Admin CRUD for discount codes, plus their redemption history. */

const codeInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dashes and underscores only"),
  type: z.enum([DiscountCodeType.PERCENT, DiscountCodeType.FIXED]),
  /** Basis points for PERCENT, cents for FIXED. */
  value: z.number().int().min(1),
  eventId: z.string().nullable().optional(),
  tierIds: z.array(z.string()).default([]),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  maxPerEmail: z.number().int().min(1).nullable().optional(),
  minTickets: z.number().int().min(1).nullable().optional(),
  startsAt: z.date().nullable().optional(),
  endsAt: z.date().nullable().optional(),
  isActive: z.boolean().default(true),
  unlocksHiddenTiers: z.boolean().default(false),
});

export const discountCodesRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z.object({ eventId: z.string().optional() }).default({}),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.discountCode.findMany({
        where: input.eventId
          ? { OR: [{ eventId: input.eventId }, { eventId: null }] }
          : {},
        orderBy: { createdAt: "desc" },
        include: {
          event: { select: { id: true, name: true } },
          _count: { select: { redemptions: true } },
        },
      });
    }),

  byId: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const code = await ctx.db.discountCode.findUnique({
        where: { id: input.id },
        include: {
          event: { select: { id: true, name: true } },
          redemptions: {
            orderBy: { createdAt: "desc" },
            take: 100,
            include: {
              order: {
                select: {
                  orderNumber: true,
                  buyerEmail: true,
                  totalCents: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });
      if (!code) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Code not found" });
      }

      const given = code.redemptions.reduce((sum, r) => sum + r.amountCents, 0);
      return { ...code, totalGivenCents: given };
    }),

  create: adminProcedure
    .input(codeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const code = normaliseCode(input.code);

      if (input.type === DiscountCodeType.PERCENT && input.value > 10_000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A percentage discount can't be more than 100%.",
        });
      }
      if (input.startsAt && input.endsAt && input.endsAt < input.startsAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The code can't expire before it starts.",
        });
      }

      const existing = await ctx.db.discountCode.findUnique({
        where: { code },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${code} is already in use.`,
        });
      }

      const created = await ctx.db.discountCode.create({
        data: {
          code,
          type: input.type,
          value: input.value,
          eventId: input.eventId ?? null,
          tierIds: input.tierIds,
          maxRedemptions: input.maxRedemptions ?? null,
          maxPerEmail: input.maxPerEmail ?? null,
          minTickets: input.minTickets ?? null,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          isActive: input.isActive,
          unlocksHiddenTiers: input.unlocksHiddenTiers,
          createdBy: ctx.session.user.id,
        },
      });

      await logActivity({
        type: ActivityType.DISCOUNT_CODE_CREATED,
        action: `Created discount code ${created.code}`,
        userId: ctx.session.user.id,
        details: { codeId: created.id, eventId: created.eventId },
      });

      return created;
    }),

  update: adminProcedure
    .input(codeInputSchema.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;

      const updated = await ctx.db.discountCode.update({
        where: { id },
        data: {
          ...(rest.code !== undefined ? { code: normaliseCode(rest.code) } : {}),
          ...(rest.type !== undefined ? { type: rest.type } : {}),
          ...(rest.value !== undefined ? { value: rest.value } : {}),
          ...(rest.eventId !== undefined ? { eventId: rest.eventId } : {}),
          ...(rest.tierIds !== undefined ? { tierIds: rest.tierIds } : {}),
          ...(rest.maxRedemptions !== undefined
            ? { maxRedemptions: rest.maxRedemptions }
            : {}),
          ...(rest.maxPerEmail !== undefined
            ? { maxPerEmail: rest.maxPerEmail }
            : {}),
          ...(rest.minTickets !== undefined
            ? { minTickets: rest.minTickets }
            : {}),
          ...(rest.startsAt !== undefined ? { startsAt: rest.startsAt } : {}),
          ...(rest.endsAt !== undefined ? { endsAt: rest.endsAt } : {}),
          ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
          ...(rest.unlocksHiddenTiers !== undefined
            ? { unlocksHiddenTiers: rest.unlocksHiddenTiers }
            : {}),
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

  /** Bulk-generate single-use codes, e.g. for a guest list. */
  generateBatch: adminProcedure
    .input(
      codeInputSchema
        .omit({ code: true, maxRedemptions: true, maxPerEmail: true })
        .extend({
          prefix: z
            .string()
            .trim()
            .min(1)
            .max(12)
            .regex(/^[A-Za-z0-9_-]+$/),
          count: z.number().int().min(1).max(200),
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const { prefix, count, ...shared } = input;
      const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
      const created: string[] = [];

      for (let i = 0; i < count; i++) {
        let code = "";
        for (let attempt = 0; attempt < 5; attempt++) {
          const suffix = Array.from(
            { length: 6 },
            () => alphabet[Math.floor(Math.random() * alphabet.length)],
          ).join("");
          const candidate = normaliseCode(`${prefix}-${suffix}`);
          const clash = await ctx.db.discountCode.findUnique({
            where: { code: candidate },
            select: { id: true },
          });
          if (!clash) {
            code = candidate;
            break;
          }
        }
        if (!code) continue;

        await ctx.db.discountCode.create({
          data: {
            code,
            type: shared.type,
            value: shared.value,
            eventId: shared.eventId ?? null,
            tierIds: shared.tierIds,
            // Batch codes are single-use by definition.
            maxRedemptions: 1,
            maxPerEmail: 1,
            minTickets: shared.minTickets ?? null,
            startsAt: shared.startsAt ?? null,
            endsAt: shared.endsAt ?? null,
            isActive: shared.isActive,
            unlocksHiddenTiers: shared.unlocksHiddenTiers,
            createdBy: ctx.session.user.id,
          },
        });
        created.push(code);
      }

      await logActivity({
        type: ActivityType.DISCOUNT_CODE_CREATED,
        action: `Generated ${created.length} discount codes with prefix ${prefix}`,
        userId: ctx.session.user.id,
        details: { count: created.length, eventId: shared.eventId },
      });

      return { codes: created };
    }),
});
