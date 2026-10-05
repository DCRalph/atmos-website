import { notFound } from "next/navigation";
import { type Metadata } from "next";
import "~/styles/site.css";
import "./profile.css";
import { CreatorProfileBoard } from "./board";

/**
 * Mock board for the public creator profile redesign: three layout drafts,
 * a proposed five-choice theme model, and the profile states every draft has
 * to handle. Admin and dashboard surfaces are out of scope.
 *
 * Open `http://localhost:3000/ui-test/creator-profile` while `next dev` is
 * running. `?view=frame&draft=wall&theme=gold` renders one draft on its own.
 *
 * Not reachable in production.
 */
export const metadata: Metadata = {
  title: "Creator profile mocks",
  robots: { index: false, follow: false },
};

export default async function CreatorProfileMocksPage({
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
  return <CreatorProfileBoard params={params} />;
}
