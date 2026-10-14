import { Prisma } from "~Prisma/client";

import { BOUGHT_ORDER, ONLINE_ORDER, VISIT } from "./order-sql";

/**
 * What each campaign did, as a funnel. Shared by the Campaigns pages and the
 * cross-event analytics so a campaign's numbers are the same everywhere.
 */

export type CampaignResult = {
  /** Clicks on its short link, less bots. Null for a campaign without one. */
  clicks: number | null;
  /** Visits to an event page that arrived carrying its tags. */
  views: number;
  checkouts: number;
  paid: number;
  revenueCents: number;
};

export const NO_RESULTS: CampaignResult = {
  clicks: null,
  views: 0,
  checkouts: 0,
  paid: 0,
  revenueCents: 0,
};

/**
 * Online orders and page views carrying exactly a campaign's tags, on its
 * event, or on any event for a campaign without one; clicks from its short
 * link. Checkouts and paid count visits, so changing a basket doesn't count
 * twice. A campaign with dates counts only what happened between them.
 */
export async function campaignResults(
  db: Prisma.TransactionClient,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, CampaignResult>();
  const rows = await db.$queryRaw<(CampaignResult & { id: string })[]>`
    SELECT
      c.id,
      CASE WHEN c."shortLinkId" IS NULL THEN NULL ELSE (
        SELECT COUNT(*)::int
        FROM "short_link_click" k
        WHERE k."linkId" = c."shortLinkId"
          AND k.device <> 'bot'
          AND (c."startsAt" IS NULL OR k."createdAt" >= c."startsAt")
          AND (c."endsAt" IS NULL OR k."createdAt" <= c."endsAt")
      ) END AS clicks,
      (
        SELECT COUNT(*)::int
        FROM "ticket_event_view" v
        WHERE v."utmSource" = c.source
          AND v."utmCampaign" = c.name
          AND v."utmMedium" IS NOT DISTINCT FROM c.medium
          AND v."utmContent" IS NOT DISTINCT FROM c.content
          AND (c."eventId" IS NULL OR v."eventId" = c."eventId")
          AND (c."startsAt" IS NULL OR v."createdAt" >= c."startsAt")
          AND (c."endsAt" IS NULL OR v."createdAt" <= c."endsAt")
      ) AS views,
      COUNT(DISTINCT ${VISIT})::int AS checkouts,
      COUNT(DISTINCT ${VISIT}) FILTER (WHERE ${BOUGHT_ORDER})::int AS paid,
      COALESCE(SUM(o."totalCents" - o."refundedCents") FILTER (WHERE ${BOUGHT_ORDER}), 0)::int AS "revenueCents"
    FROM "campaign" c
    LEFT JOIN "ticket_order" o
      ON o."utmSource" = c.source
      AND o."utmCampaign" = c.name
      AND o."utmMedium" IS NOT DISTINCT FROM c.medium
      AND o."utmContent" IS NOT DISTINCT FROM c.content
      AND (c."eventId" IS NULL OR o."eventId" = c."eventId")
      AND (c."startsAt" IS NULL OR o."createdAt" >= c."startsAt")
      AND (c."endsAt" IS NULL OR o."createdAt" <= c."endsAt")
      AND ${ONLINE_ORDER}
    WHERE c.id IN (${Prisma.join(ids)})
    GROUP BY c.id
  `;
  return new Map(rows.map((row) => [row.id, row]));
}
