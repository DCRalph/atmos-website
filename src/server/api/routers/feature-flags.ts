import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { isFeatureEnabled, setKeyValue } from "~/server/feature-flags";

/**
 * Central list of known flag keys. Keeping them listed here means the
 * client can refer to them via the const union instead of magic strings.
 */
export const FEATURE_FLAGS = {} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

const flagSchema = z.object({
  flag: z.string(),
  /** Default value to return when the key is not set. Default `true`. */
  defaultEnabled: z.boolean().optional(),
});

export const featureFlagsRouter = createTRPCRouter({
  /** Resolve a single flag. Public so it can gate anonymous UI. */
  get: publicProcedure.input(flagSchema).query(async ({ input }) => {
    return isFeatureEnabled(input.flag, input.defaultEnabled ?? true);
  }),

  /** Admin-only setter for toggling flags via UI/scripts. */
  set: adminProcedure
    .input(z.object({ flag: z.string(), value: z.boolean() }))
    .mutation(async ({ input }) => {
      await setKeyValue(input.flag, input.value ? "true" : "false");
      return { ok: true as const };
    }),
});
