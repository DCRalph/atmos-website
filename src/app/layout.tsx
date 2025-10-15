import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { SocialLinks } from "~/app/_components/social-links";
import { RightMenuRail } from "~/app/_components/right-menu-rail";
import { ScrollingText } from "~/app/_components/top-scroller";

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
    <html lang="en" className={`${geist.variable} dark`}>
      <body>
        <TRPCReactProvider>
          {/* Top navigation scroller */}
          {/* <div className="fixed left-1/2 top-0 z-20 w-full -translate-x-1/2 max-w-2xl">
            <ScrollingText />
          </div> */}

          {/* Left social rail */}
          <SocialLinks className="fixed left-3 top-3 z-20" />

          {/* Right menu rail */}
          <RightMenuRail className="fixed bottom-10 right-6 z-20 text-right" />

          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
