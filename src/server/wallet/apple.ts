import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { PKPass } from "passkit-generator";

import { env } from "~/env";
import { buildTicketToken } from "~/server/ticketing/qr";
import { formatEventDateLong, formatEventTime } from "~/lib/ticketing/dates";
import { ticketTypeName } from "~/lib/ticketing/access-levels";
import {
  resolvePassTheme,
  toPassRgb,
  type PassThemeFields,
} from "~/lib/ticketing/pass-theme";
import { getAppleWalletConfig } from "./apple-config";
import { getPassImages } from "./pass-images";

/**
 * Apple Wallet passes.
 *
 * `webServiceURL` is set from the start so passes stay updatable — a changed
 * door time or a cancelled event can be pushed to a phone that is already
 * holding the ticket. Passes issued without it are frozen forever, and
 * retrofitting means re-issuing every ticket.
 */

export type PassTicket = {
  id: string;
  ticketNumber: string;
  qrVersion: number;
  qrSecret: string;
  attendeeName: string | null;
  accessLevel: string;
  /** Null on a comp, which is minted rather than drawn from a tier. */
  tier: { name: string } | null;
};

export type PassEvent = {
  id: string;
  name: string;
  timezone: string;
  startsAt: Date;
  doorsAt: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  isR18: boolean;
  status: string;
} & PassThemeFields;

/**
 * Per-pass secret for the Apple web service. Derived, so nothing extra is
 * stored and it dies with the ticket.
 */
export function applePassAuthToken(ticketId: string): string {
  const secret = env.TICKET_QR_SECRET;
  if (!secret) throw new Error("TICKET_QR_SECRET is not set.");
  return createHmac("sha256", secret)
    .update(`apple-pass.${ticketId}`)
    .digest("base64url");
}

export function verifyApplePassAuthToken(
  ticketId: string,
  provided: string,
): boolean {
  const expected = Buffer.from(applePassAuthToken(ticketId), "utf8");
  const given = Buffer.from(provided, "utf8");
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

export async function buildApplePass({
  ticket,
  event,
  orderNumber,
}: {
  ticket: PassTicket;
  event: PassEvent;
  orderNumber: string;
}): Promise<Buffer> {
  const config = getAppleWalletConfig();
  const theme = resolvePassTheme(event);
  const images = await getPassImages(theme);

  const doorsText = event.doorsAt
    ? formatEventTime(event.doorsAt, event.timezone)
    : formatEventTime(event.startsAt, event.timezone);

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    serialNumber: ticket.id,
    organizationName: "Atmos Media",
    description: `Ticket — ${event.name}`,

    foregroundColor: toPassRgb(theme.foregroundHex),
    backgroundColor: toPassRgb(theme.backgroundHex),
    labelColor: toPassRgb(theme.labelHex),

    // Lets the pass surface itself on the lock screen near the venue and time.
    relevantDate: (event.doorsAt ?? event.startsAt).toISOString(),
    expirationDate: new Date(
      event.startsAt.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString(),

    // Apple appends `/v1/devices/...` itself, so this is the base only.
    webServiceURL: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/wallet/apple`,
    authenticationToken: applePassAuthToken(ticket.id),

    eventTicket: {
      headerFields: [
        {
          key: "doors",
          label: "DOORS",
          value: doorsText,
        },
      ],
      primaryFields: [
        {
          key: "event",
          label: "EVENT",
          value: event.name,
        },
      ],
      secondaryFields: [
        {
          key: "date",
          label: "DATE",
          value: formatEventDateLong(event.startsAt, event.timezone),
        },
        ...(event.venueName
          ? [{ key: "venue", label: "VENUE", value: event.venueName }]
          : []),
      ],
      auxiliaryFields: [
        {
          key: "tier",
          label: "TICKET",
          value: ticketTypeName(ticket),
        },
        ...(ticket.attendeeName
          ? [{ key: "name", label: "NAME", value: ticket.attendeeName }]
          : []),
      ],
      backFields: [
        {
          key: "ticketNumber",
          label: "Ticket number",
          value: ticket.ticketNumber,
        },
        { key: "order", label: "Order", value: orderNumber },
        ...(event.venueAddress
          ? [{ key: "address", label: "Address", value: event.venueAddress }]
          : []),
        ...(event.isR18
          ? [
              {
                key: "r18",
                label: "R18",
                value:
                  "This is an R18 event. Bring photo ID — you will not get in without it.",
              },
            ]
          : []),
        {
          key: "terms",
          label: "Terms",
          value:
            "One entry per ticket. The first scan is the one that gets in. Full terms: " +
            `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/tickets/terms`,
        },
      ],
    },
  };

  const pass = new PKPass(
    {
      ...images,
      "pass.json": Buffer.from(JSON.stringify(passJson), "utf8"),
    },
    {
      wwdr: config.wwdr,
      signerCert: config.signerCert,
      signerKey: config.signerKey,
      signerKeyPassphrase: config.signerKeyPassphrase,
    },
  );

  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: buildTicketToken(ticket),
    // Apple's own recommendation for QR payloads.
    messageEncoding: "iso-8859-1",
    altText: ticket.ticketNumber,
  });

  // A cancelled event should say so on the pass itself, not just in an email.
  if (event.status === "CANCELLED") {
    pass.setExpirationDate(new Date());
  }

  return pass.getAsBuffer();
}
