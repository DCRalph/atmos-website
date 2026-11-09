import "server-only";

import { createHash } from "node:crypto";

import {
  MailoutRecipientStatus,
  MailoutStatus,
  type Mailout,
} from "~Prisma/client";
import { env } from "~/env";
import { buildMediaUrl } from "~/lib/media-url";
import { personalise, renderMailout } from "~/lib/mailouts/render";
import { SITE_URL } from "~/lib/seo-constants";
import { CONTACT } from "~/lib/site-constants";
import { db } from "~/server/db";
import { sendEmail, sendEmailBatch } from "~/server/email/send";
import { preferencesUrl, unsubscribeHeaders, unsubscribeToken } from "./links";

/**
 * Sending a mailout.
 *
 * Starting one (now, or when its time comes) freezes the email and writes a
 * `MailoutRecipient` row for everyone on its lists. `drainMailouts` then sends
 * those rows 100 at a time. It runs straight after a send is started and from
 * a cron every minute, and the two can overlap: rows are claimed with
 * `FOR UPDATE SKIP LOCKED`, so no row is ever sent by both.
 */

/** Resend takes at most 100 emails per batch call. */
const BATCH_SIZE = 100;
/** Resend allows 2 requests a second by default. */
const PAUSE_MS = 500;
/** A batch that fails this many times gives up on its rows. */
const MAX_ATTEMPTS = 3;

type Renderable = Pick<
  Mailout,
  | "slug"
  | "subject"
  | "previewText"
  | "heading"
  | "body"
  | "imageFileId"
  | "buttonLabel"
  | "buttonUrl"
  | "listIds"
>;

/** The email a mailout draws, with the unsubscribe link still a placeholder.
 * The admin preview, test sends and the real send all come through here. */
export async function renderForMailout(mailout: Renderable) {
  const lists = await db.mailingList.findMany({
    where: { id: { in: mailout.listIds } },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return renderMailout(
    {
      subject: mailout.subject,
      previewText: mailout.previewText,
      heading: mailout.heading,
      body: mailout.body,
      imageUrl: mailout.imageFileId ? buildMediaUrl(mailout.imageFileId) : null,
      buttonLabel: mailout.buttonLabel,
      buttonUrl: mailout.buttonUrl,
    },
    {
      siteUrl: SITE_URL,
      slug: mailout.slug,
      listNames: lists.map((list) => list.name),
      contactEmail: CONTACT.email,
    },
  );
}

/** What stops a mailout from being sent, or null when it is ready. */
export async function sendProblem(mailout: Renderable): Promise<string | null> {
  if (!mailout.subject.trim()) return "Give it a subject.";
  if (!mailout.listIds.length) return "Pick at least one list.";
  const lists = await db.mailingList.count({
    where: { id: { in: mailout.listIds }, archivedAt: null },
  });
  if (lists !== mailout.listIds.length) {
    return "One of its lists has been archived. Pick again.";
  }
  if (mailout.buttonLabel?.trim() && !mailout.buttonUrl?.trim()) {
    return "The button needs a link.";
  }
  return null;
}

/**
 * The people a mailout would go to right now: on any of its lists, still
 * subscribed, and not suppressed. Counted once each.
 */
export function audienceWhere(listIds: string[]) {
  return {
    suppressedAt: null,
    memberships: {
      some: { listId: { in: listIds }, unsubscribedAt: null },
    },
  };
}

/**
 * Send one copy to a staff address. It says it is a test, and its unsubscribe
 * link goes nowhere real.
 */
export async function sendTest(mailout: Renderable, to: string) {
  const email = personalise(
    await renderForMailout(mailout),
    `${SITE_URL}/unsubscribe/test`,
  );
  return sendEmail({
    from: "news",
    to,
    subject: `[Test] ${mailout.subject || "(no subject)"}`,
    ...email,
  });
}

/**
 * Freeze a draft or scheduled mailout and queue everyone it goes to. Returns
 * how many were queued, or null if it was not in a state to start (already
 * started, cancelled, or edited since it was read).
 */
export async function startMailout(id: string): Promise<number | null> {
  const mailout = await db.mailout.findUnique({ where: { id } });
  if (
    !mailout ||
    (mailout.status !== MailoutStatus.DRAFT &&
      mailout.status !== MailoutStatus.SCHEDULED)
  ) {
    return null;
  }
  const email = await renderForMailout(mailout);

  return db.$transaction(async (tx) => {
    // `updatedAt` in the match means an edit that landed after the render
    // above stops this start, rather than sending the old version.
    const claimed = await tx.mailout.updateMany({
      where: {
        id,
        status: mailout.status,
        updatedAt: mailout.updatedAt,
      },
      data: {
        status: MailoutStatus.SENDING,
        startedAt: new Date(),
        html: email.html,
        text: email.text,
      },
    });
    if (!claimed.count) return null;

    const queued = await tx.$executeRaw`
      INSERT INTO "mailout_recipient" ("id", "mailoutId", "subscriberId", "email")
      SELECT gen_random_uuid()::text, ${id}, s."id", s."email"
      FROM "subscriber" s
      WHERE s."suppressedAt" IS NULL
        AND EXISTS (
          SELECT 1 FROM "list_membership" m
          WHERE m."subscriberId" = s."id"
            AND m."unsubscribedAt" IS NULL
            AND m."listId" = ANY(${mailout.listIds}::text[])
        )
      ON CONFLICT ("mailoutId", "subscriberId") DO NOTHING`;

    if (queued === 0) {
      await tx.mailout.update({
        where: { id },
        data: { status: MailoutStatus.SENT, finishedAt: new Date() },
      });
    }
    return queued;
  });
}

/** Stop a scheduled or sending mailout. Anyone not yet sent to is skipped. */
export async function cancelMailout(id: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.mailout.updateMany({
      where: {
        id,
        status: { in: [MailoutStatus.SCHEDULED, MailoutStatus.SENDING] },
      },
      data: {
        status: MailoutStatus.CANCELLED,
        cancelledAt: new Date(),
        finishedAt: new Date(),
      },
    });
    if (!count) return false;
    await tx.mailoutRecipient.updateMany({
      where: { mailoutId: id, status: MailoutRecipientStatus.QUEUED },
      data: { status: MailoutRecipientStatus.SKIPPED, error: "Cancelled" },
    });
    return true;
  });
}

/**
 * Queue again the recipients Resend never took, and send them. One it took
 * and later reported failed or suppressed stays failed: that is Resend's
 * answer about the address, and resending it would replay that answer.
 */
export async function retryFailed(id: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.mailoutRecipient.updateMany({
      where: {
        mailoutId: id,
        status: MailoutRecipientStatus.FAILED,
        resendId: null,
      },
      // Rows that failed as a batch keep its key and go again as it: Resend
      // may have taken that batch without saying so.
      data: { status: MailoutRecipientStatus.QUEUED, attempts: 0, error: null },
    });
    if (count) {
      await tx.mailout.updateMany({
        where: { id, status: MailoutStatus.SENT },
        data: { status: MailoutStatus.SENDING, finishedAt: null },
      });
    }
    return count;
  });
}

type Claimed = {
  id: string;
  subscriberId: string;
  email: string;
  batchKey: string | null;
};

type BatchOutcome = "sent" | "rate-limited" | "empty";

/**
 * Claim and send one batch of a sending mailout. Rows whose person left or
 * was suppressed after they were queued are skipped here, so an unsubscribe
 * is honoured even halfway through a send.
 *
 * A batch that failed keeps its key on its rows, and is retried first, as
 * exactly those people, unchecked, under that key. If Resend took it and only
 * the answer was lost, the retry is a no-op there rather than a second email
 * to everyone in it; regrouping or skipping anyone would change the key.
 */
async function sendBatch(mailout: {
  id: string;
  subject: string;
  html: string;
  text: string;
  listIds: string[];
}): Promise<BatchOutcome> {
  return db.$transaction(
    async (tx) => {
      // A failed batch first, locked whole: waiting on a worker that holds
      // it rather than skipping, so it is never sent as part of itself.
      const [keyed] = await tx.$queryRaw<{ batchKey: string }[]>`
        SELECT "batchKey" FROM "mailout_recipient"
        WHERE "mailoutId" = ${mailout.id} AND "status" = 'QUEUED'
          AND "batchKey" IS NOT NULL
        LIMIT 1`;
      let claimed = keyed
        ? await tx.$queryRaw<Claimed[]>`
            SELECT r."id", r."subscriberId", r."email", r."batchKey"
            FROM "mailout_recipient" r
            WHERE r."mailoutId" = ${mailout.id} AND r."status" = 'QUEUED'
              AND r."batchKey" = ${keyed.batchKey}
            ORDER BY r."id"
            FOR UPDATE`
        : [];
      if (!claimed.length) {
        claimed = await tx.$queryRaw<Claimed[]>`
          SELECT r."id", r."subscriberId", r."email", r."batchKey"
          FROM "mailout_recipient" r
          WHERE r."mailoutId" = ${mailout.id} AND r."status" = 'QUEUED'
            AND r."batchKey" IS NULL
          ORDER BY r."id"
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED`;
      }
      if (!claimed.length) return "empty";

      const retryKey = claimed[0]!.batchKey;
      const retrying = retryKey !== null;
      const stillWanted = new Set(
        retrying
          ? claimed.map((row) => row.subscriberId)
          : (
              await tx.subscriber.findMany({
                where: {
                  id: { in: claimed.map((row) => row.subscriberId) },
                  ...audienceWhere(mailout.listIds),
                },
                select: { id: true },
              })
            ).map((subscriber) => subscriber.id),
      );
      const skip = claimed.filter((row) => !stillWanted.has(row.subscriberId));
      const send = claimed.filter((row) => stillWanted.has(row.subscriberId));
      if (skip.length) {
        await tx.mailoutRecipient.updateMany({
          where: { id: { in: skip.map((row) => row.id) } },
          data: {
            status: MailoutRecipientStatus.SKIPPED,
            error: "Unsubscribed or suppressed before it went",
          },
        });
      }
      if (!send.length) return "sent";

      if (!env.RESEND_API_KEY) {
        await tx.mailoutRecipient.updateMany({
          where: { id: { in: send.map((row) => row.id) } },
          data: {
            status: MailoutRecipientStatus.FAILED,
            error: "RESEND_API_KEY not set",
          },
        });
        return "sent";
      }

      const key =
        retryKey ??
        createHash("sha256")
          .update(send.map((row) => row.id).join(","))
          .digest("hex");
      const result = await sendEmailBatch(
        send.map((row) => {
          const token = unsubscribeToken(row.subscriberId, mailout.id);
          return {
            from: "news" as const,
            to: row.email,
            subject: mailout.subject,
            ...personalise(mailout, preferencesUrl(token)),
            headers: unsubscribeHeaders(token),
            tags: [
              { name: "mailout_id", value: mailout.id },
              { name: "recipient_id", value: row.id },
            ],
          };
        }),
        { idempotencyKey: `mailout/${mailout.id}/${key}`, permissive: true },
      );

      if (!result.ok) {
        if (result.rateLimited) return "rate-limited";
        // Counted against every row, and given up on after a few tries.
        await tx.$executeRaw`
          UPDATE "mailout_recipient"
          SET "attempts" = "attempts" + 1,
              "batchKey" = ${key},
              "error" = ${result.error ?? "Send failed"},
              "status" = CASE WHEN "attempts" + 1 >= ${MAX_ATTEMPTS}
                THEN 'FAILED'::"MailoutRecipientStatus" ELSE "status" END
          WHERE "id" = ANY(${send.map((row) => row.id)}::text[])`;
        return "sent";
      }

      const now = new Date();
      const results = result.results ?? [];
      const sent = send.flatMap((row, index) => {
        const outcome = results[index];
        return outcome && "id" in outcome
          ? [{ id: row.id, resendId: outcome.id }]
          : [];
      });
      const refused = send.flatMap((row, index) => {
        const outcome = results[index];
        return outcome && "error" in outcome
          ? [{ id: row.id, error: outcome.error }]
          : [];
      });
      if (sent.length) {
        await tx.$executeRaw`
          UPDATE "mailout_recipient" r
          SET "status" = 'SENT', "resendId" = v."resendId", "sentAt" = ${now},
              "attempts" = r."attempts" + 1, "error" = NULL
          FROM unnest(${sent.map((row) => row.id)}::text[], ${sent.map((row) => row.resendId)}::text[])
            AS v("id", "resendId")
          WHERE r."id" = v."id"`;
      }
      for (const row of refused) {
        await tx.mailoutRecipient.update({
          where: { id: row.id },
          // Refused on its own, so its retry is a batch of its own.
          data: {
            status: MailoutRecipientStatus.FAILED,
            attempts: { increment: 1 },
            batchKey: null,
            error: row.error,
          },
        });
      }
      return "sent";
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

/** Mark a sending mailout sent once nothing of it is left in the queue. */
async function finishIfDone(id: string) {
  const left = await db.mailoutRecipient.count({
    where: { mailoutId: id, status: MailoutRecipientStatus.QUEUED },
  });
  if (left) return false;
  await db.mailout.updateMany({
    where: { id, status: MailoutStatus.SENDING },
    data: { status: MailoutStatus.SENT, finishedAt: new Date() },
  });
  return true;
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * Start any scheduled mailout that is due, then send queued rows until the
 * queue is empty or `budgetMs` runs out. Whatever is left, the next run picks
 * up.
 */
export async function drainMailouts({ budgetMs = 45_000 } = {}) {
  const deadline = Date.now() + budgetMs;

  const due = await db.mailout.findMany({
    where: {
      status: MailoutStatus.SCHEDULED,
      scheduledFor: { lte: new Date() },
    },
    select: { id: true },
  });
  for (const mailout of due) await startMailout(mailout.id);

  let batches = 0;
  const sending = await db.mailout.findMany({
    where: { status: MailoutStatus.SENDING },
    orderBy: { startedAt: "asc" },
    select: { id: true, subject: true, html: true, text: true, listIds: true },
  });
  for (const mailout of sending) {
    if (!mailout.html || !mailout.text) continue;
    const frozen = { ...mailout, html: mailout.html, text: mailout.text };
    while (Date.now() < deadline) {
      const outcome = await sendBatch(frozen);
      if (outcome === "empty") break;
      batches += 1;
      await sleep(outcome === "rate-limited" ? PAUSE_MS * 2 : PAUSE_MS);
    }
    await finishIfDone(mailout.id);
    if (Date.now() >= deadline) break;
  }

  return { started: due.length, batches };
}
