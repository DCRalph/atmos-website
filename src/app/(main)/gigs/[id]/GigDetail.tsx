"use client";

import { GigPage } from "~/components/site/gigs/gig-page";

/** A gig's public page. Layout and data live in the site gigs components. */
export default function GigDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <GigPage params={params} />;
}
