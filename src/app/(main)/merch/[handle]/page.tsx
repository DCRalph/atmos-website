import type { Metadata } from "next";
import { SITE_URL } from "~/lib/seo-constants";
import { MerchProduct } from "~/components/site/merch/merch-product";

type MerchProductPageProps = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({
  params,
}: MerchProductPageProps): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: "Merch Product",
    alternates: {
      canonical: `${SITE_URL}/merch/${handle}`,
    },
  };
}

export default async function MerchProductPage({
  params,
}: MerchProductPageProps) {
  const { handle } = await params;

  return <MerchProduct handle={handle} />;
}
