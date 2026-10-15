/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { PRIVATE_NETWORK_HOSTS } from "./src/lib/private-network-hosts.js";

/** @type {import("next").NextConfig} */
const config = {
  // Extra hostnames allowed to load dev assets: any private network address,
  // so a phone on the same Wi-Fi works, plus DEV_ORIGINS for machine names
  // (comma-separated, e.g. DEV_ORIGINS=my-box). The app reads the same list
  // through `~/lib/dev-hosts`.
  allowedDevOrigins: [
    ...PRIVATE_NETWORK_HOSTS,
    ...(process.env.DEV_ORIGINS?.split(",") ?? []),
  ],
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
    // Legal pages moved under /legal. Wallet passes, emails and older app
    // builds still link to the old paths.
    { source: "/privacy", destination: "/legal/privacy", permanent: true },
    { source: "/terms", destination: "/legal/terms", permanent: true },
    {
      source: "/tickets/terms",
      destination: "/legal/ticket-terms",
      permanent: true,
    },
    { source: "/legal", destination: "/legal/terms", permanent: false },
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
        source: "/ph/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ph/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default config;
