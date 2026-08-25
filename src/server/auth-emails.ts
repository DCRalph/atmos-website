import "server-only";

import { sendTransactional } from "~/server/ticketing/email/provider";

/**
 * The account mails: confirm your email, reset your password, delete your
 * account.
 *
 * Their own small templates rather than ticketing ones — these are the only
 * transactional mail that is not about an order, and hanging them off the
 * ticket templates would drag event names and totals through messages that
 * have neither.
 *
 * Written as tables with inline styles, like the rest — that is what survives
 * Outlook and Gmail clipping.
 */

const BG = "#0b0b0c";
const CARD = "#141416";
const BORDER = "#2a2a2e";
const TEXT = "#f4f4f5";
const MUTED = "#a1a1aa";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The shared shell: wordmark, card, one button, the paste-this fallback.
 *
 * All three are the same shape — a sentence of context and a single link — so
 * they are one template with the words passed in rather than three copies of
 * the same sixty lines of table markup drifting apart.
 */
function renderActionEmail({
  heading,
  greeting,
  blurb,
  cta,
  url,
  footer,
}: {
  heading: string;
  greeting: string;
  blurb: string;
  cta: string;
  url: string;
  footer: string;
}): { html: string; text: string } {
  const safeUrl = escapeHtml(url);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};color:${TEXT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
  <tr><td style="padding:8px 4px 20px;">
    <span style="font-size:18px;font-weight:700;letter-spacing:0.18em;color:#ffffff;">ATMOS</span>
  </td></tr>
  <tr><td style="background:${CARD};border:1px solid ${BORDER};border-radius:12px;padding:28px 24px;">
    <p style="margin:0 0 14px;font-size:20px;font-weight:700;color:${TEXT};">${escapeHtml(heading)}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${TEXT};">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:${MUTED};">
      ${escapeHtml(blurb)}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td>
      <a href="${safeUrl}"
         style="display:inline-block;background:#ffffff;color:#000000;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;">
        ${escapeHtml(cta)}
      </a>
    </td></tr></table>
    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:${MUTED};">
      The link works once and expires in an hour. If the button does not work,
      paste this into your browser:
    </p>
    <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all;">
      ${safeUrl}
    </p>
  </td></tr>
  <tr><td style="padding:24px 4px 8px;color:${MUTED};font-size:12px;line-height:1.6;">
    ${escapeHtml(footer)}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    greeting,
    "",
    blurb,
    url,
    "",
    "The link works once and expires in an hour.",
    footer,
  ].join("\n");

  return { html, text };
}

export function renderVerificationEmail({
  name,
  url,
}: {
  name: string | null;
  url: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: "Confirm your Atmos email",
    ...renderActionEmail({
      heading: "Confirm your email",
      greeting: name ? `Hi ${name},` : "Hi,",
      blurb:
        "Tap the button to confirm this address. It links any tickets you have already bought with this email to your account, so they show up in the Atmos app.",
      cta: "Confirm email",
      url,
      footer:
        "If you did not create an Atmos account, ignore this — nothing happens until the link is used.",
    }),
  };
}

export function renderPasswordResetEmail({
  name,
  url,
}: {
  name: string | null;
  url: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: "Reset your Atmos password",
    ...renderActionEmail({
      heading: "Reset your password",
      greeting: name ? `Hi ${name},` : "Hi,",
      blurb:
        "Tap the button to choose a new password. Your tickets and your account are untouched until you do.",
      cta: "Choose a new password",
      url,
      footer:
        "If you did not ask for this, ignore it — your password stays as it is until the link is used.",
    }),
  };
}

export function renderAccountDeletionEmail({
  name,
  url,
}: {
  name: string | null;
  url: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: "Confirm you want your Atmos account deleted",
    ...renderActionEmail({
      heading: "Delete your Atmos account",
      greeting: name ? `Hi ${name},` : "Hi,",
      blurb:
        "Somebody asked to delete this account from the Atmos app. Tap the button to go ahead. Your name, email and contact details are removed. Tickets you have already bought keep working at the door, and the orders behind them stay on our books because we are required to keep sales records.",
      cta: "Delete my account",
      url,
      footer:
        "If this was not you, ignore it — nothing is deleted until the link is used, and it is worth changing your password.",
    }),
  };
}

/** Fire the verification mail. Failures are logged, never thrown at the user. */
export async function sendVerificationEmail({
  to,
  name,
  url,
}: {
  to: string;
  name: string | null;
  url: string;
}): Promise<void> {
  const { subject, html, text } = renderVerificationEmail({ name, url });
  const result = await sendTransactional({ to, subject, html, text });

  if (!result.ok) {
    // Signing up should not fail because the mail provider hiccupped — the
    // user can ask for another from the account screen.
    console.error("[auth] verification email failed:", result.error);
  }
}

/**
 * Fire the password reset mail.
 *
 * Logged rather than thrown for the same reason as above, and for one more:
 * better-auth's "forgot password" endpoint deliberately answers the same way
 * whether or not the address exists, and an error surfacing here would leak
 * which is which.
 */
export async function sendPasswordResetEmail({
  to,
  name,
  url,
}: {
  to: string;
  name: string | null;
  url: string;
}): Promise<void> {
  const { subject, html, text } = renderPasswordResetEmail({ name, url });
  const result = await sendTransactional({ to, subject, html, text });

  if (!result.ok) {
    console.error("[auth] password reset email failed:", result.error);
  }
}

/**
 * Fire the "confirm you want your account deleted" mail.
 *
 * This one is thrown rather than logged, unlike its siblings. The others are
 * conveniences somebody can ask for again from a screen; this is the only step
 * in the deletion flow, and an account that silently fails to be deleted
 * because the mail provider hiccupped is worse than an error the person can act
 * on.
 */
export async function sendAccountDeletionEmail({
  to,
  name,
  url,
}: {
  to: string;
  name: string | null;
  url: string;
}): Promise<void> {
  const { subject, html, text } = renderAccountDeletionEmail({ name, url });
  const result = await sendTransactional({ to, subject, html, text });

  if (!result.ok) {
    throw new Error(`Could not send the account deletion email: ${result.error}`);
  }
}
