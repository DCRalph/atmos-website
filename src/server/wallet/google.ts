import "server-only";

import { SignJWT, importPKCS8 } from "jose";

import { env } from "~/env";
import { buildTicketQrPayload } from "~/server/ticketing/qr";
import { resolveLevel } from "~/server/ticketing/access-level-store";
import { buildMediaUrl } from "~/lib/media-url";
import {
  guideLinksOf,
  parseEventPassDesign,
  resolveTicketPassDesign,
} from "~/lib/ticketing/pass-design";
import { lineupFromRunSheet } from "~/lib/ticketing/pass-lineup";
import { formatEventTime } from "~/lib/ticketing/dates";
import { getGoogleWalletConfig } from "./google-config";
import type { PassEvent, PassTicket } from "./apple";

/**
 * Google Wallet save links.
 *
 * Uses the "full JWT" form, where the class and object definitions travel
 * inside the signed token rather than being pre-created through the Wallet
 * REST API. That removes an entire OAuth code path and means a new event
 * needs no provisioning step — the trade-off is a longer URL, which is fine
 * for one ticket at a time.
 *
 * The design is the one the Apple pass uses: its guide links become the links
 * module, its custom back rows text modules, and its poster the hero image.
 */

const SAVE_URL = "https://pay.google.com/gp/v/save/";

function classId(issuerId: string, eventId: string): string {
  return `${issuerId}.event-${eventId}`;
}

function objectId(issuerId: string, ticketId: string): string {
  return `${issuerId}.ticket-${ticketId}`;
}

export async function buildGoogleWalletSaveUrl({
  ticket,
  event,
  orderNumber,
}: {
  ticket: PassTicket;
  event: PassEvent;
  orderNumber: string;
}): Promise<string | null> {
  const config = getGoogleWalletConfig();
  if (!config) return null;

  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const level = await resolveLevel(ticket.accessLevel);
  const { design } = resolveTicketPassDesign(
    parseEventPassDesign(event.passDesign),
    level,
    event.gig?.posterFileUploadId
      ? { posterImageId: event.gig.posterFileUploadId }
      : {},
  );
  const lineup = lineupFromRunSheet(event.gig?.scheduleItems ?? []);
  const timedSets = lineup.sets.filter(
    (set): set is { name: string; startsAt: Date } => set.startsAt !== null,
  );
  const guide = guideLinksOf(design);

  const eventTicketClass = {
    id: classId(config.issuerId, event.id),
    issuerName: "Atmos Media",
    reviewStatus: "UNDER_REVIEW",
    eventName: { defaultValue: { language: "en-NZ", value: event.name } },
    ...(event.venueName
      ? {
          venue: {
            name: {
              defaultValue: { language: "en-NZ", value: event.venueName },
            },
            address: {
              defaultValue: {
                language: "en-NZ",
                value: event.venueAddress ?? event.venueName,
              },
            },
          },
        }
      : {}),
    dateTime: {
      // Google renders these in the event's own zone when given an offset.
      doorsOpen: (event.doorsAt ?? event.startsAt).toISOString(),
      start: event.startsAt.toISOString(),
    },
    hexBackgroundColor: design.backgroundHex.toLowerCase(),
    homepageUri: {
      uri: `${appUrl}/events`,
      description: "Atmos Media",
    },
    // The poster, on the layouts built from one. Google fetches it from the
    // media route, which redirects to the public file.
    ...(design.layout !== "BAND" && design.posterImageId
      ? {
          heroImage: {
            sourceUri: { uri: buildMediaUrl(design.posterImageId) },
            contentDescription: {
              defaultValue: { language: "en-NZ", value: event.name },
            },
          },
        }
      : {}),
  };

  const eventTicketObject = {
    id: objectId(config.issuerId, ticket.id),
    classId: classId(config.issuerId, event.id),
    state: event.status === "CANCELLED" ? "INACTIVE" : "ACTIVE",
    ticketNumber: ticket.ticketNumber,
    // The level, not the tier — same reasoning as the Apple pass. A tier is a
    // product name chosen when the event was built and contradicts the ticket
    // as often as it describes it; what it gets you past is what a door acts
    // on. The tier stays below as a detail.
    ticketType: {
      defaultValue: {
        language: "en-NZ",
        value: level.label,
      },
    },
    ...(ticket.tier?.name
      ? {
          textModulesData: [
            { id: "tier", header: "Ticket", body: ticket.tier.name },
          ],
        }
      : {}),
    ...(ticket.attendeeName
      ? {
          ticketHolderName: ticket.attendeeName,
        }
      : {}),
    barcode: {
      type: "QR_CODE",
      value: buildTicketQrPayload(ticket, event.slug),
      alternateText: ticket.ticketNumber,
    },
    textModulesData: [
      ...(lineup.performers.length > 0
        ? [
            {
              id: "lineup",
              header: "Line-up",
              body: lineup.performers.join(" · "),
            },
          ]
        : []),
      ...(timedSets.length > 0
        ? [
            {
              id: "setTimes",
              header: "Set times",
              body: timedSets
                .map(
                  (set) =>
                    `${set.name} ${formatEventTime(set.startsAt, event.timezone)}`,
                )
                .join(" · "),
            },
          ]
        : []),
      ...design.backRows.map((row, index) => ({
        id: `custom${index}`,
        header: row.label,
        body: row.value,
      })),
      {
        id: "order",
        header: "Order",
        body: orderNumber,
      },
      ...(event.isR18
        ? [
            {
              id: "r18",
              header: "R18",
              body: "Bring photo ID — you will not get in without it.",
            },
          ]
        : []),
    ],
    linksModuleData: {
      uris: [
        ...(event.venueAddress
          ? [
              {
                uri: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.venueAddress)}`,
                description: "Directions",
                id: "directions",
              },
            ]
          : []),
        ...guide.map((link) => ({
          uri: link.url,
          description: link.label,
          id: link.key,
        })),
        ...(design.venueWebsite
          ? [
              {
                uri: design.venueWebsite,
                description: "Venue",
                id: "venue",
              },
            ]
          : []),
        {
          uri: `${appUrl}/legal/ticket-terms`,
          description: "Ticket terms",
          id: "terms",
        },
      ],
    },
  };

  const privateKey = await importPKCS8(config.privateKey, "RS256");

  const jwt = await new SignJWT({
    iss: config.clientEmail,
    aud: "google",
    typ: "savetowallet",
    origins: [appUrl],
    payload: {
      eventTicketClasses: [eventTicketClass],
      eventTicketObjects: [eventTicketObject],
    },
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .sign(privateKey);

  return `${SAVE_URL}${jwt}`;
}
