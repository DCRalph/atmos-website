import "server-only";

import { randomUUID } from "node:crypto";
import { PKPass } from "passkit-generator";

import { TicketStatus } from "~Prisma/client";
import { db } from "~/server/db";
import { DEFAULT_ACCESS_LEVEL } from "~/lib/ticketing/access-levels";
import {
  parseEventPassDesign,
  type EventPassDesign,
} from "~/lib/ticketing/pass-design";
import {
  applyPatch,
  fieldsOf,
  isJsonObject,
  textOf,
  type JsonObject,
  type WalletPassDebugComposeResponse,
  type WalletPassDebugDraft,
  type WalletPassSource,
} from "~/lib/ticketing/wallet-pass-debug";
import { resolveLevel } from "~/server/ticketing/access-level-store";
import {
  composeApplePass,
  signApplePass,
  type ComposedPass,
  type PassEvent,
  type PassTicket,
} from "./apple";
import { getAppleWalletConfig, isAppleWalletConfigured } from "./apple-config";
import { PASS_EVENT_INCLUDE } from "./pass-event";

/**
 * The wallet debugger's passes.
 *
 * A draft names a source and the server turns it into a pass through the very
 * same `composeApplePass` a ticket goes through, so what the debugger shows is
 * what a holder would get. The draft's design goes on top as one more layer,
 * its patch of raw keys last, and the result is validated by the pass library
 * before anybody is offered a download.
 */

const MAX_ASSET_BYTES = 2_000_000;
const MAX_TOTAL_ASSET_BYTES = 10_000_000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A night a week from now at a venue that exists, for a draft with no event. */
function sampleEvent(now = new Date()): PassEvent {
  const startsAt = new Date(now.getTime() + 7 * DAY_MS);
  startsAt.setMinutes(0, 0, 0);
  return {
    id: "debug",
    slug: "debug",
    name: "Atmos test event",
    timezone: "Pacific/Auckland",
    startsAt,
    doorsAt: new Date(startsAt.getTime() - 30 * 60 * 1000),
    endsAt: new Date(startsAt.getTime() + 5 * 60 * 60 * 1000),
    venueName: "The Boat Shed",
    venueAddress: "12 Madden Street, Wynyard Quarter, Auckland 1010",
    isR18: true,
    reentryAllowed: false,
    status: "PUBLISHED",
    passDesign: null,
    gig: null,
  };
}

/** A ticket that exists nowhere: its QR scans to nothing and it never updates. */
function sampleTicket(level: string): PassTicket {
  return {
    id: `atmos.debug.${randomUUID()}`,
    ticketNumber: "ATN-DEBUG",
    qrVersion: 1,
    qrSecret: randomUUID(),
    accessTokenVersion: 1,
    attendeeName: "Test attendee",
    accessLevel: level,
    tier: { name: "Debug" },
  };
}

type LoadedSource = {
  ticket: PassTicket;
  event: PassEvent;
  orderNumber: string;
  /** A real ticket, whose pass registers for updates and whose QR admits. */
  real: boolean;
};

async function loadSource(source: WalletPassSource): Promise<LoadedSource> {
  switch (source.kind) {
    case "standalone":
      return {
        ticket: sampleTicket(source.level ?? DEFAULT_ACCESS_LEVEL),
        event: sampleEvent(),
        orderNumber: "ATM-DEBUG",
        real: false,
      };
    case "event": {
      const event = await db.ticketEvent.findUnique({
        where: { id: source.eventId },
        include: PASS_EVENT_INCLUDE,
      });
      if (!event) throw new Error("That event no longer exists.");
      return {
        ticket: sampleTicket(source.level ?? DEFAULT_ACCESS_LEVEL),
        event,
        orderNumber: "ATM-DEBUG",
        real: false,
      };
    }
    case "ticket": {
      const ticket = await db.ticket.findFirst({
        where: {
          ticketNumber: source.ticketNumber.trim().toUpperCase(),
          status: TicketStatus.VALID,
        },
        include: {
          tier: { select: { name: true } },
          event: { include: PASS_EVENT_INCLUDE },
          order: { select: { orderNumber: true } },
        },
      });
      if (!ticket) throw new Error("No valid ticket has that number.");
      return {
        ticket,
        event: ticket.event,
        orderNumber: ticket.order.orderNumber,
        real: true,
      };
    }
  }
}

function passStrings(translations: Record<string, string>): Buffer {
  const quote = (value: string) =>
    value
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')
      .replaceAll("\r", "")
      .replaceAll("\n", "\\n");

  return Buffer.from(
    Object.entries(translations)
      .map(([key, value]) => `"${quote(key)}" = "${quote(value)}";`)
      .join("\n"),
    "utf8",
  );
}

/** The draft's own files over the composed artwork, by name. */
function bundleFiles(
  draft: WalletPassDebugDraft,
  composed: Record<string, Buffer>,
): Record<string, Buffer> {
  const files = { ...composed };
  let assetBytes = 0;
  for (const asset of draft.assets) {
    const buffer = Buffer.from(asset.dataBase64, "base64");
    if (buffer.byteLength > MAX_ASSET_BYTES) {
      throw new Error(`${asset.fileName} is larger than 2 MB.`);
    }
    assetBytes += buffer.byteLength;
    files[asset.fileName] = buffer;
  }
  if (assetBytes > MAX_TOTAL_ASSET_BYTES) {
    throw new Error("Pass assets are larger than 10 MB in total.");
  }
  for (const localization of draft.localizations) {
    files[`${localization.language}.lproj/pass.strings`] = passStrings(
      localization.translations,
    );
  }
  if (draft.personalization) {
    files["personalization.json"] = Buffer.from(
      JSON.stringify(draft.personalization),
      "utf8",
    );
  }
  return files;
}

/**
 * What the pass library makes of the bundle, without signing it. Needs the
 * certificates to exist, which is why it is null where they do not.
 */
function validate(
  composed: ComposedPass,
): WalletPassDebugComposeResponse["validation"] {
  if (!isAppleWalletConfigured()) return null;
  try {
    const config = getAppleWalletConfig();
    const pass = new PKPass(
      {
        ...composed.files,
        "pass.json": Buffer.from(JSON.stringify(composed.passJson), "utf8"),
      },
      {
        wwdr: config.wwdr,
        signerCert: config.signerCert,
        signerKey: config.signerKey,
        signerKeyPassphrase: config.signerKeyPassphrase,
      },
    );
    pass.setBarcodes(composed.barcode);
    return { ok: true, keys: Object.keys(pass.props).length };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "The pass is not valid.",
    };
  }
}

export async function composeDebugPass(draft: WalletPassDebugDraft): Promise<{
  composed: ComposedPass;
  response: WalletPassDebugComposeResponse;
}> {
  const { ticket, event, orderNumber, real } = await loadSource(draft.source);
  const base = await composeApplePass({
    ticket,
    event,
    orderNumber,
    override: draft.design,
  });

  // A sample ticket exists nowhere, so a pass that asked our web service
  // about it would be told it is gone. A real ticket's pass stays registered.
  const passJson = JSON.parse(JSON.stringify(base.passJson)) as JsonObject;
  if (!real) {
    delete passJson.webServiceURL;
    delete passJson.authenticationToken;
  }

  const composed: ComposedPass = {
    passJson: applyPatch(passJson, draft.patch),
    files: bundleFiles(draft, base.files),
    barcode: base.barcode,
  };

  const level = await resolveLevel(ticket.accessLevel);
  const eventDesign: EventPassDesign = parseEventPassDesign(event.passDesign);

  return {
    composed,
    response: {
      manifest: composed.passJson as JsonObject,
      files: Object.entries(composed.files).map(([name, buffer]) => ({
        name,
        bytes: buffer.byteLength,
      })),
      validation: validate(composed),
      eventDesign,
      gig: event.gig?.posterFileUploadId
        ? { posterImageId: event.gig.posterFileUploadId }
        : {},
      level: {
        code: level.code,
        label: level.label,
        short: level.short,
        rank: level.rank,
        intensity: level.intensity,
        passDesign: level.passDesign,
      },
      context: {
        eventName: event.name,
        venueAddress: event.venueAddress,
        real,
      },
    },
  };
}

/** The draft, composed and signed. Refuses a bundle the library rejects. */
export async function buildDebugPass(draft: WalletPassDebugDraft): Promise<{
  buffer: Buffer;
  filename: string;
  passName: string;
}> {
  const { composed, response } = await composeDebugPass(draft);
  if (response.validation && !response.validation.ok) {
    throw new Error(response.validation.error);
  }
  const manifest = response.manifest;
  const primary = fieldsOf(manifest, "primaryFields")[0];
  const passName =
    [
      primary ? textOf(primary.value) : "",
      isJsonObject(manifest.semantics)
        ? textOf(manifest.semantics.eventName)
        : "",
      response.context.eventName,
    ].find((name) => name.length > 0) ?? "Apple Wallet test pass";
  const serial = textOf(manifest.serialNumber) || "standalone";
  return {
    buffer: await signApplePass(composed),
    filename: `${serial.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 80)}.pkpass`,
    passName,
  };
}
