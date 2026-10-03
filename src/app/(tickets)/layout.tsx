import "~/styles/site.css";

import type { Metadata } from "next";

import { siteFontVariables } from "~/lib/site-fonts";
import { cn } from "~/lib/utils";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Ticket, receipt and pass pages: the public site's type and tokens, no header or footer. */
export default function TicketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={cn("site relative min-h-dvh", siteFontVariables)}>
      {children}
    </div>
  );
}
