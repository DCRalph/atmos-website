import "server-only";

import { Resend } from "resend";

import { env } from "~/env";
import { sendEmail, type EmailAttachment } from "~/server/utils/email";

/**
 * Transactional mail for ticketing.
 *
 * Resend when it is configured, the site's existing SMTP transport otherwise,
 * so local development and the contact form keep working untouched. Ticket
 * email is the product — if it does not arrive, somebody is standing outside a
 * venue — so every send is reported back to the caller with a message id or an
 * error to log against the order.
 */

export type SendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
  provider: "resend" | "smtp" | "none";
};

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  resendClient ??= new Resend(env.RESEND_API_KEY);
  return resendClient;
}

function fromAddress(): string {
  return env.RESEND_FROM ?? env.SMTP_FROM ?? "tickets@atmosmedia.co.nz";
}

export async function sendTransactional({
  to,
  subject,
  html,
  text,
  attachments = [],
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}): Promise<SendResult> {
  const resend = getResend();

  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: fromAddress(),
        to,
        subject,
        html,
        text,
        replyTo,
        attachments: attachments.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          // Inline images are referenced as `cid:<content_id>` in the HTML.
          content_id: attachment.cid,
        })),
      });

      if (error) {
        return { ok: false, error: error.message, provider: "resend" };
      }
      return { ok: true, messageId: data?.id, provider: "resend" };
    } catch (cause) {
      return {
        ok: false,
        error: cause instanceof Error ? cause.message : String(cause),
        provider: "resend",
      };
    }
  }

  if (!env.SMTP_HOST) {
    console.warn(
      "[ticketing] No RESEND_API_KEY and no SMTP_HOST — ticket email not sent.",
    );
    return { ok: false, error: "No email provider configured", provider: "none" };
  }

  try {
    const info = await sendEmail({
      to,
      subject,
      text,
      html,
      attachments,
      replyTo,
    });
    return { ok: true, messageId: info?.messageId, provider: "smtp" };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
      provider: "smtp",
    };
  }
}
