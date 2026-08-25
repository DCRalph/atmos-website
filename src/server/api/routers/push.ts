import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getUserPermissions } from "~/server/utils/permissions";
import { defaultTopicsFor } from "~/lib/notify/topics";

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

      const existing = await ctx.db.deviceToken.findUnique({
        where: { token: input.token },
        select: { userId: true },
      });

      // Topics are seeded on the first registration and again when the device
      // changes hands, never on an ordinary launch — otherwise a topic taken
      // off a device in the admin comes straight back the next time the app
      // opens. See `defaultTopicsFor`.
      const reseed = existing?.userId !== userId;
      const topics = reseed
        ? defaultTopicsFor(userId ? await getUserPermissions(userId) : [])
        : undefined;

      await ctx.db.deviceToken.upsert({
        where: { token: input.token },
        create: {
          token: input.token,
          platform: input.platform,
          label: input.label ?? null,
          userId,
          topics: topics ?? [],
        },
        // A handset that changes hands has to change owner with it, or the
        // last person's ticket reminders follow the phone.
        update: {
          platform: input.platform,
          label: input.label ?? undefined,
          userId,
          topics,
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

  /**
   * What this device is currently set to.
   *
   * Keyed on the token rather than the session for the same reason `register`
   * is: preferences belong to the handset, and a signed-out install still has
   * them. Returns `null` for a token the server has never seen, which is what
   * the settings screen shows as "not registered".
   */
  preferences: publicProcedure
    .input(z.object({ token: z.string().min(10).max(200) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.deviceToken.findUnique({
        where: { token: input.token },
        select: { gigAnnouncements: true, doorReminders: true },
      });
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
