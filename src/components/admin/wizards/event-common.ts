import type { RouterOutputs } from "~/trpc/react";
import { formatEventDate } from "~/lib/ticketing/dates";

export type AdminEvent = RouterOutputs["ticketEvents"]["byId"];

/** "Late Bloom · Fri 19 Dec", the subtitle every event wizard wears. */
export const eventLabel = (event: {
  name: string;
  startsAt: Date;
  timezone?: string;
}) => `${event.name} · ${formatEventDate(event.startsAt, event.timezone)}`;

/** The full event page, from a wizard's header. */
export const eventEditorHref = (eventId: string) => `/admin/events/${eventId}`;
