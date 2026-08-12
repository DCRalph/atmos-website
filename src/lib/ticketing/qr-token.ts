/**
 * The one piece of the QR token format that both sides of the wire need.
 *
 * The signer and the scanner live in `~/server/ticketing/qr`, which is
 * `server-only`. The root layout also has to recognise a ticket token, so it
 * can strip one out of the address bar the moment a phone camera lands on an
 * event page — hence the prefix living out here on its own.
 */
export const TICKET_TOKEN_PREFIX = "atm1";
