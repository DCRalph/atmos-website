import { type MetadataRoute } from "next";
import { db } from "~/server/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://atmosmedia.co.nz";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/gigs`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/crew`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/content`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/merch`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/socials`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Dynamic gig pages
  let gigPages: MetadataRoute.Sitemap = [];
  try {
    const gigs = await db.gig.findMany({
      select: {
        id: true,
        updatedAt: true,
        gigStartTime: true,
      },
      orderBy: {
        gigStartTime: "desc",
      },
    });

    gigPages = gigs.map((gig) => ({
      url: `${siteUrl}/gigs/${gig.id}`,
      lastModified: gig.updatedAt,
      changeFrequency: "weekly" as const,
      // Upcoming events get higher priority
      priority: gig.gigStartTime > new Date() ? 0.9 : 0.6,
    }));
  } catch (error) {
    // If database is unavailable, continue with static pages only
    console.error("Failed to fetch gigs for sitemap:", error);
  }

  return [...staticPages, ...gigPages];
}
