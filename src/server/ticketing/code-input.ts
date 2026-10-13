import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DiscountCodeType, EventCodeType } from "~Prisma/client";

/**
 * The fields global and event codes share, and the rules across them. Each
 * router adds what only its kind has.
 */
export const codeFieldsSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dashes and underscores only"),
  type: z.enum([DiscountCodeType.PERCENT, DiscountCodeType.FIXED]),
  /** Basis points for PERCENT, cents for FIXED, zero for UNLOCK. */
  value: z.number().int().min(0),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  maxPerEmail: z.number().int().min(1).nullable().optional(),
  minTickets: z.number().int().min(1).nullable().optional(),
  startsAt: z.date().nullable().optional(),
  endsAt: z.date().nullable().optional(),
  isActive: z.boolean().default(true),
});

/**
 * An event's own code. A discount here can be scoped to some of the event's
 * tiers, and UNLOCK opens hidden ones: `tierIds` says which, either way.
 */
export const eventCodeFieldsSchema = codeFieldsSchema.extend({
  type: z.enum(EventCodeType),
  /** Tiers the discount applies to (empty is all), or the tiers it unlocks. */
  tierIds: z.array(z.string()).default([]),
});

/**
 * A discount takes something off; an unlock takes nothing off and names the
 * tiers it opens. Shared by global and event codes.
 */
export function assertCodeRules(code: {
  type: DiscountCodeType | EventCodeType;
  value: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  tierIds?: readonly string[];
}) {
  if (code.type === EventCodeType.UNLOCK) {
    if (code.value !== 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "An unlock code takes nothing off. Price the hidden tier instead.",
      });
    }
    if (!code.tierIds?.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Pick the tier this code unlocks.",
      });
    }
  } else if (code.value <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A discount needs to be worth more than zero.",
    });
  }
  if (code.type === DiscountCodeType.PERCENT && code.value > 10_000) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A percentage discount can't be more than 100%.",
    });
  }
  if (code.startsAt && code.endsAt && code.endsAt < code.startsAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The code can't expire before it starts.",
    });
  }
}
