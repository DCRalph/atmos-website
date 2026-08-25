"use client";

import { use, useEffect } from "react";
import GigDetailPage from "./GigDetail";
import { EventJsonLd, BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { api } from "~/trpc/react";
import { getMediaDisplayUrl } from "~/lib/media-url";
import { gigPath } from "~/lib/gig-url";
import { DEFAULT_OG_IMAGE } from "~/lib/seo-constants";

/**
 * The client half of the gig page. Meta tags (title, description, poster,
 * canonical) are server-rendered by page.tsx so scrapers see them without
 * running JavaScript; this half owns what needs the browser: the detail view,
 * the JSON-LD built from the same tRPC data the view uses, and the quiet
 * cuid-to-slug URL swap.
 */
export default function GigPageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: gig } = api.gigs.getById.useQuery({ id });

  const isTba = gig?.mode === "TO_BE_ANNOUNCED";

  // A cuid URL quietly becomes the pretty one once the gig is known. A
  // history replace, not a redirect: nothing remounts and nothing refetches.
  // TBA gigs come back from gigPath as the cuid, so they are left alone.
  useEffect(() => {
    if (!gig) return;
    const pretty = gigPath(gig);
    if (pretty !== `/gigs/${id}`) {
      window.history.replaceState(null, "", pretty);
    }
  }, [gig, id]);

  const posterImage = gig?.posterFileUpload?.url ?? null;
  const firstPhoto =
    gig?.media?.find((item) => item.type === "photo") ?? gig?.media?.[0];
  const mediaImage =
    posterImage ||
    (firstPhoto ? getMediaDisplayUrl(firstPhoto) : DEFAULT_OG_IMAGE);

  return (
    <>
      {/* JSON-LD Structured Data for Google Rich Results */}
      {gig && !isTba && (
        <>
          <EventJsonLd
            name={gig.title}
            description={
              gig.shortDescription ||
              gig.subtitle ||
              "Wellington electronic music event by ATMOS"
            }
            startDate={gig.gigStartTime}
            endDate={gig.gigEndTime ?? undefined}
            venue={{
              name: gig.subtitle || "Wellington Venue",
            }}
            image={mediaImage}
            ticketUrl={gig.ticketLink ?? undefined}
            eventStatus="EventScheduled"
            eventAttendanceMode="OfflineEventAttendanceMode"
          />
          <BreadcrumbJsonLd
            items={[
              { name: "Home", url: "/" },
              { name: "Events", url: "/gigs" },
              { name: gig.title, url: gigPath(gig) },
            ]}
          />
        </>
      )}

      <GigDetailPage params={params} />
    </>
  );
}
