/**
 * The pieces of the QR token format that both sides of the wire need.
 *
 * The signer and the scanner live in `~/server/ticketing/qr`, which is
 * `server-only`. The root layout also has to recognise a ticket token, so it
 * can strip one out of the address bar the moment a phone camera lands on an
 * event page — hence the prefixes living out here on their own.
 */
export const TICKET_TOKEN_PREFIX = "atm1";

/**
 * A lifetime pass carries its own kind of token. Same shape as a ticket's,
 * different prefix, so the scanner knows which table to look in before it
 * touches the database.
 */
export const LIFETIME_TOKEN_PREFIX = "atl1";

/** Every prefix a camera might land on and the address bar should drop. */
export const TOKEN_PREFIXES = [
  TICKET_TOKEN_PREFIX,
  LIFETIME_TOKEN_PREFIX,
] as const;
