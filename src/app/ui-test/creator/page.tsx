import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { CreatorUiTestHarness } from "./harness";

/**
 * Visual test harness for the creator profile editor and the public profile
 * page. Renders every block type against fixture data at a range of sizes,
 * themes and densities so layout regressions (stray padding, dead vertical
 * space, overflow) are visible and machine-checkable.
 *
 * Drive it with `bun run ui:audit`, or open
 * `http://localhost:3000/ui-test/creator` while `next dev` is running.
 *
 * Not reachable in production.
 */
export const metadata: Metadata = {
  title: "Creator UI test harness",
  robots: { index: false, follow: false },
};

export default async function CreatorUiTestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") return notFound();

  const params = await searchParams;
  const section = typeof params.section === "string" ? params.section : undefined;
  const outline = params.outline === "1" || params.outline === "true";

  return <CreatorUiTestHarness section={section} outline={outline} />;
}
