import "server-only";

import type { Endpoint, HttpMethod } from "./endpoint";
import { eventEndpoints } from "./endpoints/events";
import { gigEndpoints } from "./endpoints/gigs";
import { notificationEndpoints } from "./endpoints/notifications";
import { orderEndpoints } from "./endpoints/orders";
import { statsEndpoints } from "./endpoints/stats";
import { updateEndpoints } from "./endpoints/updates";
import { venueEndpoints } from "./endpoints/venues";

/**
 * Every endpoint of the developer API, in the order the reference lists them.
 * The router serves exactly these and nothing else, so this list is also the
 * whole of what an API key can reach.
 */
export const ENDPOINTS: readonly Endpoint[] = [
  ...updateEndpoints,
  ...gigEndpoints,
  ...eventEndpoints,
  ...statsEndpoints,
  ...orderEndpoints,
  ...venueEndpoints,
  ...notificationEndpoints,
];

/** The reference's sections, in order, with a line for each. */
export const TAGS = [
  {
    name: "Basics",
    description: "Checking a key works, and what it can do.",
  },
  {
    name: "Gigs",
    description:
      "The nights on the site, drafts included. Writes go through the same checks as the admin's gig editor.",
  },
  {
    name: "Events",
    description:
      "Ticketed events and their tiers: what is on sale, when, and how. Money and people are in Sales and Orders.",
  },
  { name: "Sales", description: "How an event is selling, and its money." },
  { name: "Door", description: "Who is in, live on the night." },
  {
    name: "Orders",
    description:
      "Orders and their tickets. Buyer details need orders:sensitive.",
  },
  { name: "Venues", description: "Saved venues, for venueId." },
  { name: "Artists", description: "Artist profiles, for line-ups." },
  {
    name: "Updates",
    description:
      "A feed of what changed, to poll with a cursor instead of polling everything.",
  },
  {
    name: "Notifications",
    description: "Push notifications to topics, staff, or their handsets.",
  },
] as const;

type Compiled = { endpoint: Endpoint; pattern: RegExp; names: string[] };

const compiled: Compiled[] = ENDPOINTS.map((endpoint) => {
  const names: string[] = [];
  const source = endpoint.path.replace(/\{(\w+)\}/g, (_, name: string) => {
    names.push(name);
    return "([^/]+)";
  });
  return { endpoint, pattern: new RegExp(`^${source}$`), names };
});

export type Match =
  | { kind: "found"; endpoint: Endpoint; params: Record<string, string> }
  | { kind: "wrong_method"; allow: HttpMethod[] }
  | { kind: "none" };

/** The endpoint for a method and a path below `/api/v1`. */
export function matchEndpoint(method: string, path: string): Match {
  const allow: HttpMethod[] = [];
  for (const { endpoint, pattern, names } of compiled) {
    const found = pattern.exec(path);
    if (!found) continue;
    if (endpoint.method !== method) {
      allow.push(endpoint.method);
      continue;
    }
    const params = Object.fromEntries(
      names.map((name, index) => [
        name,
        decodeURIComponent(found[index + 1] ?? ""),
      ]),
    );
    return { kind: "found", endpoint, params };
  }
  return allow.length > 0 ? { kind: "wrong_method", allow } : { kind: "none" };
}
