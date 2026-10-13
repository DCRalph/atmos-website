import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { PKPass } from "passkit-generator";

import { env } from "~/env";
import { buildTicketQrPayload } from "~/server/ticketing/qr";
import { buildTicketAccessToken } from "~/server/ticketing/numbering";
import { termsUrl, ticketUrl } from "~/server/ticketing/urls";
import { formatEventDateLong, formatEventTime } from "~/lib/ticketing/dates";
import { resolveLevel } from "~/server/ticketing/access-level-store";
import { toPassRgb, type PassLayout } from "~/lib/ticketing/pass-theme";
import {
  guideLinksOf,
  parseEventPassDesign,
  resolveTicketPassDesign,
} from "~/lib/ticketing/pass-design";
import {
  lineupFromRunSheet,
  type RunSheetSet,
} from "~/lib/ticketing/pass-lineup";
import { getAppleWalletConfig } from "./apple-config";
import { getPassImages } from "./pass-images";

/**
 * Apple Wallet passes.
 *
 * `webServiceURL` is set from the start so passes stay updatable — a changed
 * door time or a cancelled event can be pushed to a phone that is already
 * holding the ticket. Passes issued without it are frozen forever, and
 * retrofitting means re-issuing every ticket.
 *
 * The look comes from the event's design (see `~/lib/ticketing/pass-design.ts`)
 * in one of three layouts: the band, the poster blurred behind the pass, or
 * the iOS 18 poster ticket. Everything the design does not decide, the event
 * and the gig's run sheet fill in: the line-up and set times on the back, the
 * directions link from the address, the live activity from the end time.
 */

export type PassTicket = {
  id: string;
  ticketNumber: string;
  qrVersion: number;
  qrSecret: string;
  /** With the id, rebuilds the holder's own ticket link for Transfer and Manage. */
  accessTokenVersion: number;
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
  endsAt: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  isR18: boolean;
  reentryAllowed: boolean;
  status: string;
  /** The stored JSON, parsed here. See `~/lib/ticketing/pass-design.ts`. */
  passDesign: unknown;
  /** Loaded with `PASS_EVENT_INCLUDE`; absent on a pass built without a gig. */
  gig?: {
    posterFileUploadId: string | null;
    scheduleItems: RunSheetSet[];
  } | null;
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

/** Directions to the venue, which Wallet turns into a guide button. */
export function directionsUrl(event: {
  venueAddress: string | null;
}): string | null {
  return event.venueAddress
    ? `https://maps.apple.com/?daddr=${encodeURIComponent(event.venueAddress)}`
    : null;
}

/** A live activity can span at most a day, so a festival ends at doors + 24h. */
const MAX_RELEVANT_INTERVAL_MS = 24 * 60 * 60 * 1000;

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
   * event, then the gig's poster, each field falling through on its own.
   * Above general admission the accent also floods the band further and the
   * level's chip is drawn on it, so an AAA or artist pass is recognisable at a
   * glance in a dark room.
   */
  // Read from the table rather than the retired enum, so a level renamed or
  // recoloured in admin shows on the next pass without a deploy.
  const level = await resolveLevel(ticket.accessLevel);
  const { design, chip } = resolveTicketPassDesign(
    parseEventPassDesign(event.passDesign),
    level,
    event.gig?.posterFileUploadId
      ? { posterImageId: event.gig.posterFileUploadId }
      : {},
  );
  const lineup = lineupFromRunSheet(event.gig?.scheduleItems ?? []);

  /**
   * On a band with a chip, the band carries the event name too.
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
   * that already says it. Either way the back carries it in full. The poster
   * and blur layouts have no chip, so on those the name is always a field.
   */
  const artwork = await getPassImages({
    theme: design,
    intensity: level.intensity,
    badge: chip,
    title: chip && design.showTitle ? event.name : null,
    stripImageId: design.stripImageId,
    logoImageId: design.logoImageId,
    layout: design.layout,
    posterImageId: design.posterImageId,
  });
  // What was actually built, which is the band whenever the poster could not
  // be loaded, so the pass never claims artwork it does not carry.
  const layout: PassLayout = artwork.posterDrawn ? design.layout : "BAND";
  const poster = layout === "POSTER";
  const nameOnFront =
    layout !== "BAND" || (design.showTitle && !artwork.titleDrawn);

  const doors = event.doorsAt ?? event.startsAt;
  const time = (date: Date) => formatEventTime(date, event.timezone);
  const manageUrl = ticketUrl(
    buildTicketAccessToken(ticket.id, ticket.accessTokenVersion),
  );
  const directions = directionsUrl(event);
  const guide = guideLinksOf(design);
  const contact = [design.venuePhone, design.venueEmail, design.venueWebsite]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  // Wallet notifies the holder when a field with a message changes, which is
  // exactly the moment a moved door time should reach a phone.
  const changed = (message: string) =>
    design.notifyChanges ? { changeMessage: message } : {};

  const firstSet = lineup.sets.find((set) => set.startsAt !== null);
  const timedSets = lineup.sets.filter(
    (set): set is { name: string; startsAt: Date } => set.startsAt !== null,
  );

  // From doors to the end of the night is a live activity on iOS 18; without
  // an end time the pass surfaces at doors as it always has.
  const end =
    event.endsAt && event.endsAt.getTime() > doors.getTime()
      ? new Date(
          Math.min(
            event.endsAt.getTime(),
            doors.getTime() + MAX_RELEVANT_INTERVAL_MS,
          ),
        )
      : null;

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
    // Two keys for one word: Wallet reads `logoText` on the band and blur
    // layouts and `eventLogoText` on a poster.
    ...(design.logoText
      ? { logoText: design.logoText, eventLogoText: design.logoText }
      : {}),

    // Tickets from one order stack as one card.
    groupingIdentifier: orderNumber,
    // The first scan wins, so a pass handed around is a pass that lets
    // nobody in. Off removes Wallet's Share button; the link still works.
    ...(design.allowSharing ? {} : { sharingProhibited: true }),

    // Lets the pass surface itself on the lock screen near the venue and time.
    // `relevantDate` for phones before iOS 18, `relevantDates` for the rest.
    relevantDate: doors.toISOString(),
    relevantDates: [
      end
        ? { startDate: doors.toISOString(), endDate: end.toISOString() }
        : { date: doors.toISOString(), relevantDate: doors.toISOString() },
    ],
    ...(design.venueLocation
      ? {
          locations: [
            {
              latitude: design.venueLocation.latitude,
              longitude: design.venueLocation.longitude,
              relevantText: event.venueName
                ? `${event.name} at ${event.venueName}`
                : event.name,
            },
          ],
          maxDistance: design.venueLocation.radiusM,
        }
      : {}),
    expirationDate: new Date(
      event.startsAt.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString(),

    // Apple appends `/v1/devices/...` itself, so this is the base only.
    webServiceURL: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/wallet/apple`,
    authenticationToken: applePassAuthToken(ticket.id),
    ...(env.APPLE_APP_STORE_ID
      ? { associatedStoreIdentifiers: [Number(env.APPLE_APP_STORE_ID)] }
      : {}),

    // The iOS 18 poster ticket, which falls back to the band on anything
    // older. Wallet draws the event guide from the URLs and the menu's
    // Transfer from the ticket page; on the other layouts it ignores these
    // keys, and the same links go on the back instead.
    ...(poster
      ? { preferredStyleSchemes: ["posterEventTicket", "eventTicket"] }
      : {}),
    ...(poster && design.chinHex
      ? { footerBackgroundColor: toPassRgb(design.chinHex) }
      : {}),
    ...(poster && design.autoColours ? { useAutomaticColors: true } : {}),
    ...(poster && !design.headerShade ? { suppressHeaderDarkening: true } : {}),
    ...(directions ? { directionsInformationURL: directions } : {}),
    ...Object.fromEntries(guide.map((link) => [link.passKey, link.url])),
    ...(design.venuePhone
      ? { contactVenuePhoneNumber: design.venuePhone }
      : {}),
    ...(design.venueEmail ? { contactVenueEmail: design.venueEmail } : {}),
    ...(design.venueWebsite
      ? { contactVenueWebsite: design.venueWebsite }
      : {}),
    ...(design.transfer ? { transferURL: manageUrl } : {}),

    // What the pass means, for Siri, Focus and the poster layout, which
    // needs these to lay itself out.
    semantics: {
      eventType: "PKEventTypeLivePerformance",
      eventName: event.name,
      eventStartDate: event.startsAt.toISOString(),
      ...(event.endsAt ? { eventEndDate: event.endsAt.toISOString() } : {}),
      venueDoorsOpenDate: doors.toISOString(),
      ...(event.venueName ? { venueName: event.venueName } : {}),
      ...(design.venueLocation
        ? {
            venueLocation: {
              latitude: design.venueLocation.latitude,
              longitude: design.venueLocation.longitude,
            },
          }
        : {}),
      ...(lineup.performers.length > 0
        ? { performerNames: lineup.performers }
        : {}),
      admissionLevel: level.label,
      admissionLevelAbbreviation: level.short,
      ...(ticket.attendeeName ? { attendeeName: ticket.attendeeName } : {}),
    },

    eventTicket: {
      headerFields: [
        {
          key: "doors",
          label: "DOORS",
          value: time(doors),
          ...changed("Doors now %@"),
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
          ...changed("Now on %@"),
        },
        ...(event.venueName
          ? [
              {
                key: "venue",
                label: "VENUE",
                value: event.venueName,
                ...changed("Venue is now %@"),
              },
            ]
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
        // A second row, only when the run sheet gives it something to say.
        ...(firstSet?.startsAt
          ? [
              {
                key: "firstSet",
                label: "FIRST SET",
                value: time(firstSet.startsAt),
                row: 1 as const,
              },
              {
                key: "reentry",
                label: "RE-ENTRY",
                value: event.reentryAllowed ? "Yes" : "No",
                row: 1 as const,
              },
            ]
          : []),
      ],
      // Wallet's data detectors are on for every back field, so the address
      // opens Maps and a phone number dials without being told to.
      backFields: [
        // The name is artwork on the front of these, or not there at all, so
        // the back carries it as text — in full, and reachable by a screen
        // reader.
        ...(nameOnFront
          ? []
          : [{ key: "eventName", label: "Event", value: event.name }]),
        ...(lineup.performers.length > 0
          ? [
              {
                key: "lineup",
                label: "Line-up",
                value: lineup.performers.join(" · "),
              },
            ]
          : []),
        ...(timedSets.length > 0
          ? [
              {
                key: "setTimes",
                label: "Set times",
                value: timedSets
                  .map((set) => `${set.name} ${time(set.startsAt)}`)
                  .join(" · "),
              },
            ]
          : []),
        ...(event.venueAddress
          ? [{ key: "address", label: "Address", value: event.venueAddress }]
          : []),
        ...design.backRows.map((row, index) => ({
          key: `custom${index}`,
          label: row.label,
          value: row.value,
        })),
        ...(poster
          ? []
          : guide.map((link) => ({
              key: link.key,
              label: link.label,
              value: link.url,
            }))),
        ...(!poster && contact
          ? [{ key: "venueContact", label: "Venue", value: contact }]
          : []),
        {
          key: "ticketNumber",
          label: "Ticket number",
          value: ticket.ticketNumber,
        },
        { key: "order", label: "Order", value: orderNumber },
        {
          key: "manage",
          label: "Manage",
          value: manageUrl,
          attributedValue: `<a href="${manageUrl}">Manage this ticket</a>`,
        },
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
            termsUrl(),
          attributedValue:
            "One entry per ticket. The first scan is the one that gets in. " +
            `<a href="${termsUrl()}">Full terms</a>`,
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
