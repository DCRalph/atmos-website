/**
 * Every "from" address the site sends mail as, in one place.
 *
 * Callers pick a sender by key (`sendEmail({ from: "account", ... })`) rather
 * than passing an address, so changing who a kind of mail comes from is a
 * one-line edit here. Every domain used must be verified in Resend.
 */
export const EMAIL_SENDERS = {
  /** Confirm email, reset password, delete account. */
  account: "Atmos <noreply@atmosmedia.co.nz>",
  /** Orders, tickets, hand-outs, refunds, wallet passes, ticketing announcements. */
  tickets: "Atmos Tickets <tickets@atmosmedia.co.nz>",
  /** Gear rental decisions sent to the person who asked. */
  rentals: "Atmos Rentals <noreply@atmosmedia.co.nz>",
  /** Internal alerts to staff: contact form and rental requests. */
  notifications: "Atmos <noreply@atmosmedia.co.nz>",
} as const;

export type EmailSender = keyof typeof EMAIL_SENDERS;
