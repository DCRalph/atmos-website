import { api } from "~/trpc/server";
import GigDetailPage from "./GigDetail";
import { type Metadata } from "next";

const DEFAULT_OG_IMAGE = "/favicon.ico";

const cleanText = (value?: string | null) => value?.replace(/\s+/g, " ").trim() ?? "";

const truncate = (value: string, length: number) => (value.length > length ? `${value.slice(0, length - 1)}…` : value);


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const gig = await api.gigs.getById({ id });

  const baseTitle = gig?.title ?? "Gig";
  const subtitle = cleanText(gig?.subtitle);
  const descriptionFromBody = cleanText(gig?.description ? String(gig?.description) : "");
  const description = subtitle || truncate(descriptionFromBody || "Atmos — sound, culture, nightlife.", 160);

  const mediaImage = gig?.media?.find((item) => item.type === "photo")?.url ?? gig?.media?.[0]?.url ?? DEFAULT_OG_IMAGE;
  const canonical = `/gigs/${id}`;

  return {
    title: `${baseTitle} | Atmos`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${baseTitle} | Atmos`,
      description,
      url: canonical,
      siteName: "Atmos",
      images: mediaImage ? [mediaImage] : undefined,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${baseTitle} | Atmos`,
      description,
      images: mediaImage ? [mediaImage] : undefined,
    },
  };
}

export default function page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <GigDetailPage params={params} />
  );
}