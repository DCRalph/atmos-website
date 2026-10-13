import "server-only";

import { GigScheduleKind, type Prisma } from "~Prisma/client";

/**
 * What a pass needs from the event beyond its own row: the linked gig's
 * poster, which a poster or blur layout borrows when the event has none of its
 * own, and its sets, which become the line-up on the back. Every route that
 * builds a pass loads the event with this, so they cannot disagree about what
 * is on it.
 */
export const PASS_EVENT_INCLUDE = {
  gig: {
    select: {
      posterFileUploadId: true,
      scheduleItems: {
        where: { kind: GigScheduleKind.SET },
        select: {
          label: true,
          startsAt: true,
          sortOrder: true,
          artists: {
            orderBy: { sortOrder: "asc" },
            select: { artistProfile: { select: { displayName: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.TicketEventInclude;
