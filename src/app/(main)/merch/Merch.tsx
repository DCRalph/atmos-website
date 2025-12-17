"use client";

import { StaticBackground } from "~/components/static-background";
import { MerchItem } from "~/components/merch/merch-item";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";

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
            {/* Placeholder merch items - replace with actual data */}
            {isLoadingMerchItems ? (
              <div className="flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
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
              )))}
          </div>
        </div>
      </section>
    </main>
  );
}

