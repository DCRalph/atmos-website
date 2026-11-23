import { MAGIC_LINK_EXPIRES_IN_MINUTES } from "~/lib/magic-link";
import {
  COLORS,
  emailShell,
  escapeHtml,
  paragraph,
  pillButton,
  row,
  heading as headingHtml,
  type RenderedEmail,
} from "./layout";

/**
 * The account mails: sign-in link, confirm your email, reset your password,
 * delete your account. All the same shape, so they are one template with the
 * words passed in.
 */

/** Logo, heading, a sentence of context, one pill, the paste-this fallback. */
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

  const html = emailShell({
    title: heading,
    preview,
    body: [
      row(headingHtml(heading), 16),
      row(paragraph(escapeHtml(greeting)), 12),
      row(paragraph(escapeHtml(blurb)), 28),
      row(pillButton(url, cta), 28),
      row(
        `<div style="font-size:13px;line-height:1.6;color:${COLORS.muted};">${escapeHtml(linkNote)} If the button does not work, paste this into your browser:</div>
<div style="padding-top:8px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${safeUrl}" style="color:${COLORS.muted};text-decoration:underline;">${safeUrl}</a></div>`,
        24,
      ),
    ].join("\n"),
    footer: escapeHtml(footer),
  });

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
}): RenderedEmail {
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
}): RenderedEmail {
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
}): RenderedEmail {
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
}): RenderedEmail {
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
