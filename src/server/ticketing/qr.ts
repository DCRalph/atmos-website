import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

/**
 * Ticket QR payloads.
 *
 * Format: `atm1.<ticketId>.<qrVersion>.<signature>`
 *
 * Deliberately *not* a URL. If someone points their camera app at a photo of
 * a ticket they get an opaque string, not a working link to anything.
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

const PREFIX = "atm1";
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

export type ParsedTicketToken = {
  ticketId: string;
  qrVersion: number;
  signature: string;
};

/**
 * Cheap structural parse, before any database work. Returns null for anything
 * that is not shaped like one of our tokens — a shop loyalty card, a Wi-Fi QR,
 * a smudge that decoded to garbage.
 */
export function parseTicketToken(raw: string): ParsedTicketToken | null {
  const trimmed = raw.trim();
  const parts = trimmed.split(".");
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
