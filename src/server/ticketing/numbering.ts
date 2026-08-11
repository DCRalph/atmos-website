import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { env } from "~/env";
import { db } from "~/server/db";

/**
 * Order numbers, ticket numbers, and the secret behind `/tickets/[token]`.
 */

/**
 * Crockford-ish alphabet with the ambiguous characters removed (no 0/O, no
 * 1/I/L). Order numbers get read aloud across a loud room and typed into the
 * scanner's manual-entry box, so "was that an O or a zero" is a real cost.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const ORDER_NUMBER_LENGTH = 6;
const PREFIX = "ATM";

function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

/**
 * A human-facing order number, checked for collisions before it is handed out.
 *
 * The unique constraint on `TicketOrder.orderNumber` is the real guarantee;
 * this just avoids losing a checkout to an astronomically unlucky clash.
 */
export async function generateOrderNumber(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = `${PREFIX}-${randomCode(ORDER_NUMBER_LENGTH)}`;
    const existing = await db.ticketOrder.findUnique({
      where: { orderNumber: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  // Vanishingly unlikely; fall back to a longer code rather than fail a sale.
  return `${PREFIX}-${randomCode(ORDER_NUMBER_LENGTH + 4)}`;
}

/** `ATM-4F7K2X` + seat 3 -> `ATM-4F7K2X-03`. */
export function buildTicketNumber(orderNumber: string, index: number): string {
  return `${orderNumber}-${String(index + 1).padStart(2, "0")}`;
}

/**
 * The token in a buyer's `/tickets/[token]` link.
 *
 * Derived rather than stored: `<orderId>.<hmac>`, where the HMAC covers the
 * order id and its `accessTokenVersion`. Three things fall out of that —
 * we can rebuild anyone's link on demand (so "resend my tickets" works years
 * later), no bearer secret sits in the database, and bumping the version
 * revokes the old link without touching anything else.
 */
export function buildOrderAccessToken(
  orderId: string,
  accessTokenVersion: number,
): string {
  return `${orderId}.${accessSignature(orderId, accessTokenVersion)}`;
}

export type ParsedAccessToken = { orderId: string; signature: string };

export function parseOrderAccessToken(raw: string): ParsedAccessToken | null {
  const parts = raw.trim().split(".");
  if (parts.length !== 2) return null;
  const [orderId, signature] = parts;
  if (!orderId || !/^[a-z0-9]{20,40}$/i.test(orderId)) return null;
  if (!signature || !/^[A-Za-z0-9_-]{20,64}$/.test(signature)) return null;
  return { orderId, signature };
}

export function verifyOrderAccessToken(
  parsed: ParsedAccessToken,
  order: { id: string; accessTokenVersion: number },
): boolean {
  const expected = Buffer.from(
    accessSignature(order.id, order.accessTokenVersion),
    "utf8",
  );
  const provided = Buffer.from(parsed.signature, "utf8");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

function accessSignature(orderId: string, version: number): string {
  const secret = env.TICKET_QR_SECRET;
  if (!secret) {
    throw new Error(
      "TICKET_QR_SECRET is not set. Ticket links cannot be signed or verified.",
    );
  }
  // Prefixed so this can never collide with a QR payload signature, even
  // though both are keyed on the same secret.
  return createHmac("sha256", secret)
    .update(`order-access.${orderId}.${version}`)
    .digest()
    .subarray(0, 24)
    .toString("base64url");
}
