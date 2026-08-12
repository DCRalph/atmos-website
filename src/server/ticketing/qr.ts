import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "~/env";
import { TICKET_TOKEN_PREFIX } from "~/lib/ticketing/qr-token";
import { eventUrl } from "~/server/ticketing/urls";

/**
 * Ticket QR payloads.
 *
 * Token: `atm1.<ticketId>.<qrVersion>.<signature>`
 * Encoded in the QR: `https://…/events/<slug>#atm1.<ticketId>.<qrVersion>.<sig>`
 *
 * The token is hung off the event's own public page as a URL *fragment*, so
 * one code does two jobs. A phone camera sees a link and opens the page that
 * sells tickets to that event — every ticket in the room, every screenshot in
 * a group chat, is a poster. The door scanner reads the same string and takes
 * what follows the `#`.
 *
 * The fragment is what makes that safe to point a stranger's camera at.
 * Fragments are never sent with the HTTP request, so the token stays out of
 * access logs, out of the `Referer` header, and out of reach of anything the
 * page loads; the server cannot leak a secret it was never told. The page then
 * strips it from the address bar on arrival, and because nothing server-side
 * ever sees it, a valid token and a garbage one render exactly the same page —
 * there is no oracle here telling a scanner whether it found a live ticket.
 *
 * The signature covers the ticket's own random `qrSecret` as well as the
 * server secret, so a leaked `TICKET_QR_SECRET` on its own is not enough to
 * forge a ticket — you would also need the per-ticket secret out of the
 * database. That means verification needs a DB read, which is fine: scanning
 * is online-only by design, so the scanner was going to read the row anyway to
 * check status and prior scans.
 *
 * `qrVersion` lets us invalidate an issued code (reissue, transfer) without
 * changing the ticket's identity.
 */

const PREFIX = TICKET_TOKEN_PREFIX;
/** 16 bytes of HMAC, base64url — 22 chars. Plenty, and keeps the QR small. */
const SIG_BYTES = 16;

function qrSigningKey(): string {
  const secret = env.TICKET_QR_SECRET;
  if (!secret) {
    throw new Error(
      "TICKET_QR_SECRET is not set. Ticket QR codes cannot be signed or verified.",
    );
  }
  return secret;
}

function sign(ticketId: string, qrVersion: number, qrSecret: string): string {
  return createHmac("sha256", qrSigningKey())
    .update(`${ticketId}.${qrVersion}.${qrSecret}`)
    .digest()
    .subarray(0, SIG_BYTES)
    .toString("base64url");
}

/** A fresh per-ticket secret. Stored on the `Ticket` row at issuance. */
export function generateQrSecret(): string {
  return randomBytes(24).toString("base64url");
}

export function buildTicketToken(ticket: {
  id: string;
  qrVersion: number;
  qrSecret: string;
}): string {
  const signature = sign(ticket.id, ticket.qrVersion, ticket.qrSecret);
  return `${PREFIX}.${ticket.id}.${ticket.qrVersion}.${signature}`;
}

/**
 * What actually goes in the QR image, the wallet barcode and the email
 * attachment: the token as a fragment on the event's public page.
 *
 * `buildTicketToken` stays the bare credential — it is what the scanner
 * compares against and what `admitByTicketNumber` rebuilds — while this is the
 * thing a camera is ever pointed at.
 */
export function buildTicketQrPayload(
  ticket: { id: string; qrVersion: number; qrSecret: string },
  eventSlug: string,
): string {
  return `${eventUrl(eventSlug)}#${buildTicketToken(ticket)}`;
}

export type ParsedTicketToken = {
  ticketId: string;
  qrVersion: number;
  signature: string;
};

/**
 * Take the token out of whatever the scanner handed us.
 *
 * Codes arrive bare or as an event URL with the token in the fragment,
 * depending on when the ticket was issued: passes and emailed QRs minted
 * before the URL format are in pockets and wallets already, and they still
 * have to open the door. A base64url signature never contains `#`, so the last
 * one is always the separator.
 */
function stripToToken(raw: string): string {
  const trimmed = raw.trim();
  const hash = trimmed.lastIndexOf("#");
  return hash === -1 ? trimmed : trimmed.slice(hash + 1);
}

/**
 * Cheap structural parse, before any database work. Returns null for anything
 * that is not shaped like one of our tokens — a shop loyalty card, a Wi-Fi QR,
 * a smudge that decoded to garbage.
 */
export function parseTicketToken(raw: string): ParsedTicketToken | null {
  const parts = stripToToken(raw).split(".");
  if (parts.length !== 4) return null;

  const [prefix, ticketId, versionRaw, signature] = parts;
  if (prefix !== PREFIX) return null;
  if (!ticketId || !/^[a-z0-9]{20,40}$/i.test(ticketId)) return null;
  if (!versionRaw || !/^\d{1,4}$/.test(versionRaw)) return null;
  if (!signature || !/^[A-Za-z0-9_-]{20,32}$/.test(signature)) return null;

  return {
    ticketId,
    qrVersion: Number(versionRaw),
    signature,
  };
}

/**
 * Constant-time check of a parsed token against the ticket row it claims to be.
 */
export function verifyTicketToken(
  parsed: ParsedTicketToken,
  ticket: { id: string; qrVersion: number; qrSecret: string },
): boolean {
  if (parsed.ticketId !== ticket.id) return false;
  // A code from before a reissue must not open the door.
  if (parsed.qrVersion !== ticket.qrVersion) return false;

  const expected = Buffer.from(
    sign(ticket.id, ticket.qrVersion, ticket.qrSecret),
    "utf8",
  );
  const provided = Buffer.from(parsed.signature, "utf8");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
