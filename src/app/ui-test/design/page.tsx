import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { DesignBoard } from "./board";
import "./design.css";

/**
 * Mock board for the proposed public-site design system: stretched type,
 * hard + round shapes, glass over imagery. Admin surfaces are out of scope.
 *
 * Open `http://localhost:3000/ui-test/design` while `next dev` is running.
 * `?mode=pages` opens the page drafts; `?view=frame&page=gigs` renders one
 * page draft on its own (what the tablet and phone previews load).
 *
 * Not reachable in production.
 */
export const metadata: Metadata = {
  title: "Design mocks",
  robots: { index: false, follow: false },
};

export default async function DesignMocksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") return notFound();
  const raw = await searchParams;
  // Only single values matter here; repeated params keep their first value.
  const params = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  return <DesignBoard params={params} />;
}
