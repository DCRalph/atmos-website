import { api } from "~/trpc/server";
import GigDetailPage from "./GigDetail";
import { type Metadata } from "next";
import { getMediaDisplayUrl } from "~/lib/media-url";
import { EventJsonLd, BreadcrumbJsonLd } from "~/components/seo/json-ld";
import {
  DEFAULT_OG_IMAGE,
  DESCRIPTION_SHORT,
  createGigMetadata,
} from "~/lib/seo-constants";

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
  const gig = await api.gigs.getById({ id });

  const baseTitle = gig?.title ?? "Gig";
  const subtitle = cleanText(gig?.subtitle);
  const descriptionFromBody = cleanText(
    gig?.description ? String(gig?.description) : "",
  );
  const description =
    subtitle ||
    truncate(
      descriptionFromBody || `ATMOS — ${DESCRIPTION_SHORT}`,
      160,
    );

  const posterImage = gig?.posterFileUpload?.url ?? null;
  const firstPhoto =
    gig?.media?.find((item) => item.type === "photo") ?? gig?.media?.[0];
  const mediaImage =
    posterImage ||
    (firstPhoto ? getMediaDisplayUrl(firstPhoto) : DEFAULT_OG_IMAGE);
  const canonical = `/gigs/${id}`;

  return createGigMetadata(baseTitle, description, mediaImage, canonical);
}

export default async function page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gig = await api.gigs.getById({ id });

  // Get image for JSON-LD
  const posterImage = gig?.posterFileUpload?.url ?? null;
  const firstPhoto =
    gig?.media?.find((item) => item.type === "photo") ?? gig?.media?.[0];
  const mediaImage =
    posterImage ||
    (firstPhoto ? getMediaDisplayUrl(firstPhoto) : DEFAULT_OG_IMAGE);

  return (
    <>
      {/* JSON-LD Structured Data for Google Rich Results */}
      {gig && (
        <>
          <EventJsonLd
            name={gig.title}
            description={
              gig.subtitle ||
              gig.description?.toString() ||
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
              { name: gig.title, url: `/gigs/${id}` },
            ]}
          />
        </>
      )}

      <GigDetailPage params={params} />
    </>
  );
}
