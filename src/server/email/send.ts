import "server-only";

import { type Attachment, Resend } from "resend";

import { env } from "~/env";
import { EMAIL_SENDERS, type EmailSender } from "./senders";

/** Escape user-supplied text before it goes into an HTML email body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Inline attachment. `cid` matches a `cid:` reference in the HTML — used for
 * ticket QR codes, which must not depend on remote images being unblocked.
 */
export type EmailAttachment = {
  filename: string;
  content: Buffer;
  cid?: string;
  contentType?: string;
};

export type SendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  resendClient ??= new Resend(env.RESEND_API_KEY);
  return resendClient;
}

/**
 * Send one email through Resend.
 *
 * Never throws: every outcome comes back as a `SendResult`, so callers decide
 * whether a failure is worth surfacing (account deletion) or just logging
 * (contact form). Without `RESEND_API_KEY` nothing is sent, which keeps local
 * development quiet.
 */
export async function sendEmail({
  from,
  to,
  subject,
  html,
  text,
  attachments = [],
  replyTo,
}: {
  from: EmailSender;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — "${subject}" not sent.`);
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_SENDERS[from],
      to,
      subject,
      html,
      text,
      replyTo,
      // Typed so a misspelt key is an error: an object literal returned from
      // `map` skips excess-property checks, which is how `content_id` (ignored
      // by the SDK) once sent every QR as a plain attachment.
      attachments: attachments.map((attachment): Attachment => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        // Inline images are referenced as `cid:<contentId>` in the HTML.
        contentId: attachment.cid,
      })),
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, messageId: data?.id };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

/** What `sendEmailBatch` reports: a `SendResult`, plus how each email went
 * when the batch did. */
export type BatchSendResult = SendResult & {
  /** One per email, in the order given. With `permissive`, an address Resend
   * refused has an error here while the rest of the batch still went. */
  results?: ({ id: string } | { error: string })[];
  /** True when Resend refused for going too fast, so it is worth trying again
   * in a moment rather than counting against the batch. */
  rateLimited?: boolean;
};

/**
 * Send up to 100 emails in one Resend call, for mail going to a list. Same
 * contract as `sendEmail`: never throws, and the whole batch succeeds or fails
 * together. `idempotencyKey` makes a retried or doubled batch a no-op on
 * Resend's side for 24 hours.
 *
 * `headers` carry things like `List-Unsubscribe`; `tags` come back on every
 * webhook event about that email. `permissive` lets one bad address fail on
 * its own instead of taking the other 99 down with it.
 */
export async function sendEmailBatch(
  emails: {
    from: EmailSender;
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
    headers?: Record<string, string>;
    tags?: { name: string; value: string }[];
  }[],
  {
    idempotencyKey,
    permissive = false,
  }: { idempotencyKey?: string; permissive?: boolean } = {},
): Promise<BatchSendResult> {
  const resend = getResend();
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — batch of ${emails.length} not sent.`,
    );
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  try {
    const { data, error } = await resend.batch.send(
      emails.map(({ from, ...email }) => ({
        ...email,
        from: EMAIL_SENDERS[from],
      })),
      { idempotencyKey, batchValidation: permissive ? "permissive" : "strict" },
    );
    if (error) {
      return {
        ok: false,
        error: error.message,
        rateLimited: error.name === "rate_limit_exceeded",
      };
    }
    // Resend lists the ids of the emails it took, in order, and the indexes of
    // any it refused, so the two are zipped back into one entry per email.
    const refused = new Map(
      ("errors" in data && Array.isArray(data.errors) ? data.errors : []).map(
        (failure: { index: number; message: string }) => [
          failure.index,
          failure.message,
        ],
      ),
    );
    const ids = data.data.map((sent) => sent.id);
    const results = emails.map((_, index) => {
      const message = refused.get(index);
      if (message !== undefined) return { error: message };
      const id = ids.shift();
      return id ? { id } : { error: "Resend returned no id" };
    });
    return { ok: true, results };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}
