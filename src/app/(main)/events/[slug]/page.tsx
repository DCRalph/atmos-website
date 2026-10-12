import { type Metadata } from "next";

import { formatEventDateLong } from "~/lib/ticketing/dates";
import { pageMetadata, unlistedPageMetadata } from "~/lib/seo-constants";
import { isViewable } from "~/server/api/routers/ticket-events";
import { db } from "~/server/db";
import { eventOgImage } from "~/server/og-image";
import { EventPageClient } from "./event-page-client";

/**
 * A ticket event's page. The meta tags are rendered here so a shared link
 * previews with the event's name, date and poster; everything visible is
 * `EventPageClient`. A private event only says what it is to a link carrying
 * its key, the same as the page itself.
 */
export async function generateMetadata(
  props: PageProps<"/events/[slug]">,
): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const event = await db.ticketEvent.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      shortDescription: true,
      venueName: true,
      startsAt: true,
      timezone: true,
      status: true,
      visibility: true,
      accessKey: true,
      posterFileUploadId: true,
      gig: {
        select: {
          isTba: true,
          posterFileUploadId: true,
          widePosterFileUploadId: true,
        },
      },
    },
  });
  const key = typeof query.k === "string" ? query.k : undefined;
  if (!event || !isViewable(event, key)) return unlistedPageMetadata("Event");

  // Its own words, or failing those, when and where.
  const own = event.shortDescription?.trim() ?? "";
  const description =
    own ||
    [formatEventDateLong(event.startsAt, event.timezone), event.venueName]
      .filter(Boolean)
      .join(" · ");

  return pageMetadata({
    title: event.name,
    description,
    path: `/events/${slug}`,
    image: eventOgImage(event) ?? undefined,
    // An event nobody can find without a link shouldn't turn up in a search.
    noindex: event.visibility !== "PUBLIC",
  });
}

export default function Page() {
  return <EventPageClient />;
}
