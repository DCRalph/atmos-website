import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ActivityType, Prisma, type PrismaClient } from "~Prisma/client";
import { env } from "~/env";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  assertSlugFree,
  readLinkInput,
} from "~/server/api/routers/short-links";
import {
  BOUGHT_ORDER,
  ONLINE_ORDER,
  VISIT,
} from "~/server/ticketing/order-sql";
import { logActivity } from "~/server/utils/activity-log";
import { campaignUrl, normaliseTag } from "~/lib/ticketing/campaigns";
import { destinationProblem } from "~/lib/short-links/rules";
import { SITE_LINK_DOMAIN } from "~/lib/short-links/domains";

/**
 * Campaigns: tagged links, what each cost, and what each sold. An event's
 * campaigns are made on its Campaigns tab and their spend counts toward its
 * costs; the Campaigns page lists every one and makes links for anything.
 */

const campaignInputSchema = z.object({
  source: z.string().max(64),
  medium: z.string().max(64),
  name: z.string().max(64),
  content: z.string().max(64),
  /** Blank on an event's campaign means the event page. */
  destination: z.string().max(2000),
  spendCents: z.number().int().min(0).max(100_000_000),
});

type CampaignInput = z.infer<typeof campaignInputSchema>;

/** The input normalised and checked, or a BAD_REQUEST naming what's wrong. */
async function readCampaignInput(
  db: PrismaClient,
  eventId: string | null,
  input: CampaignInput,
  exceptId?: string,
) {
  const tags = {
    source: normaliseTag(input.source),
    medium: normaliseTag(input.medium) || null,
    name: normaliseTag(input.name),
    content: normaliseTag(input.content) || null,
  };
  if (!tags.source || !tags.name) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A campaign needs a name and where it runs.",
    });
  }

  let destination = input.destination.trim();
  if (!destination && eventId) {
    const event = await db.ticketEvent.findUnique({
      where: { id: eventId },
      select: { slug: true },
    });
    if (!event) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
    }
    destination = `/events/${event.slug}`;
  }
  const problem = destinationProblem(destination);
  if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });

  // Two campaigns with the same tags would both claim the same orders.
  const clash = await db.campaign.findFirst({
    where: {
      eventId,
      ...tags,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "A campaign with those exact tags already exists here.",
    });
  }

  return { ...tags, destination, spendCents: input.spendCents };
}

type CampaignResult = {
  checkouts: number;
  paid: number;
  revenueCents: number;
};

const NO_RESULTS: CampaignResult = { checkouts: 0, paid: 0, revenueCents: 0 };

/**
 * What each campaign sold: online orders carrying exactly its tags, on its
 * event, or on any event for a campaign without one. Checkouts and paid count
 * visits, so changing a basket doesn't count twice.
 */
async function campaignResults(db: PrismaClient, ids: string[]) {
  if (ids.length === 0) return new Map<string, CampaignResult>();
  const rows = await db.$queryRaw<(CampaignResult & { id: string })[]>`
    SELECT
      c.id,
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
      AND ${ONLINE_ORDER}
    WHERE c.id IN (${Prisma.join(ids)})
    GROUP BY c.id
  `;
  return new Map(rows.map((row) => [row.id, row]));
}

export const campaignsRouter = createTRPCRouter({
  /**
   * One event's campaigns, or with no `eventId` every campaign there is,
   * newest first, each with its link and what it sold.
   */
  list: adminProcedure
    .input(z.object({ eventId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const campaigns = await ctx.db.campaign.findMany({
        where: input.eventId ? { eventId: input.eventId } : {},
        orderBy: { createdAt: "desc" },
        include: {
          event: { select: { id: true, name: true } },
          shortLink: { select: { id: true, domain: true, slug: true } },
        },
      });
      const results = await campaignResults(
        ctx.db,
        campaigns.map((campaign) => campaign.id),
      );
      return campaigns.map((campaign) => ({
        ...campaign,
        url: campaignUrl(
          env.NEXT_PUBLIC_APP_URL,
          campaign.destination,
          campaign,
        ),
        results: results.get(campaign.id) ?? NO_RESULTS,
      }));
    }),

  create: adminProcedure
    .input(campaignInputSchema.extend({ eventId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const values = await readCampaignInput(ctx.db, input.eventId, input);
      const created = await ctx.db.campaign.create({
        data: {
          ...values,
          eventId: input.eventId,
          createdBy: ctx.session.user.id,
        },
      });
      await logActivity({
        type: input.eventId
          ? ActivityType.TICKET_EVENT_UPDATED
          : ActivityType.SHORT_LINK_CREATED,
        action: `Created campaign ${created.source}/${created.name}`,
        userId: ctx.session.user.id,
        details: { campaignId: created.id, eventId: created.eventId },
      });
      return created;
    }),

  update: adminProcedure
    .input(campaignInputSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.campaign.findUnique({
        where: { id: input.id },
        select: { eventId: true, shortLinkId: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      }
      const values = await readCampaignInput(
        ctx.db,
        existing.eventId,
        input,
        input.id,
      );
      // Its short link follows, or a printed code would carry the old tags.
      return ctx.db.$transaction(async (tx) => {
        if (existing.shortLinkId) {
          await tx.shortLink.update({
            where: { id: existing.shortLinkId },
            data: {
              destination: campaignUrl(
                env.NEXT_PUBLIC_APP_URL,
                values.destination,
                values,
              ),
            },
          });
        }
        return tx.campaign.update({ where: { id: input.id }, data: values });
      });
    }),

  /** The campaign goes; its short link stays, since it may be printed. */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.campaign.delete({ where: { id: input.id } });
    }),

  /**
   * A short link to the campaign's tagged URL, for posters and anywhere a
   * long link won't do. Its page has the QR codes and the click counts.
   */
  createShortLink: adminProcedure
    .input(z.object({ id: z.string(), slug: z.string().max(200) }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.id },
      });
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      }
      if (campaign.shortLinkId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This campaign already has a short link.",
        });
      }

      const values = await readLinkInput({
        domain: SITE_LINK_DOMAIN,
        slug: input.slug,
        destination: campaignUrl(
          env.NEXT_PUBLIC_APP_URL,
          campaign.destination,
          campaign,
        ),
        label: `Campaign: ${campaign.source} / ${campaign.name}`.slice(0, 120),
        active: true,
      });
      await assertSlugFree(values.domain, values.slug);

      const link = await ctx.db.shortLink.create({
        data: {
          ...values,
          createdBy: ctx.session.user.id,
          campaign: { connect: { id: campaign.id } },
        },
      });
      await logActivity({
        type: ActivityType.SHORT_LINK_CREATED,
        action: `Created campaign link ${link.domain}/${link.slug}`,
        userId: ctx.session.user.id,
        details: { linkId: link.id, campaignId: campaign.id },
      });
      return link;
    }),
});
