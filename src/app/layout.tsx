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

const description_short = "Atmos Media - Hub";
const description_long =
  "Atmos Media - Hub for all things Atmos. We are a media company that creates content for the Atmos brand.";

export const metadata: Metadata = {
  title: {
    default: "Atmos",
    template: "%s | Atmos",
  },
  description: description_long,
  applicationName: "Atmos",
  keywords: ["Atmos", "Atmos Media", "Atmos Hub", "Atmos Media Hub"],
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
    title: "Atmos ",
    description: description_short,
    url: "/",
    siteName: "Atmos",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: description_short,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Atmos ",
    description: description_short,
    images: ["/og-image.png"],
  },
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
