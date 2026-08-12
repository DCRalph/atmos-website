import type { Metadata } from "next";

/**
 * A ticket link is a bearer credential. Keeping these pages out of search
 * indexes is the bare minimum — the signed token in the URL is what actually
 * protects them.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TicketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
