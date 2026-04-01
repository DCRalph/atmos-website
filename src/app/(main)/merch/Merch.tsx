"use client";

import { StaticBackground } from "~/components/static-background";
import { MerchItem } from "~/components/merch/merch-item";
import { MerchCartDrawer } from "~/components/merch/merch-cart-drawer";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { AnimatedPageHeader } from "~/components/animated-page-header";
import { MainPageSection } from "~/components/main-page-section";
import { EmailPopup } from "~/components/email-popup";

function MerchItemSkeleton() {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-none border-2 border-white/10 bg-black/80 backdrop-blur-sm">
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden border-b-2 border-white/10 bg-black/70">
        <Skeleton className="h-full w-full bg-white/20" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
        <div>
          <Skeleton className="h-3 w-24 bg-white/10" />
          <Skeleton className="mt-3 h-5 w-3/4 bg-white/20 sm:h-6" />
          <Skeleton className="mt-3 h-3 w-full bg-white/10 sm:h-4" />
          <Skeleton className="mt-2 h-3 w-5/6 bg-white/10 sm:h-4" />
        </div>
        <div className="flex items-center justify-between border-t-2 border-white/10 pt-4">
          <Skeleton className="h-5 w-16 bg-white/20 sm:h-6" />
          <Skeleton className="h-8 w-28 bg-white/20 sm:h-9 sm:w-32" />
        </div>
      </div>
    </div>
  );
}

export default function MerchPage() {
  const {
    data: shopifyProducts,
    isLoading: isLoadingProducts,
    isError: isErrorProducts,
    error: productsError,
  } = api.shopify.getProducts.useQuery();

  return (
    <main className="min-h-content bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-46.jpg" />
      
      <EmailPopup />

      <MainPageSection>
        {/*
          Grid keeps the cart in column 2 beside the full-height main column so
          position:sticky works while scrolling the product grid (short parents break sticky).
        */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-6">
          <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
            <AnimatedPageHeader
              title="MERCH"
              subtitle="Limited drops and Atmos staples"
            />
          </div>

          <aside className="justify-self-end lg:sticky lg:top-4 lg:z-30 lg:col-start-2 lg:row-start-1 lg:row-end-3 lg:self-start">
            <MerchCartDrawer />
          </aside>

          <div className="relative min-w-0 lg:col-start-1 lg:row-start-2">
            <div className="grid gap-4 transition-all duration-500 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {isLoadingProducts
                ? Array.from({ length: 6 }).map((_, i) => (
                  <MerchItemSkeleton key={i} />
                ))
                : shopifyProducts?.map((product) => (
                  <MerchItem
                    key={product.id}
                    id={product.id}
                    name={product.title}
                    description={product.description}
                    defaultPrice={product.price}
                    image={product.image}
                    handle={product.handle}
                    currencyCode={product.currencyCode}
                    variants={product.variants}
                    productHref={`/merch/${encodeURIComponent(product.handle)}`}
                  />
                ))}
            </div>

            {!isLoadingProducts &&
              !isErrorProducts &&
              shopifyProducts?.length === 0 && (
                <div className="mt-6 rounded-none border-2 border-white/10 bg-black/70 p-4 text-center text-sm text-white/70 sm:p-6 sm:text-base">
                  No products in the catalog yet. An admin can run a sync from{" "}
                  <span className="text-white/90">Admin → Shopify</span> when the
                  store is ready.
                </div>
              )}

            {isErrorProducts && (
              <div className="mt-6 rounded-none border-2 border-red-500/40 bg-red-500/10 p-4 text-center text-sm text-red-100 sm:p-6 sm:text-base">
                <p className="font-semibold">Could not load the merch catalog.</p>
                <p className="mt-2 text-red-100/80">
                  {productsError?.message ?? "Please try again later."}
                </p>
              </div>
            )}
          </div>
        </div>
      </MainPageSection>
    </main>
  );
}
