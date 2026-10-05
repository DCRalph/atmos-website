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
  rewrites: async () => {
    return [
      // Creator public profiles: /@[handle] -> /creator/[handle]
      // We can't use "@" directly in App Router folder names because that
      // syntax is reserved for parallel routes.
      {
        source: "/@:handle",
        destination: "/creator/:handle",
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
