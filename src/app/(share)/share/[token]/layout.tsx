import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Atmos Events" },
  robots: { index: false, follow: false },
  // The token in the address is the credential: keep it out of Referer.
  referrer: "no-referrer",
};

/**
 * A share link: one event's read-only organiser pages for whoever holds the
 * address, with no sign-in. The pages find their event with `sharedEventId`,
 * and every query they make carries the token for the server to check again.
 */
export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
