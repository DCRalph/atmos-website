/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Extra hostnames allowed to load dev assets, for opening `next dev` via a
  // machine name instead of localhost. Comma-separated, e.g. DEV_ORIGINS=my-box.
  // The app reads the same list through `~/lib/dev-hosts`.
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(","),
  images: {
    // In dev, media URLs point at this same server (`/api/media` on
    // localhost), which Next 16 refuses to optimise by default. Production
    // media is on the public domain, so this stays off there.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.w-g.co",
      },
      {
        protocol: "https",
        hostname: "atmosmedia.co.nz",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      // Legacy bucket, until stored URLs are rewritten by
      // `prisma/migrate-to-r2-urls.ts`.
      {
        protocol: "https",
        hostname: "atmosmedia-temp.s3.ap-southeast-2.amazonaws.com",
      },
      ...(process.env.R2_PUBLIC_URL
        ? [
            {
              protocol: /** @type {const} */ ("https"),
              hostname: new URL(process.env.R2_PUBLIC_URL).hostname,
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
      {
        protocol: "https",
        hostname: "*.myshopify.com",
      },
    ],
  },
  // Old creator URLs from before profiles were renamed to artist profiles.
  redirects: async () => [
    { source: "/creator/:handle", destination: "/@:handle", permanent: true },
    {
      source: "/admin/creator-profiles/:path*",
      destination: "/admin/artist-profiles/:path*",
      permanent: true,
    },
    {
      source: "/admin/creator-themes/:path*",
      destination: "/admin/artist-themes/:path*",
      permanent: true,
    },
  ],
  rewrites: async () => {
    return [
      // Artist public profiles: /@[handle] -> /artist/[handle]
      // We can't use "@" directly in App Router folder names because that
      // syntax is reserved for parallel routes.
      {
        source: "/@:handle",
        destination: "/artist/:handle",
      },
      {
        source: "/fuckoffaddblockers/:match*",
        destination: "https://atmosmedia.co.nz/_vercel/insights/:match*",
      },
      {
        source: "/fuckoffaddblocker/script.js",
        destination: "https://atmosmedia.co.nz/_vercel/insights/script.js",
      },
      {
        source: '/ph/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ph/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default config;
