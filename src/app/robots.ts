import { type MetadataRoute } from "next";
import { SITE_URL } from "~/lib/seo-constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Link preview images live under /api. Scrapers that honour robots.txt
        // (X, LinkedIn) skip a blocked og:image and show a card without one.
        allow: ["/", "/api/og/", "/api/gigs/*/teaser"],
        disallow: [
          "/admin",
          "/admin/*",
          "/dashboard",
          "/dashboard/*",
          "/api/*",
          "/auth-error",
          "/login",
          "/l",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
