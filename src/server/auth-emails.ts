import "server-only";

import {
  renderAccountDeletionEmail,
  renderMagicLinkEmail,
  renderPasswordResetEmail,
  renderVerificationEmail,
} from "~/emails/account";
import { sendEmail } from "~/server/email/send";

/**
 * Sending the account mails. The templates live in `src/emails/account.ts`.
 */

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
