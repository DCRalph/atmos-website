"use client";

import { SiteShell } from "~/components/site/site-shell";
import { useHeroRoute } from "~/components/site/site-header";

/**
 * Every public page sits in the site shell. Pages that open on a full-bleed
 * hero sit under the header; the rest get top padding.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hero = useHeroRoute();
  return <SiteShell padTop={!hero}>{children}</SiteShell>;
}
