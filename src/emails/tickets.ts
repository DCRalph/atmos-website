import { formatNZD } from "~/lib/ticketing/money";
import { formatEventDateLong, formatEventTime } from "~/lib/ticketing/dates";
import {
  COLORS,
  detailTable,
  emailShell,
  escapeHtml,
  eyebrow,
  ghostButton,
  intro,
  panel,
  paragraph,
  pillButton,
  row,
  supportLine,
  type RenderedEmail,
} from "./layout";

/**
 * Ticketing mail: orders, comps, lifetime passes, refunds, door receipts and
 * the Tap to Pay launch.
 *
 * QR codes are inline `cid:` attachments, never remote images: a client that
 * blocks remote content would otherwise leave somebody at the door with an
 * empty box where their ticket should be.
 */

const { text: TEXT, muted: MUTED } = COLORS;
const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";
/** Lifetime passes get a gold edge, like the pass page. */
const GOLD = "#C9A227";
const GOLD_BORDER = "#4a3b12";

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

type EventDetails = Pick<
  TicketEmailInput,
  | "eventTimezone"
  | "startsAt"
  | "doorsAt"
  | "venueName"
  | "venueAddress"
  | "isR18"
>;

/** Date, doors and venue lines, shared by the HTML and the text. */
function eventLines(input: EventDetails) {
  return {
    dateLine: `${formatEventDateLong(input.startsAt, input.eventTimezone)} · ${formatEventTime(input.startsAt, input.eventTimezone)}`,
    doorsLine: input.doorsAt
      ? `Doors ${formatEventTime(input.doorsAt, input.eventTimezone)}`
      : null,
    venueLine: [input.venueName, input.venueAddress].filter(Boolean).join(", "),
  };
}

/** The heading and the when and where under it. */
function eventIntro(headingHtml: string, input: EventDetails): string {
  const { dateLine, doorsLine, venueLine } = eventLines(input);
  return row(
    [
      `<div style="font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};margin-bottom:14px;">${headingHtml}</div>`,
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
    ].join(""),
  );
}

function appleWalletBadge(url: string, cid: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;margin:0 8px 8px 0;text-decoration:none;">
    <img src="cid:${escapeHtml(cid)}" width="133" height="42" alt="Add to Apple Wallet" style="display:block;width:133px;height:42px;border:0;">
  </a>`;
}

function googleWalletButton(url: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;padding:11px 16px;margin:0 8px 8px 0;border:1px solid ${COLORS.strongBorder};border-radius:10px;color:${TEXT};text-decoration:none;font-size:13px;line-height:18px;">Add to Google Wallet</a>`;
}

function walletRow({
  appleUrl,
  appleCid,
  googleUrl,
}: {
  appleUrl?: string;
  appleCid?: string;
  googleUrl?: string;
}): string {
  const buttons = [
    appleUrl && appleCid ? appleWalletBadge(appleUrl, appleCid) : "",
    googleUrl ? googleWalletButton(googleUrl) : "",
  ].join("");
  return buttons ? `<div style="margin-top:14px;">${buttons}</div>` : "";
}

function accessBadge(
  label: string | null,
  bg: string | null,
  fg: string | null,
): string {
  return label
    ? `<div style="margin-top:10px;"><span style="display:inline-block;padding:5px 12px;background:${bg ?? TEXT};color:${fg ?? "#000000"};font-size:12px;font-weight:700;letter-spacing:0.08em;">${escapeHtml(label.toUpperCase())}</span></div>`
    : "";
}

/** The QR on a white square, so it scans off a dark screen. */
function qrImage(cid: string, alt: string): string {
  return `<div style="background:#ffffff;padding:12px;display:inline-block;">
    <img src="cid:${escapeHtml(cid)}" width="220" height="220" alt="${escapeHtml(alt)}" style="display:block;width:220px;height:220px;">
  </div>`;
}

function ticketNumberLine(value: string, gap = 0): string {
  return `<div style="margin-top:${gap}px;font-family:${MONO};font-size:13px;color:${MUTED};">${escapeHtml(value)}</div>`;
}

/** A prompt panel: a line of white, a line of grey, a pill. */
function promptPanel(title: string, body: string, href: string, cta: string) {
  return row(
    panel(
      `<div style="font-size:14px;color:${TEXT};margin-bottom:8px;">${escapeHtml(title)}</div>
  ${paragraph(escapeHtml(body), { muted: true })}
  <div style="margin-top:14px;">${pillButton(href, cta)}</div>`,
    ),
    14,
  );
}

function ticketCard(
  ticket: EmailTicket,
  input: TicketEmailInput,
  index: number,
): string {
  const name = ticket.attendeeName
    ? `<div style="font-size:15px;font-weight:600;color:${TEXT};margin-bottom:2px;">${escapeHtml(ticket.attendeeName)}</div>`
    : "";

  return row(
    panel(
      `${eyebrow(`Ticket ${index + 1} of ${input.tickets.length} · ${ticket.tierName}`)}
  ${qrImage(ticket.qrCid, `Entry QR code for ${ticket.ticketNumber}`)}
  ${accessBadge(ticket.accessLabel, ticket.accessBadgeBg, ticket.accessBadgeFg)}
  <div style="margin-top:14px;">${name}${ticketNumberLine(ticket.ticketNumber)}</div>
  ${walletRow({
    appleUrl: input.appleWalletUrlFor?.(ticket.ticketNumber),
    appleCid: input.appleWalletBadgeCid,
    googleUrl: input.googleWalletUrlFor?.(ticket.ticketNumber),
  })}`,
      { align: "center" },
    ),
    14,
  );
}

export function renderTicketEmail(input: TicketEmailInput): RenderedEmail {
  const { dateLine, doorsLine, venueLine } = eventLines(input);

  const namesPrompt = input.needsAttendeeNames
    ? promptPanel(
        "One quick thing",
        "Add the name of whoever is using each ticket so the door can find them fast. It only takes a second, and you can do it any time before the event.",
        input.detailsUrl,
        "Add names",
      )
    : "";

  const summaryRow = (label: string, value: string, muted = true) =>
    `<tr>
      <td style="padding:3px 0;font-size:13px;color:${muted ? MUTED : TEXT};">${escapeHtml(label)}</td>
      <td align="right" style="padding:3px 0;font-size:13px;color:${muted ? MUTED : TEXT};">${escapeHtml(value)}</td>
    </tr>`;

  const summary = row(
    panel(`${eyebrow(`Order ${input.orderNumber}`)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${summaryRow("Tickets", formatNZD(input.totals.subtotalCents))}
    ${input.totals.discountCents > 0 ? summaryRow("Discount", `−${formatNZD(input.totals.discountCents)}`) : ""}
    ${input.totals.venueFeeCents > 0 ? summaryRow("Venue booking fee", formatNZD(input.totals.venueFeeCents)) : ""}
    ${input.totals.bookingFeeCents > 0 ? summaryRow("Booking fee", formatNZD(input.totals.bookingFeeCents)) : ""}
    <tr><td colspan="2" style="border-top:1px solid ${COLORS.panelBorder};padding-top:8px;"></td></tr>
    ${summaryRow("Total paid", formatNZD(input.totals.totalCents), false)}
    ${input.totals.gstCents > 0 ? summaryRow(`Includes GST`, formatNZD(input.totals.gstCents)) : ""}
  </table>
  ${
    input.gstNumber
      ? `<div style="margin-top:10px;font-size:11px;color:${MUTED};">${escapeHtml(input.legalName)} · GST ${escapeHtml(input.gstNumber)}</div>`
      : ""
  }`),
    14,
  );

  const body = [
    eventIntro(`You're going to ${escapeHtml(input.eventName)}`, input),
    ...input.tickets.map((ticket, i) => ticketCard(ticket, input, i)),
    namesPrompt,
    summary,
    row(ghostButton(input.ticketsUrl, "View tickets online"), 8),
  ].join("\n");

  const support = supportLine(input.supportEmail);
  const footer = `${support ? `${support}<br>` : ""}Keep this email — the link above always shows your latest tickets.<br>
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
    html: emailShell({ title: input.eventName, body, footer }),
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
export function renderCompEmail(input: CompEmailInput): RenderedEmail {
  const { dateLine, doorsLine, venueLine } = eventLines(input);

  const heading = input.invitedByName
    ? `${escapeHtml(input.invitedByName)} has put you on the list`
    : `You're on the list for ${escapeHtml(input.eventName)}`;

  // The name is the whole mechanism, so it is the largest thing on the card.
  const nameBlock = input.ticket.attendeeName
    ? `<div style="margin-top:14px;font-size:18px;font-weight:700;color:${TEXT};">${escapeHtml(input.ticket.attendeeName)}</div>
       <div style="margin-top:4px;font-size:13px;color:${MUTED};">This ticket is in your name — bring photo ID.</div>`
    : "";

  const handouts =
    input.handoutCount > 0
      ? promptPanel(
          `${input.handoutCount} ${input.handoutCount === 1 ? "ticket" : "tickets"} to hand out`,
          `Open your ticket page to send ${input.handoutCount === 1 ? "it" : "them"} on. Whoever you send to gets their own ticket by email, in their name.`,
          input.ticketUrl,
          "Hand out tickets",
        )
      : "";

  const card = row(
    panel(
      `${eyebrow(input.ticket.tierName)}
  ${qrImage(input.ticket.qrCid, `Entry QR code for ${input.ticket.ticketNumber}`)}
  ${accessBadge(input.ticket.accessLabel, input.ticket.accessBadgeBg, input.ticket.accessBadgeFg)}
  ${nameBlock}
  ${ticketNumberLine(input.ticket.ticketNumber, 8)}
  ${walletRow({
    appleUrl: input.appleWalletUrl,
    appleCid: input.appleWalletBadgeCid,
    googleUrl: input.googleWalletUrl,
  })}`,
      { align: "center" },
    ),
    14,
  );

  const body = [
    eventIntro(heading, input),
    card,
    handouts,
    row(ghostButton(input.ticketUrl, "View your ticket"), 8),
  ].join("\n");

  const support = supportLine(input.supportEmail);
  const footer = `${support ? `${support}<br>` : ""}This ticket is in your name and can't be transferred — the door checks it against your ID.`;

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
    html: emailShell({ title: input.eventName, body, footer }),
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
export function renderLifetimeEmail(input: LifetimeEmailInput): RenderedEmail {
  const card = row(
    panel(
      `${eyebrow("Lifetime pass", GOLD)}
  ${qrImage(input.qrCid, `Entry QR code for lifetime pass ${input.number}`)}
  ${accessBadge(input.accessLabel, input.accessBadgeBg, input.accessBadgeFg)}
  <div style="margin-top:14px;font-size:18px;font-weight:700;color:${TEXT};">${escapeHtml(input.holderName)}</div>
  <div style="margin-top:4px;font-size:13px;color:${MUTED};">This pass is in your name — bring photo ID.</div>
  ${ticketNumberLine(input.number, 8)}
  ${walletRow({ appleUrl: input.appleWalletUrl, appleCid: input.appleWalletBadgeCid })}`,
      { align: "center", border: GOLD_BORDER },
    ),
    14,
  );

  const body = [
    intro(
      "Your Atmos lifetime pass",
      "This gets you into every Atmos event. Show the code at the door, or add it to your wallet so it's always there.",
    ),
    card,
    row(ghostButton(input.lifetimeUrl, "View your pass"), 8),
  ].join("\n");

  const support = supportLine(input.supportEmail);
  const footer = `${support ? `${support}<br>` : ""}This pass is in your name and can't be transferred — the door checks it against your ID. One entry per event.`;

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
    html: emailShell({ title: "Your Atmos lifetime pass", body, footer }),
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
}): RenderedEmail {
  const list = ticketNumbers.map((n) => escapeHtml(n)).join(", ");

  const body = [
    intro(
      "Refund processed",
      `We've refunded ${formatNZD(amountCents)} for order ${escapeHtml(orderNumber)}, ${escapeHtml(eventName)}.<br>
    ${ticketNumbers.length > 0 ? `Cancelled: ${list}.<br>` : ""}
    The refund lands back on the card you paid with, usually within 5 to 10 business days.`,
    ),
    // A payment refunded before anything was issued has no tickets to warn about.
    ticketNumbers.length > 0
      ? row(
          panel(
            paragraph(
              "Those tickets no longer work at the door. Any wallet passes will stop scanning too.",
              { muted: true },
            ),
          ),
          14,
        )
      : "",
  ].join("\n");

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

  const subject = `Refund processed — ${eventName}`;
  return {
    subject,
    html: emailShell({
      title: subject,
      body,
      footer: supportLine(supportEmail),
    }),
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
}): RenderedEmail {
  const tickets =
    ticketCount === 1
      ? "Your ticket stops"
      : `Your ${ticketCount} tickets stop`;
  const until = formatEventDateLong(expiresAt, timezone);
  // Signed by the team, not whichever admin sent it.
  const signed = "Atmos crew";

  const body = [
    intro(
      "You can get a refund",
      `For order ${escapeHtml(orderNumber)}, ${escapeHtml(eventName)}, ${escapeHtml(formatEventDateLong(eventStartsAt, timezone))}.`,
    ),
    row(
      panel(`<div style="font-size:15px;line-height:1.65;color:${TEXT};white-space:pre-line;">${escapeHtml(message)}</div>
  <div style="padding-top:8px;font-size:12px;color:${MUTED};">${escapeHtml(signed)}</div>`),
      12,
    ),
    row(
      panel(`<div style="font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};">${formatNZD(amountCents)}</div>
  <div style="padding-top:6px;font-size:14px;color:${MUTED};line-height:1.7;">back to the card you paid with. ${tickets} working once you take it. If you want to keep ${ticketCount === 1 ? "it" : "them"}, do nothing.</div>`),
      20,
    ),
    row(pillButton(url, "Get my refund"), 8),
  ].join("\n");

  const footer = [`Open until ${escapeHtml(until)}.`, supportLine(supportEmail)]
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

  const subject = `You can get a refund for ${eventName}`;
  return { subject, html: emailShell({ title: subject, body, footer }), text };
}

/** The code that proves a refund is going to the order's own inbox. */
export function renderRefundCodeEmail({
  code,
  eventName,
}: {
  code: string;
  eventName: string;
}): RenderedEmail {
  const body = [
    row(
      paragraph(`Your code to take the refund for ${escapeHtml(eventName)}:`, {
        muted: true,
      }),
      12,
    ),
    row(
      panel(
        `<div style="font-size:34px;line-height:1.2;font-weight:800;letter-spacing:0.18em;color:${TEXT};font-family:Menlo,Consolas,monospace;">${escapeHtml(code)}</div>`,
      ),
      14,
    ),
    row(
      paragraph(
        "It works for 10 minutes. If you didn't ask for it, ignore this email: nothing is refunded without it.",
        { muted: true },
      ),
    ),
  ].join("\n");
  const text = [
    `Your code to take the refund for ${eventName}: ${code}`,
    "",
    "It works for 10 minutes. If you didn't ask for it, ignore this email: nothing is refunded without it.",
  ].join("\n");
  const subject = `${code} is your refund code`;
  return {
    subject,
    html: emailShell({ title: subject, body, preview: subject }),
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
}): RenderedEmail {
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

  const explain = approved
    ? "Paid in person with Tap to Pay on iPhone. Your tickets were issued at the door."
    : outcome === "DECLINED"
      ? `The card was refused by the bank, so nothing has been charged.${
          declineReason ? ` Reason given: ${declineReason}.` : ""
        } If you were let in, you paid another way.`
      : "The card was never read, so nothing has been charged.";

  const body = [
    intro(heading, `${escapeHtml(eventName)}<br>${escapeHtml(explain)}`),
    row(panel(detailTable(rows)), 14),
    row(ghostButton(receiptUrl, "View receipt"), 8),
  ].join("\n");

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

  const subject = `${heading} — ${eventName}`;
  return {
    subject,
    html: emailShell({
      title: subject,
      body,
      footer: supportLine(supportEmail),
    }),
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
}): RenderedEmail {
  const greeting = recipientName ? `${recipientName}, ` : "";

  const body = [
    intro(
      "Take card payments on your iPhone",
      `${escapeHtml(greeting)}Tap to Pay on iPhone is now switched on in the Atmos app.
    You can accept contactless cards, Apple Pay and other digital wallets at the
    door using the iPhone already in your pocket — no extra reader to carry,
    charge or lose.`,
    ),
    row(
      panel(
        paragraph(
          `<strong style="color:${TEXT};">Getting started</strong><br>
    1. Open the Atmos app and go to More &rsaquo; Tap to Pay on iPhone.<br>
    2. An Atmos admin accepts Apple's Terms and Conditions on the handset.<br>
    3. Read the short guide, then take a test payment.<br><br>
    Needs an iPhone XS or later on a current version of iOS. Cash and eftpos
    stay available at every door.`,
          { muted: true },
        ),
      ),
      20,
    ),
    row(pillButton(appUrl, "Open Atmos"), 8),
  ].join("\n");

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

  const subject = "Tap to Pay on iPhone is now available in Atmos";
  return {
    subject,
    html: emailShell({
      title: subject,
      body,
      footer: supportLine(supportEmail),
    }),
    text,
  };
}
