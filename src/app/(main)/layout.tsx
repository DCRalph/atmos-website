"use client";

import { SiteShell } from "~/components/site/site-shell";
import { useHeroRoute } from "~/components/site/site-header";
import { useCaptureAttribution } from "~/lib/ticketing/attribution";

/**
 * Every public page sits in the site shell. Pages that open on a full-bleed
 * hero sit under the header; the rest get top padding. Campaign tags are
 * kept from whichever page someone lands on, for checkout to read.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hero = useHeroRoute();
  useCaptureAttribution();
  return <SiteShell padTop={!hero}>{children}</SiteShell>;
}
