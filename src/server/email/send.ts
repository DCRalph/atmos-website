import "server-only";

import { Resend } from "resend";

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
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        // Inline images are referenced as `cid:<content_id>` in the HTML.
        content_id: attachment.cid,
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
