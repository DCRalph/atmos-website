import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DiscountCodeType } from "~Prisma/client";

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
  /** Basis points for PERCENT, cents for FIXED. Zero only on an unlock code. */
  value: z.number().int().min(0),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  maxPerEmail: z.number().int().min(1).nullable().optional(),
  minTickets: z.number().int().min(1).nullable().optional(),
  startsAt: z.date().nullable().optional(),
  endsAt: z.date().nullable().optional(),
  isActive: z.boolean().default(true),
});

/** Only a code that unlocks tiers may be worth nothing. */
export function assertCodeRules(code: {
  type: DiscountCodeType;
  value: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  unlocksHiddenTiers?: boolean;
}) {
  if (code.value === 0 && !code.unlocksHiddenTiers) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A code that unlocks nothing needs a discount above zero.",
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
