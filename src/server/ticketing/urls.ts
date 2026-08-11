import "server-only";

import { env } from "~/env";

/**
 * Every externally-visible ticketing URL in one place, so email, wallet passes
 * and the web pages can never drift apart.
 *
 * Wallet and pass endpoints authenticate with the order's access token rather
 * than a session — the buyer is a guest, and their mail client is the only
 * thing holding a credential.
 */

function base(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

export function eventUrl(slug: string): string {
  return `${base()}/events/${slug}`;
}

export function ticketsUrl(accessToken: string): string {
  return `${base()}/tickets/${accessToken}`;
}

/** Where the buyer says who they are and names each ticket. */
export function ticketDetailsUrl(accessToken: string): string {
  return `${base()}/tickets/${accessToken}/details`;
}

export function applePassUrl(ticketId: string, accessToken: string): string {
  return `${base()}/api/tickets/${ticketId}/pkpass?t=${encodeURIComponent(accessToken)}`;
}

export function googleWalletSaveUrl(
  ticketId: string,
  accessToken: string,
): string {
  return `${base()}/api/tickets/${ticketId}/google-wallet?t=${encodeURIComponent(accessToken)}`;
}

export function termsUrl(): string {
  return `${base()}/tickets/terms`;
}

export function privacyUrl(): string {
  return `${base()}/privacy`;
}
