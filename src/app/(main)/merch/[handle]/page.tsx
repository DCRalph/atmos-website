import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { BreadcrumbJsonLd, ProductJsonLd } from "~/components/seo/json-ld";
import { MerchProduct } from "~/components/site/merch/merch-product";
import { pageMetadata } from "~/lib/seo-constants";
import { api, HydrateClient } from "~/trpc/server";

type MerchProductPageProps = {
  params: Promise<{ handle: string }>;
};

/** The input the client component queries with, so the prefetch matches it. */
const productInput = (handle: string) => ({
  handle: decodeURIComponent(handle),
});

/** Shopify descriptions are plain text with hard line breaks. */
const summary = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 159)}…` : flat;
};

export async function generateMetadata({
  params,
}: MerchProductPageProps): Promise<Metadata> {
  const { handle } = await params;
  const product = await api.shopify.getProductByHandle(productInput(handle));
  if (!product) return { title: "Product not found" };

  return pageMetadata({
    title: product.title,
    description:
      summary(product.description) || `${product.title}, from the Atmos store.`,
    path: `/merch/${product.handle}`,
    image: product.image
      ? { url: product.image, alt: product.title }
      : undefined,
  });
}

export default async function MerchProductPage({
  params,
}: MerchProductPageProps) {
  const { handle } = await params;
  const product = await api.shopify.getProductByHandle(productInput(handle));
  if (!product) notFound();
  await api.shopify.getProductByHandle.prefetch(productInput(handle));

  const path = `/merch/${product.handle}`;
  return (
    <>
      <ProductJsonLd
        name={product.title}
        description={summary(product.description) || product.title}
        image={product.image}
        url={path}
        price={product.price}
        currency={product.currencyCode}
        available={product.variants.some((v) => v.availableForSale)}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Merch", url: "/merch" },
          { name: product.title, url: path },
        ]}
      />
      <HydrateClient>
        <MerchProduct handle={handle} />
      </HydrateClient>
    </>
  );
}
