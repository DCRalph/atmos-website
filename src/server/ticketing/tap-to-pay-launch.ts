import "server-only";

import { db } from "~/server/db";
import { sendPush } from "~/server/push";
import { sendTransactional } from "~/server/ticketing/email/provider";
import { renderTapToPayLaunchEmail } from "~/server/ticketing/email/templates";
import { getTicketingSettings } from "~/server/ticketing/settings";
import { env } from "~/env";

/**
 * Telling Atmos staff that Tap to Pay on iPhone exists.
 *
 * Apple's App Review checklist asks for three separate launch communications,
 * each of which must reach every eligible user **at least once**:
 *
 * - **3.3 / 6.3** a push notification, using the 'Value Proposition' copy from
 *   the Tap to Pay on iPhone Marketing Guide's push guidelines.
 * - **6.2** an in-app splash, using the 'Hero' in-app banner.
 * - **6.1** a dedicated launch email, using the 'Launch' email.
 *
 * "At least once" is the load-bearing phrase, and the reason `TapToPayAnnouncement`
 * exists: without a per-user record, a campaign is either sent repeatedly or
 * sent once into the void with no way to answer Apple's question about coverage.
 *
 * ---
 *
 * ⚠️ **The copy below is structurally correct and not yet Apple-approved.**
 *
 * Rows 1.9 and 6.x require the wording and artwork to come from the Tap to Pay
 * on iPhone Marketing Guide and Toolkit, reachable through Stripe's partner
 * portal or the VIP link in the checklist itself. Swap the strings marked
 * `PLACEHOLDER` for the approved 'Value Proposition' and 'Launch' copy, and put
 * the Hero banner in place, before submitting. Everything else — audience,
 * idempotency, delivery — is finished.
 */

/**
 * Everybody who could actually use Tap to Pay.
 *
 * Admins and event organisers have door access everywhere; anybody else needs a
 * `TicketEventStaff` row. Same rule as `doorProcedure`, because an announcement
 * that reaches somebody the door would refuse is worse than no announcement.
 */
export async function eligibleStaffUserIds(): Promise<string[]> {
  const [privileged, rostered] = await Promise.all([
    db.userPermissionAssignment.findMany({
      where: { permission: { in: ["ADMIN", "EVENT_ORGANISER"] } },
      select: { userId: true },
    }),
    db.ticketEventStaff.findMany({
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  return [
    ...new Set([
      ...privileged.map((row) => row.userId),
      ...rostered.map((row) => row.userId),
    ]),
  ];
}

/** PLACEHOLDER — replace with the Marketing Guide's 'Value Proposition' copy. */
const PUSH_TITLE = "Take card payments on your iPhone";
const PUSH_BODY =
  "Tap to Pay on iPhone is now available in Atmos. Accept contactless cards and Apple Pay at the door — no extra reader needed.";

export type CampaignResult = {
  eligible: number;
  pushed: number;
  emailed: number;
  emailFailures: number;
};

/**
 * Send the launch push and the launch email, once each, per person.
 *
 * Safe to run more than once: everybody already recorded is skipped, so a
 * partial run can simply be repeated. That matters because the two channels
 * fail independently — Expo can be up while Resend is down.
 */
export async function sendTapToPayLaunchCampaign({
  channels = { push: true, email: true },
}: {
  channels?: { push: boolean; email: boolean };
} = {}): Promise<CampaignResult> {
  const userIds = await eligibleStaffUserIds();
  if (userIds.length === 0) {
    return { eligible: 0, pushed: 0, emailed: 0, emailFailures: 0 };
  }

  const already = await db.tapToPayAnnouncement.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, pushSentAt: true, emailSentAt: true },
  });
  const seen = new Map(already.map((row) => [row.userId, row]));

  const needPush = channels.push
    ? userIds.filter((id) => !seen.get(id)?.pushSentAt)
    : [];
  const needEmail = channels.email
    ? userIds.filter((id) => !seen.get(id)?.emailSentAt)
    : [];

  let pushed = 0;
  if (needPush.length > 0) {
    const result = await sendPush({
      audience: { kind: "users", userIds: needPush },
      title: PUSH_TITLE,
      body: PUSH_BODY,
      // Lands on the Tap to Pay hub, which is where enabling it happens (3.6).
      data: { url: "/(door)/tap-to-pay" },
    });
    pushed = result.sent;

    await Promise.all(
      needPush.map((userId) =>
        db.tapToPayAnnouncement
          .upsert({
            where: { userId },
            create: { userId, pushSentAt: new Date() },
            update: { pushSentAt: new Date() },
          })
          .catch(() => undefined),
      ),
    );
  }

  let emailed = 0;
  let emailFailures = 0;

  if (needEmail.length > 0) {
    const [users, settings] = await Promise.all([
      db.user.findMany({
        where: { id: { in: needEmail } },
        select: { id: true, name: true, email: true },
      }),
      getTicketingSettings(),
    ]);

    const hubUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/tickets`;

    for (const user of users) {
      const { subject, html, text } = renderTapToPayLaunchEmail({
        recipientName: user.name,
        appUrl: hubUrl,
        supportEmail: settings.supportEmail,
      });

      const result = await sendTransactional({
        to: user.email,
        subject,
        html,
        text,
        replyTo: settings.supportEmail ?? undefined,
      });

      if (result.ok) {
        emailed += 1;
        await db.tapToPayAnnouncement
          .upsert({
            where: { userId: user.id },
            create: { userId: user.id, emailSentAt: new Date() },
            update: { emailSentAt: new Date() },
          })
          .catch(() => undefined);
      } else {
        // Left unrecorded on purpose, so the next run picks it up again.
        emailFailures += 1;
      }
    }
  }

  return {
    eligible: userIds.length,
    pushed,
    emailed,
    emailFailures,
  };
}
