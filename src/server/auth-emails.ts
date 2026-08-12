import "server-only";

import { sendTransactional } from "~/server/ticketing/email/provider";

/**
 * The "confirm your email" mail.
 *
 * Its own small template rather than a ticketing one: this is the only
 * transactional mail that is not about an order, and hanging it off the ticket
 * templates would drag event names and totals through a message that has
 * neither.
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

export function renderVerificationEmail({
  name,
  url,
}: {
  name: string | null;
  url: string;
}): { subject: string; html: string; text: string } {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const safeUrl = escapeHtml(url);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>Confirm your email</title>
</head>
<body style="margin:0;padding:0;background:${BG};color:${TEXT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
  <tr><td style="padding:8px 4px 20px;">
    <span style="font-size:18px;font-weight:700;letter-spacing:0.18em;color:#ffffff;">ATMOS</span>
  </td></tr>
  <tr><td style="background:${CARD};border:1px solid ${BORDER};border-radius:12px;padding:28px 24px;">
    <p style="margin:0 0 14px;font-size:20px;font-weight:700;color:${TEXT};">Confirm your email</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${TEXT};">${greeting}</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:${MUTED};">
      Tap the button to confirm this address. It links any tickets you have
      already bought with this email to your account, so they show up in the
      Atmos app.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td>
      <a href="${safeUrl}"
         style="display:inline-block;background:#ffffff;color:#000000;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;">
        Confirm email
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
    If you did not create an Atmos account, ignore this — nothing happens
    until the link is used.
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    greeting.replace(/<[^>]*>/g, ""),
    "",
    "Confirm your email address to link tickets you've already bought to your Atmos account:",
    url,
    "",
    "The link works once and expires in an hour.",
    "If you didn't create an Atmos account, ignore this.",
  ].join("\n");

  return { subject: "Confirm your Atmos email", html, text };
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
