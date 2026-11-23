import { formatNZD } from "~/lib/ticketing/money";
import {
  detailTable,
  emailShell,
  escapeHtml,
  intro,
  panel,
  pillButton,
  row,
  type RenderedEmail,
} from "./layout";

/** Gear rentals and equipment hire: decisions, invoices and receipts. */

/**
 * The answer to somebody's gear rental request. Replies go to staff, so the
 * footer says to reply.
 */
export function renderRentalDecisionEmail({
  name,
  approved,
  gear,
  dates,
  estimatedTotal,
}: {
  name: string;
  approved: boolean;
  gear: string;
  /** "December 1st, 2026 to December 3rd, 2026". */
  dates: string;
  /** Dollars, as stored on the request. */
  estimatedTotal: number | string;
}): RenderedEmail {
  const message = approved
    ? "Your gear rental request has been approved. We'll be in touch to sort out pickup and payment."
    : "Unfortunately we can't fulfil your gear rental request for these dates.";

  const body = [
    intro(
      `Rental request ${approved ? "approved" : "declined"}`,
      `Hi ${escapeHtml(name)}. ${escapeHtml(message)}`,
    ),
    row(
      panel(
        detailTable([
          ["Gear", gear],
          ["Dates", dates],
          ["Estimated total", `$${estimatedTotal}`],
        ]),
      ),
      8,
    ),
  ].join("\n");

  const subject = `Your Atmos gear rental request was ${approved ? "approved" : "declined"}`;
  const text =
    `Hi ${name},\n\n${message}\n\n` +
    `Gear: ${gear}\nDates: ${dates}\n` +
    `Estimated total: $${estimatedTotal}\n\n` +
    `Reply to this email with any questions.`;

  return {
    subject,
    html: emailShell({
      title: subject,
      body,
      footer: "Questions? Reply to this email.",
    }),
    text,
  };
}

type HireInvoiceEmailInput = {
  name: string;
  number: string;
  /** "Equipment hire, Sat 5 Dec 2026 to Mon 8 Dec 2026". */
  description: string;
  totalCents: number;
  gstCents: number;
  /** "Sat 12 Dec 2026". */
  dueOn: string;
  url: string;
  legalName: string;
  gstNumber: string | null;
};

/**
 * The tax invoice for a signed hire agreement: the amount, when it is due,
 * and the button that opens the page to pay it. Sent when the agreement is
 * signed, and again from admin.
 */
export function renderHireInvoiceEmail(
  input: HireInvoiceEmailInput,
): RenderedEmail {
  const total = formatNZD(input.totalCents);
  const subject = `Invoice ${input.number} from Atmos: ${total} due ${input.dueOn}`;
  const from = input.gstNumber
    ? [input.legalName, `GST ${input.gstNumber}`]
    : [input.legalName];

  const body = [
    intro(
      `${total} due ${input.dueOn}`,
      `Hi ${escapeHtml(input.name)}, thanks for signing. Here is your tax invoice for ${escapeHtml(input.description.charAt(0).toLowerCase() + input.description.slice(1))}.`,
    ),
    row(
      panel(
        detailTable([
          ["Invoice", input.number],
          ["Total incl. GST", total],
          ["Includes GST", formatNZD(input.gstCents)],
          ["Due", input.dueOn],
        ]),
      ),
      20,
    ),
    row(pillButton(input.url, `Pay ${total}`), 8),
  ].join("\n");

  const footer = `${from.map(escapeHtml).join(" &middot; ")}. Pay by card, Apple Pay, Google Pay and more. Questions? Reply to this email.`;

  const text = [
    `${total} due ${input.dueOn}`,
    "",
    `Hi ${input.name}, thanks for signing. Here is your tax invoice for ${input.description}.`,
    "",
    `Invoice: ${input.number}`,
    `Total incl. GST: ${total}`,
    `Includes GST: ${formatNZD(input.gstCents)}`,
    `Due: ${input.dueOn}`,
    "",
    `Pay online: ${input.url}`,
    "",
    `${from.join(" · ")}. Questions? Reply to this email.`,
  ].join("\n");

  return { subject, html: emailShell({ title: subject, body, footer }), text };
}

/** The hirer's receipt once their invoice is paid: a link back to the paid page. */
export function renderHireInvoicePaidEmail(input: {
  name: string;
  number: string;
  totalCents: number;
  paidWith: string | null;
  url: string;
}): RenderedEmail {
  const total = formatNZD(input.totalCents);
  const subject = `Paid: invoice ${input.number} from Atmos`;
  const how = input.paidWith ? ` with ${input.paidWith}` : "";

  const body = [
    intro(
      "Paid",
      `Thanks ${escapeHtml(input.name)}. We received ${escapeHtml(total)}${escapeHtml(how)} for invoice ${escapeHtml(input.number)}.`,
    ),
    row(pillButton(input.url, "View receipt"), 8),
  ].join("\n");

  const text = [
    "Paid",
    "",
    `Thanks ${input.name}. We received ${total}${how} for invoice ${input.number}.`,
    "",
    `View receipt: ${input.url}`,
  ].join("\n");

  return {
    subject,
    html: emailShell({
      title: subject,
      body,
      footer: "Questions? Reply to this email.",
    }),
    text,
  };
}
