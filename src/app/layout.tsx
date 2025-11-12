import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeOverrideProvider } from "~/components/theme-overide-provider";
import { ViewTransition } from "react";

import NextTopLoader from 'nextjs-toploader';

export const metadata: Metadata = {
  title: "Atmos",
  description: "Atmos — sound, culture, nightlife.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {


  return (
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
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
