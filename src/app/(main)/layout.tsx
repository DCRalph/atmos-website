"use client";

import { SiteShell } from "~/components/site/site-shell";
import { useHeroRoute } from "~/components/site/site-header";
import { useCaptureAttribution } from "~/lib/ticketing/attribution";
import { useRecordPageView } from "~/lib/use-record-page-view";

/**
 * Every public page sits in the site shell. Pages that open on a full-bleed
 * hero sit under the header; the rest get top padding. Campaign tags are
 * kept from whichever page someone lands on, for checkout to read, and every
 * page counts its views for the Site tab on Analytics.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hero = useHeroRoute();
  useCaptureAttribution();
  useRecordPageView();
  return <SiteShell padTop={!hero}>{children}</SiteShell>;
}
