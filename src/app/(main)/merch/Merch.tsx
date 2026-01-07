"use client";

import { StaticBackground } from "~/components/static-background";
import { MerchItem } from "~/components/merch/merch-item";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";

function MerchItemSkeleton() {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-sm">
      <div className="mb-4 aspect-square w-full bg-white/10 rounded-lg flex items-center justify-center">
        <Skeleton className="w-full h-full rounded-lg bg-white/20" />
      </div>
      <Skeleton className="h-5 sm:h-6 w-3/4 mb-2 bg-white/20" />
      <Skeleton className="h-3 sm:h-4 w-full mb-1 bg-white/10" />
      <Skeleton className="h-3 sm:h-4 w-5/6 mb-4 bg-white/10" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 sm:h-6 w-16 bg-white/20" />
        <Skeleton className="h-8 sm:h-9 w-24 sm:w-28 rounded-md bg-white/20" />
      </div>
    </div>
  );
}

export default function MerchPage() {
  const { data: merchItems, isLoading: isLoadingMerchItems } = api.merch.getAll.useQuery();

  return (
    <main className="bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-46.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">

          <h1 className="mb-12 sm:mb-16 text-center text-4xl sm:text-5xl font-bold tracking-wider md:text-7xl">
            MERCH
          </h1>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingMerchItems ? (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <MerchItemSkeleton key={i} />
                ))}
              </>
            ) : (
              merchItems?.map((item) => (
                <MerchItem
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  description={item.description}
                  price={item.price}
                  image={item.image}
                />
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

