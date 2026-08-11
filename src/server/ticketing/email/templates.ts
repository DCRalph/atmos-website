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

const BG = "#0b0b0c";
const CARD = "#141416";
const BORDER = "#2a2a2e";
const TEXT = "#f4f4f5";
const MUTED = "#a1a1aa";
const ACCENT = "#ffffff";

export type EmailTicket = {
  ticketNumber: string;
  tierName: string;
  /** Blank for general admission — only worth printing when it isn't. */
  accessLabel: string | null;
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
<tr><td style="padding:8px 4px 20px;">
  <span style="font-size:18px;font-weight:700;letter-spacing:0.18em;color:${ACCENT};">ATMOS</span>
</td></tr>
${body}
<tr><td style="padding:24px 4px 8px;color:${MUTED};font-size:12px;line-height:1.6;">
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
    input.appleWalletUrlFor
      ? `<a href="${input.appleWalletUrlFor(ticket.ticketNumber)}" style="display:inline-block;padding:9px 14px;margin:0 6px 6px 0;border:1px solid ${BORDER};border-radius:8px;color:${TEXT};text-decoration:none;font-size:13px;">Add to Apple Wallet</a>`
      : "",
    input.googleWalletUrlFor
      ? `<a href="${input.googleWalletUrlFor(ticket.ticketNumber)}" style="display:inline-block;padding:9px 14px;margin:0 6px 6px 0;border:1px solid ${BORDER};border-radius:8px;color:${TEXT};text-decoration:none;font-size:13px;">Add to Google Wallet</a>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const name = ticket.attendeeName
    ? `<div style="font-size:15px;font-weight:600;color:${TEXT};margin-bottom:2px;">${escapeHtml(ticket.attendeeName)}</div>`
    : "";

  const access = ticket.accessLabel
    ? `<div style="margin-top:10px;display:inline-block;padding:5px 12px;background:${ACCENT};color:#000;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.08em;">${escapeHtml(ticket.accessLabel.toUpperCase())}</div>`
    : "";

  return `<tr><td style="padding:0 0 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${BORDER};border-radius:14px;">
<tr><td style="padding:20px;text-align:center;">
  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:${MUTED};margin-bottom:12px;">
    Ticket ${index + 1} of ${input.tickets.length} &middot; ${escapeHtml(ticket.tierName)}
  </div>
  <div style="background:#ffffff;border-radius:12px;padding:12px;display:inline-block;">
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
      ? `<div style="margin-top:12px;display:inline-block;padding:6px 10px;border:1px solid #7f1d1d;background:#2a0d0d;border-radius:8px;font-size:12px;color:#fca5a5;">R18 — photo ID required at the door</div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const namesPrompt = input.needsAttendeeNames
    ? `<tr><td style="padding:0 0 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${BORDER};border-radius:14px;">
<tr><td style="padding:18px 20px;">
  <div style="font-size:14px;color:${TEXT};margin-bottom:8px;">One quick thing</div>
  <div style="font-size:14px;color:${MUTED};line-height:1.6;">Add the name of whoever is using each ticket so the door can find them fast. It only takes a second, and you can do it any time before the event.</div>
  <a href="${input.detailsUrl}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:${ACCENT};color:#000;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Add names</a>
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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${BORDER};border-radius:14px;">
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
  <div style="font-size:26px;line-height:1.25;font-weight:700;color:${TEXT};margin-bottom:12px;">You're going to ${escapeHtml(input.eventName)}</div>
  ${detailRows}
</td></tr>
${input.tickets.map((ticket, i) => ticketCard(ticket, input, i)).join("\n")}
${namesPrompt}
${summary}
<tr><td style="padding:4px 0 0;">
  <a href="${input.ticketsUrl}" style="display:inline-block;padding:12px 18px;border:1px solid ${BORDER};border-radius:10px;color:${TEXT};text-decoration:none;font-size:14px;">View tickets online</a>
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
    input.appleWalletUrl
      ? `<a href="${input.appleWalletUrl}" style="display:inline-block;padding:9px 14px;margin:0 6px 6px 0;border:1px solid ${BORDER};border-radius:8px;color:${TEXT};text-decoration:none;font-size:13px;">Add to Apple Wallet</a>`
      : "",
    input.googleWalletUrl
      ? `<a href="${input.googleWalletUrl}" style="display:inline-block;padding:9px 14px;margin:0 6px 6px 0;border:1px solid ${BORDER};border-radius:8px;color:${TEXT};text-decoration:none;font-size:13px;">Add to Google Wallet</a>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const access = input.ticket.accessLabel
    ? `<div style="margin-top:10px;display:inline-block;padding:5px 12px;background:${ACCENT};color:#000;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.08em;">${escapeHtml(input.ticket.accessLabel.toUpperCase())}</div>`
    : "";

  // The name is the whole mechanism, so it is the largest thing on the card.
  const nameBlock = input.ticket.attendeeName
    ? `<div style="margin-top:14px;font-size:18px;font-weight:700;color:${TEXT};">${escapeHtml(input.ticket.attendeeName)}</div>
       <div style="margin-top:4px;font-size:13px;color:${MUTED};">This ticket is in your name — bring photo ID.</div>`
    : "";

  const handouts =
    input.handoutCount > 0
      ? `<tr><td style="padding:0 0 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${BORDER};border-radius:14px;">
<tr><td style="padding:18px 20px;">
  <div style="font-size:14px;color:${TEXT};margin-bottom:8px;">${input.handoutCount} ${input.handoutCount === 1 ? "ticket" : "tickets"} to hand out</div>
  <div style="font-size:14px;color:${MUTED};line-height:1.6;">Open your ticket page to send ${input.handoutCount === 1 ? "it" : "them"} on. Whoever you send to gets their own ticket by email, in their name.</div>
  <a href="${input.ticketUrl}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:${ACCENT};color:#000;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Hand out tickets</a>
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
      ? `<div style="margin-top:12px;display:inline-block;padding:6px 10px;border:1px solid #7f1d1d;background:#2a0d0d;border-radius:8px;font-size:12px;color:#fca5a5;">R18 — photo ID required at the door</div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const body = `
<tr><td style="padding:0 0 18px;">
  <div style="font-size:26px;line-height:1.25;font-weight:700;color:${TEXT};margin-bottom:12px;">${heading}</div>
  ${detailRows}
</td></tr>
<tr><td style="padding:0 0 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${BORDER};border-radius:14px;">
<tr><td style="padding:20px;text-align:center;">
  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:${MUTED};margin-bottom:12px;">${escapeHtml(input.ticket.tierName)}</div>
  <div style="background:#ffffff;border-radius:12px;padding:12px;display:inline-block;">
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
  <a href="${input.ticketUrl}" style="display:inline-block;padding:12px 18px;border:1px solid ${BORDER};border-radius:10px;color:${TEXT};text-decoration:none;font-size:14px;">View your ticket</a>
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
  <div style="font-size:24px;font-weight:700;color:${TEXT};margin-bottom:12px;">Refund processed</div>
  <div style="font-size:15px;color:${MUTED};line-height:1.7;">
    We've refunded ${formatNZD(amountCents)} for order ${escapeHtml(orderNumber)} — ${escapeHtml(eventName)}.<br>
    ${ticketNumbers.length > 0 ? `Cancelled: ${list}.<br>` : ""}
    The refund lands back on the card you paid with, usually within 5–10 business days.
  </div>
</td></tr>
<tr><td style="padding:0 0 14px;">
  <div style="background:${CARD};border:1px solid ${BORDER};border-radius:14px;padding:18px 20px;font-size:14px;color:${MUTED};">
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
