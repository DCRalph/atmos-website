import { type Metadata } from "next";
import { db } from "~/server/db";
import { resolveGigId } from "~/server/gig-lookup";
import { gigPath } from "~/lib/gig-url";
import { formatEventDateLong } from "~/lib/ticketing/dates";
import { GigStatus } from "~Prisma/client";
import { DESCRIPTION_SHORT, pageMetadata } from "~/lib/seo-constants";
import { gigOgImage } from "~/server/og-image";
import GigPageClient from "./gig-page-client";

/**
 * The server half of the gig page: real meta tags in the initial HTML, so
 * link scrapers (which do not run JavaScript) see the gig's name, preview
 * image and short description. Everything visible is client-rendered — see
 * gig-page-client.tsx.
 */

export const revalidate = 60;

const cleanText = (value?: string | null) =>
  value?.replace(/\s+/g, " ").trim() ?? "";

const truncate = (value: string, length: number) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

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
          title: true,
          subtitle: true,
          shortDescription: true,
          gigStartTime: true,
          isTba: true,
          posterFileUploadId: true,
          widePosterFileUploadId: true,
        },
      })
    : null;

  if (!gig) return { title: "Gig not found", robots: { index: false } };

  // A TBA gig keeps its secret: redacted name, site description, and the
  // teaser in place of its poster.
  const isTba = gig.isTba;
  const name = isTba ? "TBA..." : gig.title;
  // Otherwise its own words, or failing those, when and where.
  const description = isTba
    ? truncate(`ATMOS: ${DESCRIPTION_SHORT}`, 160)
    : cleanText(gig.shortDescription) ||
      [formatEventDateLong(gig.gigStartTime), cleanText(gig.subtitle)]
        .filter(Boolean)
        .join(" · ");

  return pageMetadata({
    title: `${name} | Gig`,
    description,
    path: gigPath(gig),
    image: gigOgImage(gig) ?? undefined,
  });
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <GigPageClient params={params} />;
}
