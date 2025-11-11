import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "~/components/theme-provider";
// import { ViewTransitionOverlay } from "~/components/view-transition-overlay";
// import { AnimatePresence } from "motion/react";
import { ViewTransition } from "react";

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
    <html lang="en" className={`${geist.variable} dark`} suppressHydrationWarning>
      <body>
        <ViewTransition>
          {/* <AnimatePresence> */}
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            disableTransitionOnChange
          >
            <TRPCReactProvider>

              {children}

              <Analytics />
            </TRPCReactProvider>
          </ThemeProvider>
          {/* </AnimatePresence> */}
        </ViewTransition>
      </body>
    </html>
  );
}
