import nodemailer from "nodemailer";
import { env } from "~/env";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT ?? "587"),
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

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

export async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments,
  replyTo,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}) {
  if (!env.SMTP_HOST) {
    console.warn("SMTP_HOST not set, skipping email notification");
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text,
      html,
      replyTo,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        cid: attachment.cid,
        contentDisposition: attachment.cid ? "inline" : "attachment",
      })),
    });
    console.log("Email sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
