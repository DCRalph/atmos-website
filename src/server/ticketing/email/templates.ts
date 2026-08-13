import "server-only";

import { formatNZD } from "~/lib/ticketing/money";
import { formatEventDateLong, formatEventTime } from "~/lib/ticketing/dates";

/**
 * Ticket email HTML.
 *
 * Written as tables with inline styles because that is what still renders in
 * Outlook and Gmail's clipping. QR codes are inline `cid:` attachments, never
 * remote images — a client that blocks remote content would otherwise leave
 * somebody at the door with an empty box where their ticket should be.
 */

const BG = "#000000";
const CARD = "#000000";
const BORDER = "#1a1a1a";
const STRONG_BORDER = "#333333";
const TEXT = "#ffffff";
const MUTED = "#999999";
const ACCENT = "#ffffff";

export type EmailTicket = {
  ticketNumber: string;
  tierName: string;
  /** Blank for general admission — only worth printing when it isn't. */
  accessLabel: string | null;
  accessBadgeBg: string | null;
  accessBadgeFg: string | null;
  attendeeName: string | null;
  /** `cid:` value for this ticket's QR attachment. */
  qrCid: string;
};

export type TicketEmailInput = {
  eventName: string;
  eventTimezone: string;
  startsAt: Date;
  doorsAt: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  isR18: boolean;
  orderNumber: string;
  tickets: EmailTicket[];
  ticketsUrl: string;
  /** Where the "add names" prompt sends them. */
  detailsUrl: string;
  appleWalletUrlFor?: (ticketNumber: string) => string;
  appleWalletBadgeCid?: string;
  googleWalletUrlFor?: (ticketNumber: string) => string;
  totals: {
    subtotalCents: number;
    discountCents: number;
    bookingFeeCents: number;
    totalCents: number;
    gstCents: number;
  };
  gstNumber: string | null;
  legalName: string;
  supportEmail: string | null;
  needsAttendeeNames: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appleWalletBadge(url: string, cid: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;margin:0 8px 8px 0;text-decoration:none;">
    <img src="cid:${escapeHtml(cid)}" width="133" height="42" alt="Add to Apple Wallet" style="display:block;width:133px;height:42px;border:0;">
  </a>`;
}

function layout(title: string, body: string, footer: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};color:${TEXT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:8px 0 24px;">
  <span style="font-size:18px;font-weight:800;letter-spacing:0.22em;color:${ACCENT};">ATMOS</span>
</td></tr>
${body}
<tr><td style="padding:24px 0 8px;color:${MUTED};font-size:12px;line-height:1.6;">
${footer}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function ticketCard(
  ticket: EmailTicket,
  input: TicketEmailInput,
  index: number,
): string {
  const walletRow = [
    input.appleWalletUrlFor && input.appleWalletBadgeCid
      ? appleWalletBadge(
          input.appleWalletUrlFor(ticket.ticketNumber),
          input.appleWalletBadgeCid,
        )
      : "",
    input.googleWalletUrlFor
      ? `<a href="${escapeHtml(input.googleWalletUrlFor(ticket.ticketNumber))}" style="display:inline-block;padding:11px 16px;margin:0 8px 8px 0;border:1px solid ${STRONG_BORDER};border-radius:10px;color:${TEXT};text-decoration:none;font-size:13px;line-height:18px;">Add to Google Wallet</a>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const name = ticket.attendeeName
    ? `<div style="font-size:15px;font-weight:600;color:${TEXT};margin-bottom:2px;">${escapeHtml(ticket.attendeeName)}</div>`
    : "";

  const access = ticket.accessLabel
    ? `<div style="margin-top:10px;display:inline-block;padding:5px 12px;background:${ticket.accessBadgeBg ?? ACCENT};color:${ticket.accessBadgeFg ?? "#000000"};font-size:12px;font-weight:700;letter-spacing:0.08em;">${escapeHtml(ticket.accessLabel.toUpperCase())}</div>`
    : "";

  return `<tr><td style="padding:0 0 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:2px solid ${BORDER};">
<tr><td style="padding:20px;text-align:center;">
  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:${MUTED};margin-bottom:12px;">
    Ticket ${index + 1} of ${input.tickets.length} &middot; ${escapeHtml(ticket.tierName)}
  </div>
  <div style="background:#ffffff;padding:12px;display:inline-block;">
    <img src="cid:${ticket.qrCid}" width="220" height="220" alt="Entry QR code for ${escapeHtml(ticket.ticketNumber)}" style="display:block;width:220px;height:220px;">
  </div>
  ${access}
  <div style="margin-top:14px;">
    ${name}
    <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:${MUTED};">${escapeHtml(ticket.ticketNumber)}</div>
  </div>
  ${walletRow ? `<div style="margin-top:14px;">${walletRow}</div>` : ""}
</td></tr>
</table>
</td></tr>`;
}

export function renderTicketEmail(input: TicketEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const dateLine = `${formatEventDateLong(input.startsAt, input.eventTimezone)} · ${formatEventTime(input.startsAt, input.eventTimezone)}`;
  const doorsLine = input.doorsAt
    ? `Doors ${formatEventTime(input.doorsAt, input.eventTimezone)}`
    : null;

  const venueLine = [input.venueName, input.venueAddress]
    .filter(Boolean)
    .join(", ");

  const detailRows = [
    `<div style="font-size:15px;color:${TEXT};margin-bottom:4px;">${escapeHtml(dateLine)}</div>`,
    doorsLine
      ? `<div style="font-size:14px;color:${MUTED};margin-bottom:4px;">${escapeHtml(doorsLine)}</div>`
      : "",
    venueLine
      ? `<div style="font-size:14px;color:${MUTED};">${escapeHtml(venueLine)}</div>`
      : "",
    input.isR18
      ? `<div style="margin-top:12px;display:inline-block;padding:6px 10px;border:1px solid #7f1d1d;background:#190808;font-size:12px;color:#fecaca;">R18 — photo ID required at the door</div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const namesPrompt = input.needsAttendeeNames
    ? `<tr><td style="padding:0 0 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:2px solid ${BORDER};">
<tr><td style="padding:18px 20px;">
  <div style="font-size:14px;color:${TEXT};margin-bottom:8px;">One quick thing</div>
  <div style="font-size:14px;color:${MUTED};line-height:1.6;">Add the name of whoever is using each ticket so the door can find them fast. It only takes a second, and you can do it any time before the event.</div>
  <a href="${escapeHtml(input.detailsUrl)}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:${ACCENT};color:#000;text-decoration:none;font-size:14px;font-weight:700;">Add names</a>
</td></tr>
</table>
</td></tr>`
    : "";

  const summaryRow = (label: string, value: string, muted = true) =>
    `<tr>
      <td style="padding:3px 0;font-size:13px;color:${muted ? MUTED : TEXT};">${escapeHtml(label)}</td>
      <td align="right" style="padding:3px 0;font-size:13px;color:${muted ? MUTED : TEXT};">${escapeHtml(value)}</td>
    </tr>`;

  const summary = `<tr><td style="padding:0 0 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:2px solid ${BORDER};">
<tr><td style="padding:18px 20px;">
  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:${MUTED};margin-bottom:10px;">Order ${escapeHtml(input.orderNumber)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${summaryRow("Tickets", formatNZD(input.totals.subtotalCents))}
    ${input.totals.discountCents > 0 ? summaryRow("Discount", `−${formatNZD(input.totals.discountCents)}`) : ""}
    ${input.totals.bookingFeeCents > 0 ? summaryRow("Booking fee", formatNZD(input.totals.bookingFeeCents)) : ""}
    <tr><td colspan="2" style="border-top:1px solid ${BORDER};padding-top:8px;"></td></tr>
    ${summaryRow("Total paid", formatNZD(input.totals.totalCents), false)}
    ${input.totals.gstCents > 0 ? summaryRow(`Includes GST`, formatNZD(input.totals.gstCents)) : ""}
  </table>
  ${
    input.gstNumber
      ? `<div style="margin-top:10px;font-size:11px;color:${MUTED};">${escapeHtml(input.legalName)} · GST ${escapeHtml(input.gstNumber)}</div>`
      : ""
  }
</td></tr>
</table>
</td></tr>`;

  const body = `
<tr><td style="padding:0 0 18px;">
  <div style="font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};margin-bottom:14px;">You're going to ${escapeHtml(input.eventName)}</div>
  ${detailRows}
</td></tr>
${input.tickets.map((ticket, i) => ticketCard(ticket, input, i)).join("\n")}
${namesPrompt}
${summary}
<tr><td style="padding:4px 0 0;">
  <a href="${escapeHtml(input.ticketsUrl)}" style="display:inline-block;padding:12px 18px;border:2px solid ${BORDER};color:${TEXT};text-decoration:none;font-size:14px;font-weight:600;">View tickets online</a>
</td></tr>`;

  const support = input.supportEmail
    ? `Questions? <a href="mailto:${input.supportEmail}" style="color:${MUTED};">${escapeHtml(input.supportEmail)}</a><br>`
    : "";

  const footer = `${support}Keep this email — the link above always shows your latest tickets.<br>
Screenshots work, but the first scan wins: don't forward a ticket you're using yourself.`;

  const text = [
    `You're going to ${input.eventName}`,
    "",
    dateLine,
    doorsLine ?? "",
    venueLine,
    input.isR18 ? "R18 — photo ID required at the door" : "",
    "",
    `Order ${input.orderNumber}`,
    ...input.tickets.map(
      (t, i) =>
        `Ticket ${i + 1}: ${t.ticketNumber} (${t.tierName}${t.accessLabel ? `, ${t.accessLabel}` : ""})${t.attendeeName ? ` — ${t.attendeeName}` : ""}`,
    ),
    "",
    `Total paid: ${formatNZD(input.totals.totalCents)}`,
    input.totals.gstCents > 0
      ? `Includes GST: ${formatNZD(input.totals.gstCents)}`
      : "",
    "",
    `Your tickets: ${input.ticketsUrl}`,
    "",
    "The QR codes are in this email as images. If your mail app hides them, open the link above.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    subject: input.eventName,
    html: layout(input.eventName, body, footer),
    text,
  };
}

export type CompEmailInput = {
  eventName: string;
  eventTimezone: string;
  startsAt: Date;
  doorsAt: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  isR18: boolean;
  /** The one ticket this email is about. Never a list. */
  ticket: EmailTicket;
  ticketUrl: string;
  appleWalletUrl?: string;
  appleWalletBadgeCid?: string;
  googleWalletUrl?: string;
  /** Set when somebody passed this ticket on, rather than an admin issuing it. */
  invitedByName: string | null;
  /** How many tickets they have to hand out, if any. */
  handoutCount: number;
  supportEmail: string | null;
};

/**
 * One person, one ticket.
 *
 * Deliberately not `renderTicketEmail` with a single-item list: this email
 * carries somebody's name on the ticket and says so, has no receipt because
 * nothing was paid, and — the part that matters — never contains a second QR
 * code. A comp recipient's email holding their guests' tickets would undo the
 * whole point of issuing them separately.
 */
export function renderCompEmail(input: CompEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const dateLine = `${formatEventDateLong(input.startsAt, input.eventTimezone)} · ${formatEventTime(input.startsAt, input.eventTimezone)}`;
  const doorsLine = input.doorsAt
    ? `Doors ${formatEventTime(input.doorsAt, input.eventTimezone)}`
    : null;
  const venueLine = [input.venueName, input.venueAddress]
    .filter(Boolean)
    .join(", ");

  const heading = input.invitedByName
    ? `${escapeHtml(input.invitedByName)} has put you on the list`
    : `You're on the list for ${escapeHtml(input.eventName)}`;

  const walletRow = [
    input.appleWalletUrl && input.appleWalletBadgeCid
      ? appleWalletBadge(input.appleWalletUrl, input.appleWalletBadgeCid)
      : "",
    input.googleWalletUrl
      ? `<a href="${escapeHtml(input.googleWalletUrl)}" style="display:inline-block;padding:11px 16px;margin:0 8px 8px 0;border:1px solid ${STRONG_BORDER};border-radius:10px;color:${TEXT};text-decoration:none;font-size:13px;line-height:18px;">Add to Google Wallet</a>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const access = input.ticket.accessLabel
    ? `<div style="margin-top:10px;display:inline-block;padding:5px 12px;background:${input.ticket.accessBadgeBg ?? ACCENT};color:${input.ticket.accessBadgeFg ?? "#000000"};font-size:12px;font-weight:700;letter-spacing:0.08em;">${escapeHtml(input.ticket.accessLabel.toUpperCase())}</div>`
    : "";

  // The name is the whole mechanism, so it is the largest thing on the card.
  const nameBlock = input.ticket.attendeeName
    ? `<div style="margin-top:14px;font-size:18px;font-weight:700;color:${TEXT};">${escapeHtml(input.ticket.attendeeName)}</div>
       <div style="margin-top:4px;font-size:13px;color:${MUTED};">This ticket is in your name — bring photo ID.</div>`
    : "";

  const handouts =
    input.handoutCount > 0
      ? `<tr><td style="padding:0 0 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:2px solid ${BORDER};">
<tr><td style="padding:18px 20px;">
  <div style="font-size:14px;color:${TEXT};margin-bottom:8px;">${input.handoutCount} ${input.handoutCount === 1 ? "ticket" : "tickets"} to hand out</div>
  <div style="font-size:14px;color:${MUTED};line-height:1.6;">Open your ticket page to send ${input.handoutCount === 1 ? "it" : "them"} on. Whoever you send to gets their own ticket by email, in their name.</div>
  <a href="${escapeHtml(input.ticketUrl)}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:${ACCENT};color:#000;text-decoration:none;font-size:14px;font-weight:700;">Hand out tickets</a>
</td></tr>
</table>
</td></tr>`
      : "";

  const detailRows = [
    `<div style="font-size:15px;color:${TEXT};margin-bottom:4px;">${escapeHtml(dateLine)}</div>`,
    doorsLine
      ? `<div style="font-size:14px;color:${MUTED};margin-bottom:4px;">${escapeHtml(doorsLine)}</div>`
      : "",
    venueLine
      ? `<div style="font-size:14px;color:${MUTED};">${escapeHtml(venueLine)}</div>`
      : "",
    input.isR18
      ? `<div style="margin-top:12px;display:inline-block;padding:6px 10px;border:1px solid #7f1d1d;background:#190808;font-size:12px;color:#fecaca;">R18 — photo ID required at the door</div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const body = `
<tr><td style="padding:0 0 18px;">
  <div style="font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};margin-bottom:14px;">${heading}</div>
  ${detailRows}
</td></tr>
<tr><td style="padding:0 0 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:2px solid ${BORDER};">
<tr><td style="padding:20px;text-align:center;">
  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:${MUTED};margin-bottom:12px;">${escapeHtml(input.ticket.tierName)}</div>
  <div style="background:#ffffff;padding:12px;display:inline-block;">
    <img src="cid:${input.ticket.qrCid}" width="220" height="220" alt="Entry QR code for ${escapeHtml(input.ticket.ticketNumber)}" style="display:block;width:220px;height:220px;">
  </div>
  ${access}
  ${nameBlock}
  <div style="margin-top:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:${MUTED};">${escapeHtml(input.ticket.ticketNumber)}</div>
  ${walletRow ? `<div style="margin-top:14px;">${walletRow}</div>` : ""}
</td></tr>
</table>
</td></tr>
${handouts}
<tr><td style="padding:4px 0 0;">
  <a href="${escapeHtml(input.ticketUrl)}" style="display:inline-block;padding:12px 18px;border:2px solid ${BORDER};color:${TEXT};text-decoration:none;font-size:14px;font-weight:600;">View your ticket</a>
</td></tr>`;

  const support = input.supportEmail
    ? `Questions? <a href="mailto:${input.supportEmail}" style="color:${MUTED};">${escapeHtml(input.supportEmail)}</a><br>`
    : "";

  const footer = `${support}This ticket is in your name and can't be transferred — the door checks it against your ID.`;

  const text = [
    input.invitedByName
      ? `${input.invitedByName} has put you on the list for ${input.eventName}`
      : `You're on the list for ${input.eventName}`,
    "",
    dateLine,
    doorsLine ?? "",
    venueLine,
    input.isR18 ? "R18 — photo ID required at the door" : "",
    "",
    `${input.ticket.ticketNumber} (${input.ticket.tierName}${input.ticket.accessLabel ? `, ${input.ticket.accessLabel}` : ""})`,
    input.ticket.attendeeName
      ? `In the name of ${input.ticket.attendeeName} — bring photo ID.`
      : "",
    "",
    input.handoutCount > 0
      ? `You have ${input.handoutCount} ticket(s) to hand out. Open your ticket page to send them on.`
      : "",
    `Your ticket: ${input.ticketUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    subject: input.invitedByName
      ? `${input.invitedByName} put you on the list — ${input.eventName}`
      : `You're on the list — ${input.eventName}`,
    html: layout(input.eventName, body, footer),
    text,
  };
}

export function renderRefundEmail({
  eventName,
  orderNumber,
  amountCents,
  ticketNumbers,
  supportEmail,
}: {
  eventName: string;
  orderNumber: string;
  amountCents: number;
  ticketNumbers: string[];
  supportEmail: string | null;
}): { subject: string; html: string; text: string } {
  const list = ticketNumbers.map((n) => escapeHtml(n)).join(", ");

  const body = `
<tr><td style="padding:0 0 18px;">
  <div style="font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};margin-bottom:14px;">Refund processed</div>
  <div style="font-size:15px;color:${MUTED};line-height:1.7;">
    We've refunded ${formatNZD(amountCents)} for order ${escapeHtml(orderNumber)} — ${escapeHtml(eventName)}.<br>
    ${ticketNumbers.length > 0 ? `Cancelled: ${list}.<br>` : ""}
    The refund lands back on the card you paid with, usually within 5–10 business days.
  </div>
</td></tr>
<tr><td style="padding:0 0 14px;">
  <div style="background:${CARD};border:2px solid ${BORDER};padding:18px 20px;font-size:14px;color:${MUTED};">
    Those tickets no longer work at the door. Any wallet passes will stop scanning too.
  </div>
</td></tr>`;

  const footer = supportEmail
    ? `Questions? <a href="mailto:${supportEmail}" style="color:${MUTED};">${escapeHtml(supportEmail)}</a>`
    : "";

  const text = [
    "Refund processed",
    "",
    `We've refunded ${formatNZD(amountCents)} for order ${orderNumber} — ${eventName}.`,
    ticketNumbers.length > 0 ? `Cancelled: ${ticketNumbers.join(", ")}.` : "",
    "The refund lands back on the card you paid with, usually within 5-10 business days.",
    "Those tickets no longer work at the door.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Refund processed — ${eventName}`,
    html: layout(`Refund processed — ${eventName}`, body, footer),
    text,
  };
}

/**
 * Receipt for a card payment taken at a door.
 *
 * Apple's App Review checklist 5.10 requires a confidential digital receipt to
 * be available whether the transaction was approved *or* declined, which is why
 * this renders a decline as a first-class thing rather than an error. A
 * customer whose card was refused in front of a queue is precisely the person
 * who wants something in writing about it.
 *
 * Deliberately thin on detail: brand, last four, amount, outcome, time. A
 * receipt handed to whoever happened to be at the counter should not carry
 * anything the cardholder would mind a stranger reading.
 */
export function renderDoorReceiptEmail({
  eventName,
  outcome,
  amountCents,
  cardBrand,
  last4,
  declineReason,
  orderNumber,
  takenAt,
  receiptUrl,
  legalName,
  gstNumber,
  supportEmail,
}: {
  eventName: string;
  outcome: "APPROVED" | "DECLINED" | "TIMED_OUT";
  amountCents: number;
  cardBrand: string | null;
  last4: string | null;
  declineReason: string | null;
  orderNumber: string | null;
  takenAt: Date;
  receiptUrl: string;
  legalName: string;
  gstNumber: string | null;
  supportEmail: string | null;
}): { subject: string; html: string; text: string } {
  const approved = outcome === "APPROVED";
  const heading = approved
    ? "Payment received"
    : outcome === "DECLINED"
      ? "Payment declined"
      : "Payment not completed";

  const card = [cardBrand, last4 ? `•••• ${last4}` : null]
    .filter(Boolean)
    .join(" ");

  const rows: [string, string][] = [
    ["Amount", formatNZD(amountCents)],
    ["Status", approved ? "Approved" : outcome === "DECLINED" ? "Declined" : "Not completed"],
    ...(card ? ([["Card", card]] as [string, string][]) : []),
    ...(orderNumber ? ([["Order", orderNumber]] as [string, string][]) : []),
    ["When", takenAt.toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })],
    ["Paid to", legalName],
    ...(gstNumber ? ([["GST number", gstNumber]] as [string, string][]) : []),
  ];

  const rowHtml = rows
    .map(
      ([label, value]) => `
  <tr>
    <td style="padding:8px 0;font-size:14px;color:${MUTED};">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:14px;color:${TEXT};text-align:right;">${escapeHtml(value)}</td>
  </tr>`,
    )
    .join("");

  const explain = approved
    ? "Paid in person with Tap to Pay on iPhone. Your tickets were issued at the door."
    : outcome === "DECLINED"
      ? `The card was refused by the bank, so nothing has been charged.${
          declineReason ? ` Reason given: ${declineReason}.` : ""
        } If you were let in, you paid another way.`
      : "The card was never read, so nothing has been charged.";

  const body = `
<tr><td style="padding:0 0 18px;">
  <div style="font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};margin-bottom:14px;">${escapeHtml(heading)}</div>
  <div style="font-size:15px;color:${MUTED};line-height:1.7;">
    ${escapeHtml(eventName)}<br>
    ${escapeHtml(explain)}
  </div>
</td></tr>
<tr><td style="padding:0 0 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:2px solid ${BORDER};padding:6px 20px;">
    ${rowHtml}
  </table>
</td></tr>
<tr><td style="padding:0 0 14px;">
  <a href="${escapeHtml(receiptUrl)}" style="display:inline-block;padding:12px 18px;border:2px solid ${STRONG_BORDER};color:${TEXT};text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">View receipt</a>
</td></tr>`;

  const footer = supportEmail
    ? `Questions? <a href="mailto:${supportEmail}" style="color:${MUTED};">${escapeHtml(supportEmail)}</a>`
    : "";

  const text = [
    heading,
    "",
    eventName,
    explain,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    receiptUrl,
  ].join("\n");

  return {
    subject: `${heading} — ${eventName}`,
    html: layout(`${heading} — ${eventName}`, body, footer),
    text,
  };
}

/**
 * The Tap to Pay on iPhone launch email.
 *
 * Apple's App Review checklist 6.1: "At launch, a dedicated launch email must
 * be sent to all eligible users. This must leverage the 'Launch' email referred
 * to in the Tap to Pay on iPhone Marketing Guide."
 *
 * ⚠️ **PLACEHOLDER copy.** The structure, audience and delivery are finished;
 * the words are not Apple's. Replace the headline and body below with the
 * approved 'Launch' email copy from the Marketing Guide and Toolkit before
 * submitting for review — row 1.9 is checked against exactly this.
 */
export function renderTapToPayLaunchEmail({
  recipientName,
  appUrl,
  supportEmail,
}: {
  recipientName: string | null;
  appUrl: string;
  supportEmail: string | null;
}): { subject: string; html: string; text: string } {
  const greeting = recipientName ? `${recipientName}, ` : "";

  const body = `
<tr><td style="padding:0 0 18px;">
  <div style="font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};margin-bottom:14px;">Take card payments on your iPhone</div>
  <div style="font-size:15px;color:${MUTED};line-height:1.7;">
    ${escapeHtml(greeting)}Tap to Pay on iPhone is now switched on in the Atmos app.
    You can accept contactless cards, Apple Pay and other digital wallets at the
    door using the iPhone already in your pocket — no extra reader to carry,
    charge or lose.
  </div>
</td></tr>
<tr><td style="padding:0 0 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:2px solid ${BORDER};">
  <tr><td style="padding:20px;font-size:14px;color:${MUTED};line-height:1.7;">
    <strong style="color:${TEXT};">Getting started</strong><br>
    1. Open the Atmos app and go to More &rsaquo; Tap to Pay on iPhone.<br>
    2. An Atmos admin accepts Apple's Terms and Conditions on the handset.<br>
    3. Read the short guide, then take a test payment.<br><br>
    Needs an iPhone XS or later on a current version of iOS. Cash and eftpos
    stay available at every door.
  </td></tr>
  </table>
</td></tr>
<tr><td style="padding:0 0 14px;">
  <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:12px 18px;border:2px solid ${STRONG_BORDER};color:${TEXT};text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Open Atmos</a>
</td></tr>`;

  const footer = supportEmail
    ? `Questions? <a href="mailto:${supportEmail}" style="color:${MUTED};">${escapeHtml(supportEmail)}</a>`
    : "";

  const text = [
    "Take card payments on your iPhone",
    "",
    `${greeting}Tap to Pay on iPhone is now switched on in the Atmos app. You can accept contactless cards, Apple Pay and other digital wallets at the door using the iPhone already in your pocket.`,
    "",
    "Getting started",
    "1. Open the Atmos app and go to More > Tap to Pay on iPhone.",
    "2. An Atmos admin accepts Apple's Terms and Conditions on the handset.",
    "3. Read the short guide, then take a test payment.",
    "",
    "Needs an iPhone XS or later on a current version of iOS.",
    "",
    appUrl,
  ].join("\n");

  return {
    subject: "Tap to Pay on iPhone is now available in Atmos",
    html: layout("Tap to Pay on iPhone is now available in Atmos", body, footer),
    text,
  };
}
