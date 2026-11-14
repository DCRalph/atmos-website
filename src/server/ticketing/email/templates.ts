import "server-only";

import { formatNZD } from "~/lib/ticketing/money";
import { formatEventDateLong, formatEventTime } from "~/lib/ticketing/dates";
import { SITE_URL } from "~/lib/seo-constants";
import { SITE_ACCENT } from "~/lib/site-constants";

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
    venueFeeCents: number;
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
  <img src="${SITE_URL}/email/atmos-logo.png" width="120" height="27" alt="ATMOS" style="display:block;width:120px;height:auto;border:0;">
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
    ${input.totals.venueFeeCents > 0 ? summaryRow("Venue booking fee", formatNZD(input.totals.venueFeeCents)) : ""}
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

export type LifetimeEmailInput = {
  holderName: string;
  number: string;
  accessLabel: string;
  accessBadgeBg: string;
  accessBadgeFg: string;
  qrCid: string;
  lifetimeUrl: string;
  appleWalletUrl?: string;
  appleWalletBadgeCid?: string;
  supportEmail: string | null;
};

/**
 * A lifetime pass, delivered.
 *
 * No date, no venue, no receipt: there is no event and nothing was paid. What
 * it does carry is the same QR card the ticket emails use, so the door scans
 * it the same way, and the line that matters — this is in your name, for
 * every Atmos event, and it is not for passing on.
 */
export function renderLifetimeEmail(input: LifetimeEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const walletRow =
    input.appleWalletUrl && input.appleWalletBadgeCid
      ? appleWalletBadge(input.appleWalletUrl, input.appleWalletBadgeCid)
      : "";

  const body = `
<tr><td style="padding:0 0 18px;">
  <div style="font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};margin-bottom:14px;">Your Atmos lifetime pass</div>
  <div style="font-size:15px;color:${MUTED};line-height:1.6;">This gets you into every Atmos event. Show the code at the door, or add it to your wallet so it's always there.</div>
</td></tr>
<tr><td style="padding:0 0 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:2px solid #4a3b12;">
<tr><td style="padding:20px;text-align:center;">
  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.14em;color:#C9A227;margin-bottom:12px;">Lifetime pass</div>
  <div style="background:#ffffff;padding:12px;display:inline-block;">
    <img src="cid:${input.qrCid}" width="220" height="220" alt="Entry QR code for lifetime pass ${escapeHtml(input.number)}" style="display:block;width:220px;height:220px;">
  </div>
  <div style="margin-top:10px;display:inline-block;padding:5px 12px;background:${input.accessBadgeBg};color:${input.accessBadgeFg};font-size:12px;font-weight:700;letter-spacing:0.08em;">${escapeHtml(input.accessLabel.toUpperCase())}</div>
  <div style="margin-top:14px;font-size:18px;font-weight:700;color:${TEXT};">${escapeHtml(input.holderName)}</div>
  <div style="margin-top:4px;font-size:13px;color:${MUTED};">This pass is in your name — bring photo ID.</div>
  <div style="margin-top:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:${MUTED};">${escapeHtml(input.number)}</div>
  ${walletRow ? `<div style="margin-top:14px;">${walletRow}</div>` : ""}
</td></tr>
</table>
</td></tr>
<tr><td style="padding:4px 0 0;">
  <a href="${escapeHtml(input.lifetimeUrl)}" style="display:inline-block;padding:12px 18px;border:2px solid ${BORDER};color:${TEXT};text-decoration:none;font-size:14px;font-weight:600;">View your pass</a>
</td></tr>`;

  const support = input.supportEmail
    ? `Questions? <a href="mailto:${input.supportEmail}" style="color:${MUTED};">${escapeHtml(input.supportEmail)}</a><br>`
    : "";

  const footer = `${support}This pass is in your name and can't be transferred — the door checks it against your ID. One entry per event.`;

  const text = [
    "Your Atmos lifetime pass",
    "",
    "This gets you into every Atmos event. Show the code at the door, or add it to your wallet.",
    "",
    `${input.number} (${input.accessLabel})`,
    `In the name of ${input.holderName} — bring photo ID.`,
    "",
    `Your pass: ${input.lifetimeUrl}`,
  ].join("\n");

  return {
    subject: "Your Atmos lifetime pass",
    html: layout("Your Atmos lifetime pass", body, footer),
    text,
  };
}

/**
 * A rounded panel in the shape the ticket pages use: square top-left corner,
 * the rest rounded. Outlook on Windows ignores the rounding and draws it
 * square, which still reads fine.
 */
function panel(content: string): string {
  return `<div style="background:#0b0b0b;border:1px solid #242424;border-radius:16px;border-top-left-radius:0;padding:16px 18px;">${content}</div>`;
}

/** The site's lime pill button. */
function pillButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 26px;background:${SITE_ACCENT};color:#000000;text-decoration:none;font-size:15px;font-weight:700;border-radius:999px;">${escapeHtml(label)}</a>`;
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
    We've refunded ${formatNZD(amountCents)} for order ${escapeHtml(orderNumber)}, ${escapeHtml(eventName)}.<br>
    ${ticketNumbers.length > 0 ? `Cancelled: ${list}.<br>` : ""}
    The refund lands back on the card you paid with, usually within 5 to 10 business days.
  </div>
</td></tr>${
    // A payment refunded before anything was issued has no tickets to warn about.
    ticketNumbers.length > 0
      ? `
<tr><td style="padding:0 0 14px;">
  ${panel(`<div style="font-size:14px;line-height:1.7;color:${MUTED};">Those tickets no longer work at the door. Any wallet passes will stop scanning too.</div>`)}
</td></tr>`
      : ""
  }`;

  const footer = supportEmail
    ? `Questions? <a href="mailto:${supportEmail}" style="color:${MUTED};">${escapeHtml(supportEmail)}</a>`
    : "";

  const text = [
    "Refund processed",
    "",
    `We've refunded ${formatNZD(amountCents)} for order ${orderNumber}, ${eventName}.`,
    ticketNumbers.length > 0 ? `Cancelled: ${ticketNumbers.join(", ")}.` : "",
    "The refund lands back on the card you paid with, usually within 5 to 10 business days.",
    ticketNumbers.length > 0 ? "Those tickets no longer work at the door." : "",
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
 * A refund an admin has offered, with their message, and the button that
 * starts taking it. Says plainly that doing nothing keeps the tickets.
 */
export function renderRefundOfferEmail({
  eventName,
  eventStartsAt,
  timezone,
  orderNumber,
  message,
  amountCents,
  ticketCount,
  expiresAt,
  url,
  supportEmail,
}: {
  eventName: string;
  eventStartsAt: Date;
  timezone: string;
  orderNumber: string;
  message: string;
  amountCents: number;
  ticketCount: number;
  expiresAt: Date;
  url: string;
  supportEmail: string | null;
}): { subject: string; html: string; text: string } {
  const tickets =
    ticketCount === 1
      ? "Your ticket stops"
      : `Your ${ticketCount} tickets stop`;
  const until = formatEventDateLong(expiresAt, timezone);
  // Signed by the team, not whichever admin sent it.
  const signed = "Atmos crew";

  const body = `
<tr><td style="padding:0 0 18px;">
  <div style="font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};margin-bottom:10px;">You can get a refund</div>
  <div style="font-size:15px;color:${MUTED};line-height:1.7;">For order ${escapeHtml(orderNumber)}, ${escapeHtml(eventName)}, ${escapeHtml(formatEventDateLong(eventStartsAt, timezone))}.</div>
</td></tr>
<tr><td style="padding:0 0 12px;">
  ${panel(`<div style="font-size:15px;line-height:1.65;color:${TEXT};white-space:pre-line;">${escapeHtml(message)}</div>
  <div style="padding-top:8px;font-size:12px;color:${MUTED};">${escapeHtml(signed)}</div>`)}
</td></tr>
<tr><td style="padding:0 0 20px;">
  ${panel(`<div style="font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};">${formatNZD(amountCents)}</div>
  <div style="padding-top:6px;font-size:14px;color:${MUTED};line-height:1.7;">back to the card you paid with. ${tickets} working once you take it. If you want to keep ${ticketCount === 1 ? "it" : "them"}, do nothing.</div>`)}
</td></tr>
<tr><td style="padding:0 0 8px;">
  ${pillButton(url, "Get my refund")}
</td></tr>`;

  const footer = [
    `Open until ${escapeHtml(until)}.`,
    supportEmail
      ? `Questions? <a href="mailto:${supportEmail}" style="color:${MUTED};">${escapeHtml(supportEmail)}</a>`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const text = [
    "You can get a refund",
    "",
    `For order ${orderNumber}, ${eventName}, ${formatEventDateLong(eventStartsAt, timezone)}.`,
    "",
    message,
    `- ${signed}`,
    "",
    `${formatNZD(amountCents)} back to the card you paid with. ${tickets} working once you take it. If you want to keep ${ticketCount === 1 ? "it" : "them"}, do nothing.`,
    "",
    `Get my refund: ${url}`,
    "",
    `Open until ${until}.`,
  ].join("\n");

  return {
    subject: `You can get a refund for ${eventName}`,
    html: layout(`You can get a refund for ${eventName}`, body, footer),
    text,
  };
}

/**
 * A contract sent for signature: what it is for, and the button that opens
 * it. The same email is the reminder, with a different opening line.
 */
export function renderContractInviteEmail({
  agreement,
  subjectLine,
  summary,
  url,
  sentBy,
  reminder,
}: {
  /** "performer agreement" or "equipment hire agreement". */
  agreement: string;
  /** What it covers: the event, or the hire dates. */
  subjectLine: string;
  /** One line under the heading: the date and set time, or the hirer. */
  summary: string;
  url: string;
  sentBy: string;
  reminder: boolean;
}): { subject: string; html: string; text: string } {
  const heading = reminder
    ? `A reminder to sign your ${agreement}`
    : `Your ${agreement}`;
  const ask =
    "Read it through, fill in your details, and sign it online. It takes a couple of minutes.";
  const subject = `${reminder ? "Reminder: your" : "Your"} ${agreement} for ${subjectLine}`;
  const about = [subjectLine, summary].filter(Boolean).join(". ");

  const body = `
<tr><td style="padding:0 0 18px;">
  <div style="font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};margin-bottom:10px;">${escapeHtml(heading)}</div>
  <div style="font-size:15px;color:${MUTED};line-height:1.7;">${escapeHtml(about)}.</div>
</td></tr>
<tr><td style="padding:0 0 20px;">
  ${panel(`<div style="font-size:15px;line-height:1.65;color:${TEXT};">${escapeHtml(ask)}</div>`)}
</td></tr>
<tr><td style="padding:0 0 8px;">
  ${pillButton(url, "Read and sign")}
</td></tr>`;

  const footer = `Sent by ${escapeHtml(sentBy)} at Atmos. Questions? Reply to this email.`;

  const text = [
    heading,
    "",
    `${about}.`,
    "",
    ask,
    "",
    `Read and sign: ${url}`,
    "",
    `Sent by ${sentBy} at Atmos. Questions? Reply to this email.`,
  ].join("\n");

  return { subject, html: layout(subject, body, footer), text };
}

/** The other party's copy once they have signed: a link back to the signed contract. */
export function renderContractSignedEmail({
  agreement,
  subjectLine,
  signedName,
  signedOn,
  url,
}: {
  agreement: string;
  subjectLine: string;
  signedName: string;
  signedOn: string;
  url: string;
}): { subject: string; html: string; text: string } {
  const subject = `Signed: your ${agreement} for ${subjectLine}`;
  const keep =
    "Keep this email. The link opens your signed agreement, which you can print or save as a PDF.";

  const body = `
<tr><td style="padding:0 0 18px;">
  <div style="font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};margin-bottom:10px;">Signed</div>
  <div style="font-size:15px;color:${MUTED};line-height:1.7;">Your ${escapeHtml(agreement)} for ${escapeHtml(subjectLine)}, signed by ${escapeHtml(signedName)} on ${escapeHtml(signedOn)}.</div>
</td></tr>
<tr><td style="padding:0 0 20px;">
  ${panel(`<div style="font-size:15px;line-height:1.65;color:${TEXT};">${escapeHtml(keep)}</div>`)}
</td></tr>
<tr><td style="padding:0 0 8px;">
  ${pillButton(url, "View your copy")}
</td></tr>`;

  const footer = "Questions? Reply to this email.";

  const text = [
    "Signed",
    "",
    `Your ${agreement} for ${subjectLine}, signed by ${signedName} on ${signedOn}.`,
    "",
    keep,
    "",
    `View your copy: ${url}`,
  ].join("\n");

  return { subject, html: layout(subject, body, footer), text };
}

/** The code that proves a refund is going to the order's own inbox. */
export function renderRefundCodeEmail({
  code,
  eventName,
}: {
  code: string;
  eventName: string;
}): { subject: string; html: string; text: string } {
  const body = `
<tr><td style="padding:0 0 18px;">
  <div style="font-size:15px;color:${MUTED};line-height:1.7;margin-bottom:12px;">Your code to take the refund for ${escapeHtml(eventName)}:</div>
  ${panel(`<div style="font-size:34px;line-height:1.2;font-weight:800;letter-spacing:0.18em;color:${TEXT};font-family:Menlo,Consolas,monospace;">${escapeHtml(code)}</div>`)}
  <div style="font-size:14px;color:${MUTED};line-height:1.7;margin-top:14px;">It works for 10 minutes. If you didn't ask for it, ignore this email: nothing is refunded without it.</div>
</td></tr>`;
  const text = [
    `Your code to take the refund for ${eventName}: ${code}`,
    "",
    "It works for 10 minutes. If you didn't ask for it, ignore this email: nothing is refunded without it.",
  ].join("\n");
  return {
    subject: `${code} is your refund code`,
    html: layout(`${code} is your refund code`, body, ""),
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
    [
      "Status",
      approved
        ? "Approved"
        : outcome === "DECLINED"
          ? "Declined"
          : "Not completed",
    ],
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
    html: layout(
      "Tap to Pay on iPhone is now available in Atmos",
      body,
      footer,
    ),
    text,
  };
}
