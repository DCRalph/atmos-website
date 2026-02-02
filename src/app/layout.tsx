import "~/styles/globals.css";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";

import { type Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeOverrideProvider } from "~/components/theme-overide-provider";
import { MobileMenuProvider } from "~/components/mobile-menu-provider";
import { ViewTransition } from "react";
import { montserrat } from "~/lib/fonts";

import NextTopLoader from "nextjs-toploader";
import {
  SITE_NAME,
  SITE_TAGLINE,
  SITE_NAME_FULL,
  SITE_URL,
  DESCRIPTION_SHORT,
  DESCRIPTION_LONG,
  COMMON_KEYWORDS,
  DEFAULT_ROBOTS,
  DEFAULT_OPENGRAPH,
  DEFAULT_TWITTER,
  VERIFICATION,
  ICONS,
} from "~/lib/seo-constants";

export const metadata: Metadata = {
  title: {
    default: SITE_NAME_FULL,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION_LONG,
  applicationName: SITE_NAME,
  keywords: [...COMMON_KEYWORDS],
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  alternates: {
    canonical: "/",
  },
  icons: ICONS,
  openGraph: {
    ...DEFAULT_OPENGRAPH,
    title: SITE_NAME_FULL,
    description: DESCRIPTION_SHORT,
    url: "/",
  },
  twitter: {
    ...DEFAULT_TWITTER,
    title: SITE_NAME_FULL,
    description: DESCRIPTION_SHORT,
  },
  robots: DEFAULT_ROBOTS,
  verification: VERIFICATION,
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
