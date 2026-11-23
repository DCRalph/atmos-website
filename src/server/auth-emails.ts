import "server-only";

import { SITE_URL } from "~/lib/seo-constants";
import { MAGIC_LINK_EXPIRES_IN_MINUTES } from "~/lib/magic-link";
import { SITE_ACCENT } from "~/lib/site-constants";
import { escapeHtml, sendEmail } from "~/server/email/send";

/**
 * The account mails: sign-in link, confirm your email, reset your password,
 * delete your account.
 *
 * Their own small templates rather than ticketing ones — these are the only
 * transactional mail that is not about an order, and hanging them off the
 * ticket templates would drag event names and totals through messages that
 * have neither.
 *
 * Written as tables with inline styles, like the rest — that is what survives
 * Outlook and Gmail clipping.
 */

const BG = "#000000";
const TEXT = "#ffffff";
const BODY = "#d4d4d4";
const MUTED = "#999999";
const RULE = "#222222";

/**
 * The shared shell: logo, heading, a sentence of context, one lime pill
 * button, the paste-this fallback.
 *
 * Same look as the ticket and mailout emails (black, the logo image, the
 * site's lime pill) so account mail reads as Atmos rather than a generic auth
 * provider. All of them are the same shape, so they are one template with the
 * words passed in rather than copies of the same table markup drifting apart.
 */
function renderActionEmail({
  heading,
  preview,
  greeting,
  blurb,
  cta,
  url,
  expiry,
  footer,
}: {
  heading: string;
  /** Inbox preview line, hidden in the body. */
  preview: string;
  greeting: string;
  blurb: string;
  cta: string;
  url: string;
  /** How long the link lasts, as read in "expires in …". */
  expiry: string;
  footer: string;
}): { html: string; text: string } {
  const safeUrl = escapeHtml(url);
  const linkNote = `The link works once and expires in ${expiry}.`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};color:${TEXT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:8px 0 32px;">
  <img src="${SITE_URL}/email/atmos-logo.png" width="120" height="27" alt="ATMOS" style="display:block;width:120px;height:auto;border:0;">
</td></tr>
<tr><td style="padding:0 0 16px;font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};">${escapeHtml(heading)}</td></tr>
<tr><td style="padding:0 0 12px;font-size:16px;line-height:1.6;color:${BODY};">${escapeHtml(greeting)}</td></tr>
<tr><td style="padding:0 0 28px;font-size:16px;line-height:1.6;color:${BODY};">${escapeHtml(blurb)}</td></tr>
<tr><td style="padding:0 0 28px;">
  <a href="${safeUrl}" style="display:inline-block;padding:14px 26px;background:${SITE_ACCENT};color:#000000;text-decoration:none;font-size:15px;font-weight:700;border-radius:999px;">${escapeHtml(cta)}</a>
</td></tr>
<tr><td style="padding:0 0 8px;font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(linkNote)} If the button does not work, paste this into your browser:</td></tr>
<tr><td style="padding:0 0 8px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${safeUrl}" style="color:${MUTED};text-decoration:underline;">${safeUrl}</a></td></tr>
<tr><td style="padding:32px 0 8px;margin-top:24px;color:${MUTED};font-size:12px;line-height:1.7;border-top:1px solid ${RULE};">
${escapeHtml(footer)}<br>
Atmos Media, New Zealand
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
    "",
    `${cta}: ${url}`,
    "",
    linkNote,
    footer,
  ].join("\n");

  return { html, text };
}

export function renderMagicLinkEmail({
  name,
  url,
}: {
  name: string | null;
  url: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: "Your Atmos sign-in link",
    ...renderActionEmail({
      heading: "Sign in to Atmos",
      preview: "Tap to sign in. No password needed.",
      greeting: name ? `Hi ${name},` : "Hi,",
      blurb:
        "Tap the button to sign in. No password needed. If this is your first time, it sets up your Atmos account with this email.",
      cta: "Sign in to Atmos",
      url,
      expiry: `${MAGIC_LINK_EXPIRES_IN_MINUTES} minutes`,
      footer:
        "If you did not ask to sign in, ignore this. Nobody gets in without the link.",
    }),
  };
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
      preview: "One tap to confirm this address and link your tickets.",
      expiry: "an hour",
      greeting: name ? `Hi ${name},` : "Hi,",
      blurb:
        "Tap the button to confirm this address. It links any tickets you have already bought with this email to your account, so they show up in the Atmos app.",
      cta: "Confirm email",
      url,
      footer:
        "If you did not create an Atmos account, ignore this. Nothing happens until the link is used.",
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
      preview: "Choose a new password for your Atmos account.",
      expiry: "an hour",
      greeting: name ? `Hi ${name},` : "Hi,",
      blurb:
        "Tap the button to choose a new password. Your tickets and your account are untouched until you do.",
      cta: "Choose a new password",
      url,
      footer:
        "If you did not ask for this, ignore it. Your password stays as it is until the link is used.",
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
      preview: "Confirm you want this account deleted.",
      expiry: "24 hours",
      greeting: name ? `Hi ${name},` : "Hi,",
      blurb:
        "Somebody asked to delete this account from the Atmos app. Tap the button to go ahead. Your name, email and contact details are removed. Tickets you have already bought keep working at the door, and the orders behind them stay on our books because we are required to keep sales records.",
      cta: "Delete my account",
      url,
      footer:
        "If this was not you, ignore it. Nothing is deleted until the link is used, and it is worth changing your password.",
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
  const result = await sendEmail({ from: "account", to, subject, html, text });

  if (!result.ok) {
    // Signing up should not fail because the mail provider hiccupped — the
    // user can ask for another from the account screen.
    console.error("[auth] verification email failed:", result.error);
  }
}

/**
 * Fire the sign-in link.
 *
 * Thrown rather than logged: the link is the only way in, so a mail that never
 * left should show the person an error they can retry, not "check your inbox".
 */
export async function sendMagicLinkEmail({
  to,
  name,
  url,
}: {
  to: string;
  name: string | null;
  url: string;
}): Promise<void> {
  const { subject, html, text } = renderMagicLinkEmail({ name, url });
  const result = await sendEmail({ from: "account", to, subject, html, text });

  if (!result.ok) {
    throw new Error(`Could not send the sign-in link: ${result.error}`);
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
  const result = await sendEmail({ from: "account", to, subject, html, text });

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
  const result = await sendEmail({ from: "account", to, subject, html, text });

  if (!result.ok) {
    throw new Error(
      `Could not send the account deletion email: ${result.error}`,
    );
  }
}
