import { api } from "~/trpc/server";
import GigDetailPage from "./GigDetail";
import { type Metadata } from "next";
import { getMediaDisplayUrl } from "~/lib/media-url";
import { EventJsonLd, BreadcrumbJsonLd } from "~/components/seo/json-ld";

const DEFAULT_OG_IMAGE = "/og-image.png";
const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://atmosevents.co.nz";

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
    truncate(descriptionFromBody || "ATMOS — Wellington electronic music events & club nights.", 160);

  const posterImage = gig?.posterFileUpload?.url ?? null;
  const firstPhoto =
    gig?.media?.find((item) => item.type === "photo") ?? gig?.media?.[0];
  const mediaImage =
    posterImage ||
    (firstPhoto ? getMediaDisplayUrl(firstPhoto) : DEFAULT_OG_IMAGE);
  const canonical = `/gigs/${id}`;

  return {
    title: baseTitle,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${baseTitle} — Wellington DJ Event | ATMOS`,
      description,
      url: canonical,
      siteName: "ATMOS",
      images: mediaImage ? [mediaImage] : undefined,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${baseTitle} — Wellington DJ Event | ATMOS`,
      description,
      images: mediaImage ? [mediaImage] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
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
    (firstPhoto ? getMediaDisplayUrl(firstPhoto) : `${siteUrl}/og-image.png`);

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
