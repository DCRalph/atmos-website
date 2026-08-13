import { z } from "zod";

import { ActivityType } from "~Prisma/client";
import {
  adminProcedure,
  createTRPCRouter,
  doorProcedure,
} from "~/server/api/trpc";
import {
  eligibleStaffUserIds,
  sendTapToPayLaunchCampaign,
} from "~/server/ticketing/tap-to-pay-launch";
import { logActivity } from "~/server/utils/activity-log";

/**
 * The Tap to Pay on iPhone launch communications.
 *
 * Apple's App Review checklist requires each eligible user to be told about Tap
 * to Pay at least once, through a splash screen (3.2, 6.2), a push notification
 * (3.3, 6.3) and an email (6.1). This router is the record of who has been
 * told — see `~/server/ticketing/tap-to-pay-launch` for why that record has to
 * exist at all.
 */
export const tapToPayRouter = createTRPCRouter({
  /**
   * Should this handset show the launch splash?
   *
   * `doorProcedure`, so a punter is refused and the app never asks again — the
   * splash is only for people who could actually use the feature.
   */
  announcement: doorProcedure.query(async ({ ctx }) => {
    const record = await ctx.db.tapToPayAnnouncement.findUnique({
      where: { userId: ctx.user.id },
      select: { splashSeenAt: true },
    });

    return { showSplash: !record?.splashSeenAt };
  }),

  /**
   * Recorded per user rather than per install.
   *
   * Checklist 6.2 asks for the splash to be seen "at least once", and a flag
   * kept on the device would be lost on reinstall and duplicated across the
   * shared handsets a door actually runs on.
   */
  markSplashSeen: doorProcedure.mutation(async ({ ctx }) => {
    await ctx.db.tapToPayAnnouncement.upsert({
      where: { userId: ctx.user.id },
      create: { userId: ctx.user.id, splashSeenAt: new Date() },
      update: { splashSeenAt: new Date() },
    });
    return { ok: true as const };
  }),

  /** How far the launch campaign has got, for the admin who has to run it. */
  campaignStatus: adminProcedure.query(async ({ ctx }) => {
    const userIds = await eligibleStaffUserIds();
    const records = await ctx.db.tapToPayAnnouncement.findMany({
      where: { userId: { in: userIds } },
      select: { splashSeenAt: true, pushSentAt: true, emailSentAt: true },
    });

    return {
      eligible: userIds.length,
      pushed: records.filter((row) => row.pushSentAt).length,
      emailed: records.filter((row) => row.emailSentAt).length,
      splashSeen: records.filter((row) => row.splashSeenAt).length,
    };
  }),

  /**
   * Send the launch push and email to everybody who has not had them.
   *
   * Admin-only and idempotent, so it can be re-run after a partial failure
   * without anybody being told twice.
   */
  sendLaunchCampaign: adminProcedure
    .input(
      z
        .object({
          push: z.boolean().default(true),
          email: z.boolean().default(true),
        })
        .default({ push: true, email: true }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await sendTapToPayLaunchCampaign({
        channels: { push: input.push, email: input.email },
      });

      await logActivity({
        type: ActivityType.OTHER,
        action: `Sent the Tap to Pay on iPhone launch campaign — ${result.pushed} pushed, ${result.emailed} emailed of ${result.eligible} eligible`,
        userId: ctx.user.id,
        details: result,
      });

      return result;
    }),
});
