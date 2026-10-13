import "~/styles/globals.css";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";

import { type Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeOverrideProvider } from "~/components/theme-overide-provider";
import { MobileMenuProvider } from "~/components/mobile-menu-provider";
import { LayoutGroupProvider } from "~/components/layout-group-provider";
import { MerchCartProvider } from "~/components/merch/merch-cart-provider";
import { ConfirmProvider } from "~/components/confirm-provider";
import { montserrat } from "~/lib/fonts";

import NextTopLoader from "nextjs-toploader";
import { Toaster } from "sonner";
import {
  SITE_NAME,
  SITE_NAME_FULL,
  SITE_URL,
  DESCRIPTION_LONG,
  COMMON_KEYWORDS,
  DEFAULT_OPENGRAPH,
  DEFAULT_TWITTER,
  VERIFICATION,
  ICONS,
} from "~/lib/seo-constants";
import { RightMenuRail } from "~/components/right-menu-rail";
import { StripTicketHash } from "~/components/ticketing/strip-ticket-hash";
import { PostHogInit } from "~/components/posthog-init";
import { SITE_ACCENT } from "~/lib/site-constants";

/**
 * Site-wide fallbacks only. Next merges each key shallowly, so a canonical, an
 * og:url or an og:title set here would be inherited by every page that doesn't
 * set its own, pointing previews and search engines at the home page. Pages
 * set those through `pageMetadata` / `unlistedPageMetadata`. Robots too: set
 * here, `index, follow` would sit beside the `noindex` Next gives a 404.
 */
export const metadata: Metadata = {
  title: {
    default: SITE_NAME_FULL,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION_LONG,
  applicationName: SITE_NAME,
  keywords: [...COMMON_KEYWORDS],
  metadataBase: new URL(SITE_URL),
  icons: ICONS,
  openGraph: DEFAULT_OPENGRAPH,
  twitter: DEFAULT_TWITTER,
  verification: VERIFICATION,
  category: "entertainment",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${montserrat.className} overflow-x-hidden antialiased`}
      suppressHydrationWarning
    >
      <body>
        {/* First thing in the document on purpose — see the component. */}
        <StripTicketHash />

        {/* No app-wide <ViewTransition>: it froze a snapshot of the old page
            over every navigation, so a click changed the URL but not the
            screen. It also needs `experimental.viewTransition` in
            next.config.js, which is not set. */}
        <LayoutGroupProvider>
          <ThemeOverrideProvider
          // defaultForcedTheme="dark"
          >
            <TRPCReactProvider>
              <MerchCartProvider>
                <MobileMenuProvider>
                  <ConfirmProvider>
                    <NextTopLoader
                      height={3}
                      color={SITE_ACCENT}
                      showSpinner={false}
                    />

                    <div
                      id="mobile-menu-portal"
                      className="pointer-events-none fixed inset-0 z-999 *:pointer-events-auto"
                    />

                    <div
                      id="mobile-menu-toggle-portal"
                      className="pointer-events-none fixed inset-0 z-999 *:pointer-events-auto"
                    />

                    <div
                      id="app-content-wrapper"
                      className="origin-center transition-all duration-700 ease-out"
                    >
                      {/* <RightMenuRail/> */}
                      {children}
                    </div>

                    {/* Dark and quiet, in the public site's colours: these land on top of
                        buying and paying, so they shouldn't look borrowed. */}
                    <Toaster
                      theme="dark"
                      position="bottom-right"
                      toastOptions={{
                        style: {
                          background: "#0b0b0b",
                          border: "1px solid rgb(255 255 255 / 0.14)",
                          borderRadius: "16px",
                          color: "#fff",
                        },
                      }}
                    />

                    <Analytics
                      endpoint="/fuckoffaddblockers"
                      scriptSrc="/fuckoffaddblocker/script.js"
                    />
                    <PostHogInit />
                  </ConfirmProvider>
                </MobileMenuProvider>
              </MerchCartProvider>
            </TRPCReactProvider>
          </ThemeOverrideProvider>
        </LayoutGroupProvider>
      </body>
    </html>
  );
}
