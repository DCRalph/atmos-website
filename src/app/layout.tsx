import "~/styles/globals.css";

import { type Metadata } from "next";
import { Analytics } from "@vercel/analytics/next"

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeOverrideProvider } from "~/components/theme-overide-provider";
import { ViewTransition } from "react";
import { montserrat } from "~/lib/fonts";

import NextTopLoader from 'nextjs-toploader';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: {
    default: "Atmos",
    template: "%s | Atmos",
  },
  description: "Atmos — sound, culture, nightlife.",
  applicationName: "Atmos",
  keywords: ["Atmos", "sound", "culture", "nightlife", "music", "events"],
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
    title: "Atmos — sound, culture, nightlife.",
    description: "Atmos — sound, culture, nightlife.",
    url: "/",
    siteName: "Atmos",
    images: [
      {
        url: "/atmos.png",
        width: 1200,
        height: 630,
        alt: "Atmos — sound, culture, nightlife.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Atmos — sound, culture, nightlife.",
    description: "Atmos — sound, culture, nightlife.",
    images: ["/atmos.png"],
  },
};



export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {


  return (
    <html lang="en" className={`${montserrat.className} overflow-x-hidden`} suppressHydrationWarning>
      <body>
        <ViewTransition>
          <ThemeOverrideProvider defaultForcedTheme="dark">
            <TRPCReactProvider>
              <NextTopLoader height={4} showSpinner={false} />

              {children}

              <Analytics />
            </TRPCReactProvider>
          </ThemeOverrideProvider>
        </ViewTransition>
      </body>
    </html >
  );
}
