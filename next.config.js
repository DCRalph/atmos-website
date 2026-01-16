/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
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
      {
        protocol: "https",
        hostname: "atmosmedia-temp.s3.ap-southeast-2.amazonaws.com",
      },
    ],
  },
  rewrites: async () => {
    return [
      {
        source: "/fuckoffaddblockers/:match*",
        destination: "hhttps://atmosmedia.co.nz/_vercel/insights/:match*",
      },
      {
        source: "/fuckoffaddblocker/script.js",
        destination: "https://atmosmedia.co.nz/_vercel/insights/script.js",
      },
    ];
  },
  // experimental: {
  //   viewTransition: true,
  // },
};

export default config;
