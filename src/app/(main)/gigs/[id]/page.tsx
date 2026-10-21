import { getTbaText } from "~/lib/gig-flags";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "~/server/db";
import { resolveGigId } from "~/server/gig-lookup";
import { gigPath } from "~/lib/gig-url";
import { lexicalToPlainText } from "~/lib/gig-import/lexical";
import { formatEventDateLong } from "~/lib/ticketing/dates";
import { GigStatus } from "~Prisma/client";
import { DESCRIPTION_SHORT, pageMetadata } from "~/lib/seo-constants";
import { gigOgImage } from "~/server/og-image";
import { api, HydrateClient } from "~/trpc/server";
import {
  BreadcrumbJsonLd,
  EventJsonLd,
  ticketOffers,
} from "~/components/seo/json-ld";
import { GigPage } from "~/components/site/gigs/gig-page";

/**
 * A gig's public page. The gig is loaded here, so the server HTML carries the
 * page itself, its meta tags and its JSON-LD, and an unknown gig is a real 404.
 */

const cleanText = (value?: string | null) =>
  value?.replace(/\s+/g, " ").trim() ?? "";

const truncate = (value: string, length: number) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

/**
 * The gig in its own words (the short description, else the start of the long
 * one), then when and where if there is room. A gig with no words of its own
 * is named with when and where.
 */
function gigDescription(gig: {
  title: string;
  subtitle: string;
  venue: { name: string } | null;
  shortDescription: string | null;
  descriptionLexical: unknown;
  gigStartTime: Date;
}) {
  const short = cleanText(gig.shortDescription);
  const own =
    (short.toLowerCase() === gig.title.trim().toLowerCase() ? "" : short) ||
    cleanText(lexicalToPlainText(gig.descriptionLexical));
  const venue = cleanText(gig.venue?.name ?? gig.subtitle);
  const when = `${formatEventDateLong(gig.gigStartTime)}${venue ? ` at ${venue}` : ""}.`;

  if (!own) return `${gig.title} on ${when}`;
  const sentence = /[.!?]$/.test(own) ? own : `${own}.`;
  return sentence.length + when.length < 160
    ? `${sentence} ${when}`
    : truncate(own, 160);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // Published only. A draft still renders for an admin previewing it, but
  // metadata is cached and served to everyone who hits the URL, so a draft
  // gets the same "not found" as a URL that leads nowhere — anything else
  // would confirm a guess at a draft's title.
  const gigId = await resolveGigId(db, id, { status: GigStatus.PUBLISHED });
  const gig = gigId
    ? await db.gig.findUnique({
        where: { id: gigId },
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          venue: { select: { name: true } },
          shortDescription: true,
          descriptionLexical: true,
          gigStartTime: true,
          isTba: true,
          tbaText: true,
          posterFileUploadId: true,
          widePosterFileUploadId: true,
        },
      })
    : null;

  if (!gig) return { title: "Gig not found", robots: { index: false } };

  // A TBA gig keeps its secret: redacted name, site description, and the
  // teaser in place of its poster. Nothing on it is worth a search result
  // either, and its URL changes once it is announced.
  if (gig.isTba) {
    return pageMetadata({
      title: getTbaText(gig.tbaText, "TBA..."),
      description: truncate(`ATMOS: ${DESCRIPTION_SHORT}`, 160),
      path: gigPath(gig),
      image: gigOgImage(gig) ?? undefined,
      noindex: true,
    });
  }

  return pageMetadata({
    title: gig.title,
    description: gigDescription(gig),
    path: gigPath(gig),
    image: gigOgImage(gig) ?? undefined,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const gig = await api.gigs.getById({ id });
  if (!gig) notFound();

  const [event] = await Promise.all([
    api.ticketEvents.forGig({ gigId: gig.id }),
    api.gigs.getById.prefetch({ id }),
    api.ticketEvents.forGig.prefetch({ gigId: gig.id }),
  ]);
  const path = gigPath(gig);

  return (
    <>
      {gig.isTba ? null : (
        <>
          <EventJsonLd
            name={gig.title}
            description={gigDescription(gig)}
            startDate={gig.gigStartTime}
            endDate={gig.gigEndTime ?? undefined}
            // A picked venue, else the ticket event's. A subtitle is often a
            // venue, but not always.
            venue={{
              name:
                gig.venue?.name ??
                event?.venueName ??
                (gig.subtitle || "Venue to be announced"),
              address:
                (gig.venue ? gig.venue.address : event?.venueAddress) ??
                undefined,
            }}
            image={gig.posterFileUpload?.url ?? gigOgImage(gig)?.url}
            ticketUrl={event ? path : (gig.ticketLink ?? undefined)}
            offers={event ? ticketOffers(event) : undefined}
            performers={gig.lineUp.map(({ artistProfile }) => ({
              name: artistProfile.displayName,
              url: artistProfile.isPublished
                ? `/artist/${artistProfile.handle}`
                : undefined,
            }))}
          />
          <BreadcrumbJsonLd
            items={[
              { name: "Home", url: "/" },
              { name: "Gigs", url: "/gigs" },
              { name: gig.title, url: path },
            ]}
          />
        </>
      )}
      <HydrateClient>
        <GigPage id={id} />
      </HydrateClient>
    </>
  );
}
