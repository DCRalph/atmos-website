import {
  COLORS,
  detailTable,
  emailShell,
  escapeHtml,
  ghostButton,
  intro,
  panel,
  pillButton,
  row,
  type RenderedEmail,
} from "./layout";

/**
 * Alerts to staff: a contact form message, a new rental request, a rental
 * paid. Same look as customer mail, with the details in a panel and a link
 * back into admin.
 */

const STAFF_FOOTER = "Sent to staff by the Atmos website.";

export function renderContactSubmissionEmail({
  name,
  email,
  reason,
  message,
  adminUrl,
}: {
  name: string;
  email: string;
  reason: string;
  message: string;
  adminUrl: string;
}): RenderedEmail {
  const body = [
    intro("New contact submission"),
    row(
      panel(
        detailTable([
          ["From", `${name} <${email}>`],
          ["Reason", reason],
        ]),
      ),
      12,
    ),
    row(
      panel(
        `<div style="font-size:15px;line-height:1.65;color:${COLORS.text};white-space:pre-wrap;">${escapeHtml(message)}</div>`,
      ),
      20,
    ),
    row(ghostButton(adminUrl, "All submissions in admin"), 8),
  ].join("\n");

  const subject = `New Contact Submission: ${reason}`;
  return {
    subject,
    html: emailShell({ title: subject, body, footer: STAFF_FOOTER }),
    text:
      `A new contact form submission has been received.\n\n` +
      `From: ${name} <${email}>\n` +
      `Reason: ${reason}\n\n` +
      `Message:\n${message}`,
  };
}

export function renderRentalRequestEmail({
  name,
  contact,
  selectionTitle,
  items,
  estimatedTotal,
  discount,
  startDate,
  endDate,
  decisionUrl,
  adminUrl,
}: {
  name: string;
  contact: string;
  /** "Package: Club kit" or "Selection: Individual items". */
  selectionTitle: string;
  /** "2x CDJ-3000, 1x DJM-900". */
  items: string;
  estimatedTotal: number | string;
  discount: string;
  startDate: string;
  endDate: string;
  /** Approve and deny append `?action=`. */
  decisionUrl: string;
  adminUrl: string;
}): RenderedEmail {
  const body = [
    intro("New gear rental request", escapeHtml(selectionTitle)),
    row(
      panel(
        detailTable([
          ["Name", name],
          ["Contact", contact],
          ["Items", items],
          ["Start", startDate],
          ["End", endDate],
          ["Estimated total", `$${estimatedTotal}`],
          ["Discount", discount],
        ]),
      ),
      20,
    ),
    row(
      `${pillButton(`${decisionUrl}?action=approve`, "Approve")}&nbsp;&nbsp;${ghostButton(`${decisionUrl}?action=deny`, "Deny")}`,
      12,
    ),
    row(
      `<div style="font-size:13px;line-height:1.6;color:${COLORS.muted};">Each link asks you to confirm, and works once.</div>`,
      20,
    ),
    row(ghostButton(adminUrl, "Review in admin"), 8),
  ].join("\n");

  const subject = `New Gear Rental Request: ${name}`;
  return {
    subject,
    html: emailShell({ title: subject, body, footer: STAFF_FOOTER }),
    text:
      `A new gear rental request has been submitted.\n\n` +
      `User: ${name}\n` +
      `Contact: ${contact}\n` +
      `${selectionTitle}\n` +
      `Items: ${items}\n` +
      `Estimated Total: $${estimatedTotal}\n` +
      `Discount: ${discount}\n` +
      `Start Date: ${startDate}\n` +
      `End Date: ${endDate}\n\n` +
      `Approve: ${decisionUrl}?action=approve\n` +
      `Deny: ${decisionUrl}?action=deny\n\n` +
      `Or review this request in the admin dashboard.`,
  };
}

export function renderRentalPaidStaffEmail({
  name,
  totalCents,
  number,
  description,
  adminUrl,
}: {
  name: string;
  totalCents: number;
  number: string;
  description: string;
  adminUrl: string;
}): RenderedEmail {
  const total = `$${(totalCents / 100).toFixed(2)}`;
  const line = `${name} paid ${total} for invoice ${number} (${description}).`;
  const body = [
    intro("Rental paid", escapeHtml(line)),
    row(ghostButton(adminUrl, "Rentals in admin"), 8),
  ].join("\n");

  const subject = `Rental paid: ${name}, ${total}`;
  return {
    subject,
    html: emailShell({ title: subject, body, footer: STAFF_FOOTER }),
    text: `${line}\n\n${adminUrl}`,
  };
}
