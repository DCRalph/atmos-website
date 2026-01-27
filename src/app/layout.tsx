import "~/styles/globals.css";

import { type Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeOverrideProvider } from "~/components/theme-overide-provider";
import { MobileMenuProvider } from "~/components/mobile-menu-provider";
import { ViewTransition } from "react";
import { montserrat } from "~/lib/fonts";

import NextTopLoader from "nextjs-toploader";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL;

const description_short =
  "Wellington's curated electronic music events & club nights";
const description_long =
  "ATMOS — Wellington's home for curated electronic music events. Discover underground club nights, DJ events, and immersive nightlife experiences in Pōneke.";

export const metadata: Metadata = {
  title: {
    default: "ATMOS — Wellington Electronic Music Events",
    template: "%s | ATMOS",
  },
  description: description_long,
  applicationName: "ATMOS",
  keywords: [
    "wellington electronic music events",
    "wellington club nights",
    "wellington dj events",
    "pōneke nightlife",
    "underground club night wellington",
    "nz electronic music events",
    "electronic music promoter wellington",
    "dance music collective wellington",
  ],
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico", rel: "icon" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "ATMOS — Wellington Electronic Music Events",
    description: description_short,
    url: "/",
    siteName: "ATMOS",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ATMOS — Wellington Electronic Music Events & Club Nights",
      },
    ],
    locale: "en_NZ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ATMOS — Wellington Electronic Music Events",
    description: description_short,
    images: ["/og-image.png"],
  },
  // Robots directives for Google and other crawlers
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Verification tags (add your verification codes here)
  verification: {
    google: "wqpr0iOn_-vf0MC-mGnQiWqbZcDjRXTfA5INdAbDbGk",
    // yandex: "your-yandex-verification-code",
  },
  // Category for better classification
  category: "entertainment",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${montserrat.className} overflow-x-hidden`}
      suppressHydrationWarning
    >
      <body>
        <ViewTransition>
          <ThemeOverrideProvider
          // defaultForcedTheme="dark"
          >
            <TRPCReactProvider>
              <MobileMenuProvider>
                <NextTopLoader height={4} showSpinner={false} />

                {/* Portal target for mobile menu - rendered above everything */}
                <div
                  id="mobile-menu-portal"
                  className="pointer-events-none fixed inset-0 z-999 *:pointer-events-auto"
                />

                <div
                  id="mobile-menu-toggle-portal"
                  className="pointer-events-none fixed inset-0 z-999 *:pointer-events-auto"
                />

                {/* App content wrapper - receives blur/scale when menu is open */}
                <div
                  id="app-content-wrapper"
                  className="origin-center transition-all duration-700 ease-out"
                >
                  {children}
                </div>

                <Analytics
                  endpoint="/fuckoffaddblockers"
                  scriptSrc="/fuckoffaddblocker/script.js"
                />
              </MobileMenuProvider>
            </TRPCReactProvider>
          </ThemeOverrideProvider>
        </ViewTransition>
      </body>
    </html>
  );
}
