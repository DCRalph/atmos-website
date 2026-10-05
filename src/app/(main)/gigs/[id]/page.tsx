import { type Metadata } from "next";
import { db } from "~/server/db";
import { resolveGigId } from "~/server/gig-lookup";
import { gigPath } from "~/lib/gig-url";
import { FileUploadStatus, GigStatus } from "~Prisma/client";
import {
  DEFAULT_OG_IMAGE,
  DESCRIPTION_SHORT,
  SITE_NAME,
  SITE_URL,
  formatFullTitle,
} from "~/lib/seo-constants";
import { teaserPosterUrl } from "~/server/gig-teaser";
import GigPageClient from "./gig-page-client";

/**
 * The server half of the gig page: real meta tags in the initial HTML, so
 * link scrapers (which do not run JavaScript) see the gig's name, poster and
 * short description. Everything visible is client-rendered — see
 * gig-page-client.tsx.
 */

export const revalidate = 60;

const cleanText = (value?: string | null) =>
  value?.replace(/\s+/g, " ").trim() ?? "";

const truncate = (value: string, length: number) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

/**
 * The poster's URL, unless the file has since been deleted. A TBA gig gets
 * the server-blurred teaser instead.
 */
async function posterUrl(gig: {
  id: string;
  isTba: boolean;
  posterFileUploadId: string | null;
}): Promise<string | null> {
  const fileUploadId = gig.posterFileUploadId;
  if (!fileUploadId) return null;
  const file = await db.file_upload.findUnique({
    where: { id: fileUploadId },
    select: { url: true, status: true },
  });
  const gone: FileUploadStatus[] = [
    FileUploadStatus.DELETED,
    FileUploadStatus.SOFT_DELETED,
  ];
  if (!file || gone.includes(file.status)) return null;
  return gig.isTba ? teaserPosterUrl(gig.id, fileUploadId) : file.url;
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
          title: true,
          subtitle: true,
          shortDescription: true,
          isTba: true,
          posterFileUploadId: true,
        },
      })
    : null;

  if (!gig) return { title: "Gig not found", robots: { index: false } };

  // A TBA gig keeps its secret: redacted name, site description, and the
  // teaser in place of its poster.
  const isTba = gig.isTba;
  const name = isTba ? "TBA..." : gig.title;
  const description =
    (isTba ? "" : cleanText(gig.shortDescription) || cleanText(gig.subtitle)) ||
    truncate(`ATMOS — ${DESCRIPTION_SHORT}`, 160);
  const image = (await posterUrl(gig)) ?? DEFAULT_OG_IMAGE;
  const canonical = `${SITE_URL}${gigPath(gig)}`;

  return {
    // The root layout's template appends "| ATMOS".
    title: `${name} | Gig`,
    description,
    alternates: { canonical },
    openGraph: {
      title: formatFullTitle(name),
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: [image],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: formatFullTitle(name),
      description,
      images: [image],
    },
  };
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <GigPageClient params={params} />;
}
