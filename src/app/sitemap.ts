import { type MetadataRoute } from "next";
import { db } from "~/server/db";
import { SITE_URL } from "~/lib/seo-constants";
import { gigPath } from "~/lib/gig-url";
import {
  GigStatus,
  TicketEventStatus,
  TicketEventVisibility,
} from "~Prisma/client";

/** Rebuilt hourly, so new gigs and events show up without a deploy. */
export const revalidate = 3600;

/**
 * Public pages only. Ticket, pass, receipt, donate and photo signup pages are
 * reached by a link somebody was sent, and are noindex. Static pages carry no
 * `lastModified`: the build time would be a guess, and a sitemap whose dates
 * are always "now" teaches crawlers to ignore its dates.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/gigs`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/events`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/crew`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/content`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/merch`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/socials`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/equipment`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/legal/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/ticket-terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/donation-terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/kaupapa`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Dynamic gig pages
  let gigPages: MetadataRoute.Sitemap = [];
  try {
    const gigs = await db.gig.findMany({
      // Drafts are not on the site, so they are not in the sitemap either.
      // Nor is an affiliated gig: it is on the site for a night and then gone,
      // and a crawler that indexed it would outlive it.
      where: {
        status: GigStatus.PUBLISHED,
        isAffiliated: false,
        // Noindex until announced, and its URL changes when it is.
        isTba: false,
      },
      select: {
        id: true,
        slug: true,
        isTba: true,
        updatedAt: true,
        gigStartTime: true,
      },
      orderBy: {
        gigStartTime: "desc",
      },
    });

    gigPages = gigs.map((gig) => ({
      url: `${SITE_URL}${gigPath(gig)}`,
      lastModified: gig.updatedAt,
      changeFrequency: "weekly" as const,
      // Upcoming events get higher priority.
      priority: gig.gigStartTime > new Date() ? 0.9 : 0.6,
    }));
  } catch (error) {
    // If database is unavailable, continue with static pages only
    console.error("Failed to fetch gigs for sitemap:", error);
  }

  // Ticket pages for events still to come, as listed on /events. Unlisted and
  // private events are noindex, so they stay out.
  let eventPages: MetadataRoute.Sitemap = [];
  try {
    const events = await db.ticketEvent.findMany({
      where: {
        status: {
          in: [
            TicketEventStatus.PUBLISHED,
            TicketEventStatus.SALES_PAUSED,
            TicketEventStatus.SOLD_OUT,
          ],
        },
        visibility: TicketEventVisibility.PUBLIC,
        startsAt: { gte: new Date() },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { startsAt: "asc" },
    });

    eventPages = events.map((event) => ({
      url: `${SITE_URL}/events/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.9,
    }));
  } catch (error) {
    console.error("Failed to fetch ticket events for sitemap:", error);
  }

  let artistPages: MetadataRoute.Sitemap = [];
  try {
    const profiles = await db.artistProfile.findMany({
      where: { isPublished: true },
      select: { handle: true, updatedAt: true },
      orderBy: { handle: "asc" },
    });
    artistPages = profiles.map((profile) => ({
      url: `${SITE_URL}/artist/${profile.handle}`,
      lastModified: profile.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  } catch (error) {
    console.error("Failed to fetch artist profiles for sitemap:", error);
  }

  let merchPages: MetadataRoute.Sitemap = [];
  try {
    const products = await db.shopifyProductCache.findMany({
      select: { handle: true, syncedAt: true },
      orderBy: { sortOrder: "asc" },
    });
    merchPages = products.map((product) => ({
      url: `${SITE_URL}/merch/${encodeURIComponent(product.handle)}`,
      lastModified: product.syncedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  } catch (error) {
    console.error("Failed to fetch merch products for sitemap:", error);
  }

  return [
    ...staticPages,
    ...eventPages,
    ...gigPages,
    ...artistPages,
    ...merchPages,
  ];
}
