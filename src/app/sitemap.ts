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
 * reached by a link somebody was sent, and are noindex.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/gigs`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/events`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/crew`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/content`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/merch`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/socials`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/equipment`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/legal/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/ticket-terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/kaupapa`,
      lastModified: new Date(),
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
      },
      select: {
        id: true,
        title: true,
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
      // Upcoming events get higher priority. A TBA gig is always upcoming, and
      // its real date must not decide.
      priority: gig.isTba || gig.gigStartTime > new Date() ? 0.9 : 0.6,
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

  return [...staticPages, ...eventPages, ...gigPages];
}
