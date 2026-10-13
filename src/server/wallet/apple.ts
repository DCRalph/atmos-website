import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { PKPass } from "passkit-generator";

import { env } from "~/env";
import { buildTicketQrPayload } from "~/server/ticketing/qr";
import { formatEventDateLong, formatEventTime } from "~/lib/ticketing/dates";
import { resolveLevel } from "~/server/ticketing/access-level-store";
import { toPassRgb } from "~/lib/ticketing/pass-theme";
import {
  parseEventPassDesign,
  resolveTicketPassDesign,
} from "~/lib/ticketing/pass-design";
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
  /** The barcode is a link to the event's page, so the pass needs its slug. */
  slug: string;
  name: string;
  timezone: string;
  startsAt: Date;
  doorsAt: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  isR18: boolean;
  status: string;
  /** The stored JSON, parsed here. See `~/lib/ticketing/pass-design.ts`. */
  passDesign: unknown;
};

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

  /**
   * A better ticket gets a louder pass.
   *
   * The look is layered: this level at this event, then the level, then the
   * event, each field falling through on its own. Above general admission the
   * accent also floods the band further and the level's chip is drawn on it,
   * so an AAA or artist pass is recognisable at a glance in a dark room.
   */
  // Read from the table rather than the retired enum, so a level renamed or
  // recoloured in admin shows on the next pass without a deploy.
  const level = await resolveLevel(ticket.accessLevel);
  const { design, chip } = resolveTicketPassDesign(
    parseEventPassDesign(event.passDesign),
    level,
  );

  /**
   * On a pass with a chip, the band carries the event name too.
   *
   * Wallet draws a primary field across the whole width of the strip, so the
   * longer the name the further it runs under the chip — "Summer Series: Night
   * Two" and an AAA badge ended up on top of each other. The two only stay
   * apart if one thing lays them both out, so when there is a chip the name is
   * typeset into the artwork beside it and the primary field is left empty.
   * Everything else (most tickets, which are general admission) keeps Wallet's
   * own type, which scales with the reader's text size.
   *
   * A design can also leave the name off the front entirely, for a band photo
   * that already says it. Either way the back carries it in full.
   */
  const artwork = await getPassImages({
    theme: design,
    intensity: level.intensity,
    badge: chip,
    title: chip && design.showTitle ? event.name : null,
    stripImageId: design.stripImageId,
    logoImageId: design.logoImageId,
  });
  const nameOnFront = design.showTitle && !artwork.titleDrawn;

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

    foregroundColor: toPassRgb(design.foregroundHex),
    backgroundColor: toPassRgb(design.backgroundHex),
    labelColor: toPassRgb(design.labelHex),

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
      // Empty when the band already says it: this is the field Wallet would
      // draw over the chip, or over a photo that carries the name itself.
      primaryFields: nameOnFront
        ? [
            {
              key: "event",
              label: "EVENT",
              value: event.name,
            },
          ]
        : [],
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
        // Deliberately no tier field. A tier is a product — a name and a price
        // set when the event was built — and it contradicts the pass as often
        // as it explains it: an AAA sold on a tier called "General Admission"
        // read as general admission. What a ticket gets you past is the only
        // thing a door acts on, so that is what the pass states.
        { key: "access", label: "ACCESS", value: level.label },
        ...(ticket.attendeeName
          ? [{ key: "name", label: "NAME", value: ticket.attendeeName }]
          : []),
      ],
      backFields: [
        // The name is artwork on the front of these, or not there at all, so
        // the back carries it as text — in full, and reachable by a screen
        // reader.
        ...(nameOnFront
          ? []
          : [{ key: "eventName", label: "Event", value: event.name }]),
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
            `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/legal/ticket-terms`,
        },
      ],
    },
  };

  const pass = new PKPass(
    {
      ...artwork.files,
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
    message: buildTicketQrPayload(ticket, event.slug),
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
