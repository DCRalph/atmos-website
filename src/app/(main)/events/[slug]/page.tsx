import { type Metadata } from "next";
import { notFound } from "next/navigation";

import {
  BreadcrumbJsonLd,
  EventJsonLd,
  ticketOffers,
} from "~/components/seo/json-ld";
import { lexicalToPlainText } from "~/lib/gig-import/lexical";
import { buildMediaUrl } from "~/lib/media-url";
import { formatEventDateLong } from "~/lib/ticketing/dates";
import { pageMetadata, unlistedPageMetadata } from "~/lib/seo-constants";
import { isViewable } from "~/server/api/routers/ticket-events";
import { db } from "~/server/db";
import { eventOgImage } from "~/server/og-image";
import { api, HydrateClient } from "~/trpc/server";
import { EventPageClient } from "./event-page-client";

/**
 * A ticket event's page. The event is loaded here, so a shared link previews
 * with its name, date and poster, the server HTML carries the page and its
 * JSON-LD, and an event that isn't there is a real 404. A private event only
 * says what it is to a link carrying its key, the same as the page itself.
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

  // Its own words, or failing those, what, when and where.
  const own = event.shortDescription?.trim() ?? "";
  const venue = event.venueName ? ` at ${event.venueName}` : "";
  const description =
    own ||
    `${event.name} on ${formatEventDateLong(event.startsAt, event.timezone)}${venue}.`;

  return pageMetadata({
    title: event.name,
    description,
    path: `/events/${slug}`,
    image: eventOgImage(event) ?? undefined,
    // An event nobody can find without a link shouldn't turn up in a search.
    noindex: event.visibility !== "PUBLIC",
  });
}

export default async function Page(props: PageProps<"/events/[slug]">) {
  const [{ slug }, query] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  // The same input `EventPageClient` builds from the URL, so it hydrates.
  const input = {
    slug,
    key: typeof query.k === "string" ? query.k : undefined,
  };
  const event = await api.ticketEvents.bySlug(input);
  if (!event) notFound();

  const gigId = event.gig?.id;
  const [gig] = await Promise.all([
    gigId ? api.gigs.getById({ id: gigId }) : null,
    api.ticketEvents.bySlug.prefetch(input),
    gigId ? api.gigs.getById.prefetch({ id: gigId }) : null,
  ]);
  const path = `/events/${event.slug}`;
  // The first of these with any words in it.
  const description =
    [
      event.shortDescription?.trim(),
      lexicalToPlainText(event.descriptionLexical)?.slice(0, 300),
    ].find(Boolean) ?? event.name;

  return (
    <>
      {event.visibility === "PUBLIC" ? (
        <>
          <EventJsonLd
            name={event.name}
            description={description}
            startDate={event.startsAt}
            endDate={event.endsAt ?? undefined}
            venue={{
              name: event.venueName ?? "Venue to be announced",
              address: event.venueAddress ?? undefined,
            }}
            image={
              event.posterFileUploadId
                ? buildMediaUrl(event.posterFileUploadId)
                : undefined
            }
            ticketUrl={path}
            offers={ticketOffers(event)}
            performers={gig?.lineUp.map(({ artistProfile }) => ({
              name: artistProfile.displayName,
              url: artistProfile.isPublished
                ? `/artist/${artistProfile.handle}`
                : undefined,
            }))}
          />
          <BreadcrumbJsonLd
            items={[
              { name: "Home", url: "/" },
              { name: "Tickets", url: "/events" },
              { name: event.name, url: path },
            ]}
          />
        </>
      ) : null}
      <HydrateClient>
        <EventPageClient />
      </HydrateClient>
    </>
  );
}
