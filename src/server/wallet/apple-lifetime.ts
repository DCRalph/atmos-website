import "server-only";

import { PKPass } from "passkit-generator";

import { env } from "~/env";
import { LifetimeTicketStatus } from "~Prisma/client";
import { buildLifetimeQrPayload } from "~/server/ticketing/qr";
import { resolveLevel } from "~/server/ticketing/access-level-store";
import { LIFETIME_PASS_THEME, toPassRgb } from "~/lib/ticketing/pass-theme";
import { applePassAuthToken } from "./apple";
import { getAppleWalletConfig } from "./apple-config";
import { getPassImages } from "./pass-images";

/**
 * The Apple Wallet pass for a lifetime pass.
 *
 * Deliberately not `buildApplePass` with a fake event. An event ticket is
 * about a night — its band is the event's own design, its fields are the date
 * and the doors, and it expires the morning after. This is about a person,
 * for as long as the pass stands: the band carries their name in the house
 * gold rather than an event's colours, the fields say what it gets them past
 * and how long they have had it, and it never expires unless it is revoked.
 *
 * Same signing, same web service, same artwork pipeline. A pass in a wallet
 * next to an event ticket should read as the same brand and a different kind
 * of object, and that is exactly the split.
 */

/**
 * Wallet serial numbers share one web service with event tickets, so a
 * lifetime pass's serial is namespaced to say which table it lives in.
 */
const LIFETIME_SERIAL_PREFIX = "lifetime.";

export function lifetimeSerial(lifetimeId: string): string {
  return `${LIFETIME_SERIAL_PREFIX}${lifetimeId}`;
}

/** The pass id behind a serial, or null when the serial is a ticket's. */
export function lifetimeIdFromSerial(serialNumber: string): string | null {
  return serialNumber.startsWith(LIFETIME_SERIAL_PREFIX)
    ? serialNumber.slice(LIFETIME_SERIAL_PREFIX.length)
    : null;
}

export type PassLifetime = {
  id: string;
  number: string;
  holderName: string;
  accessLevel: string;
  status: LifetimeTicketStatus;
  createdAt: Date;
  qrVersion: number;
  qrSecret: string;
};

export async function buildLifetimePass({
  lifetime,
}: {
  lifetime: PassLifetime;
}): Promise<Buffer> {
  const config = getAppleWalletConfig();
  const theme = LIFETIME_PASS_THEME;
  const level = await resolveLevel(lifetime.accessLevel);
  const serialNumber = lifetimeSerial(lifetime.id);
  const revoked = lifetime.status === LifetimeTicketStatus.REVOKED;

  // Always chipped, general admission included: on an event ticket the level
  // only announces itself when it is worth more than the standard one, but a
  // lifetime pass has no standard to be measured against, so it always says
  // what it gets past. Dark chip, level-coloured type, as on a ticket.
  const badge = {
    text: level.short,
    background: theme.backgroundHex,
    foreground: level.passAccent ?? theme.accentHex,
  };

  // The holder's name is the title on the band, under a label that says what
  // this is. Falls back to a Wallet primary field if the artwork cannot carry
  // it, exactly as an event name does.
  const artwork = await getPassImages(
    theme,
    1,
    badge,
    lifetime.holderName,
    "LIFETIME PASS",
  );

  const since = lifetime.createdAt.toLocaleDateString("en-NZ", {
    month: "short",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  });

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    serialNumber,
    organizationName: "Atmos Media",
    description: `Atmos lifetime pass — ${lifetime.holderName}`,

    foregroundColor: toPassRgb(theme.foregroundHex),
    backgroundColor: toPassRgb(theme.backgroundHex),
    labelColor: toPassRgb(theme.labelHex),

    // Wallet greys a voided pass out and stops showing it on the lock screen,
    // which is the right answer for a pass somebody has had taken away.
    ...(revoked ? { voided: true } : {}),

    webServiceURL: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/wallet/apple`,
    authenticationToken: applePassAuthToken(serialNumber),

    eventTicket: {
      headerFields: [{ key: "number", label: "PASS", value: lifetime.number }],
      primaryFields: artwork.titleDrawn
        ? []
        : [
            {
              key: "holder",
              label: "LIFETIME PASS",
              value: lifetime.holderName,
            },
          ],
      secondaryFields: [
        { key: "access", label: "ACCESS", value: level.label },
        { key: "since", label: "SINCE", value: since },
      ],
      auxiliaryFields: [
        {
          key: "valid",
          label: "VALID AT",
          value: revoked ? "Revoked" : "Every Atmos event",
        },
      ],
      backFields: [
        { key: "holderName", label: "Holder", value: lifetime.holderName },
        { key: "number", label: "Pass number", value: lifetime.number },
        { key: "accessLevel", label: "Access", value: level.label },
        ...(revoked
          ? [
              {
                key: "revoked",
                label: "Revoked",
                value:
                  "This pass has been revoked and no longer admits anyone.",
              },
            ]
          : []),
        {
          key: "terms",
          label: "Terms",
          value:
            "Admits the named holder to any Atmos event, once per event, with re-entry where the event allows it. " +
            "Not transferable — the door may ask for photo ID. Full terms: " +
            `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/tickets/terms`,
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
    message: buildLifetimeQrPayload(lifetime),
    messageEncoding: "iso-8859-1",
    altText: lifetime.number,
  });

  if (revoked) {
    pass.setExpirationDate(new Date());
  }

  return pass.getAsBuffer();
}
