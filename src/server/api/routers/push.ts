import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Device registration for push notifications.
 *
 * `publicProcedure` on purpose: somebody who has installed the app but never
 * signed in should still hear that a lineup dropped. The session is read when
 * it happens to be there and the row is claimed then — it is never required.
 */
export const pushRouter = createTRPCRouter({
  register: publicProcedure
    .input(
      z.object({
        token: z.string().min(10).max(200),
        platform: z.enum(["ios", "android"]),
        label: z.string().trim().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user.id ?? null;

      await ctx.db.deviceToken.upsert({
        where: { token: input.token },
        create: {
          token: input.token,
          platform: input.platform,
          label: input.label ?? null,
          userId,
        },
        // A handset that changes hands has to change owner with it, or the
        // last person's ticket reminders follow the phone.
        update: {
          platform: input.platform,
          label: input.label ?? undefined,
          userId,
          lastSeenAt: new Date(),
        },
      });

      return { ok: true as const };
    }),

  /**
   * Stop sending to this device.
   *
   * Called on sign-out as well as on an explicit mute, so a shared phone stops
   * receiving notifications about somebody else's tickets the moment they log
   * out.
   */
  unregister: publicProcedure
    .input(z.object({ token: z.string().min(10).max(200) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.deviceToken
        .delete({ where: { token: input.token } })
        .catch(() => undefined);
      return { ok: true as const };
    }),

  /** Per-device notification preferences. */
  setPreferences: publicProcedure
    .input(
      z.object({
        token: z.string().min(10).max(200),
        gigAnnouncements: z.boolean().optional(),
        doorReminders: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.deviceToken
        .update({
          where: { token: input.token },
          data: {
            gigAnnouncements: input.gigAnnouncements,
            doorReminders: input.doorReminders,
          },
        })
        .catch(() => undefined);
      return { ok: true as const };
    }),
});
