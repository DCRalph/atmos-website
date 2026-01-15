"use client";

import { StaticBackground } from "~/components/static-background";
import { MerchItem } from "~/components/merch/merch-item";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { motion } from "motion/react";
import { AnimatedPageHeader } from "~/components/animated-page-header";

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
  const comingSoon = true;

  return (
    <main className="bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-46.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <AnimatedPageHeader
            title="MERCH"
            subtitle="Limited drops and Atmos staples"
          />

          <div className="relative">
            <div
              className={[
                "grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 transition-all duration-300",
                comingSoon ? "pointer-events-none select-none blur-[2px] opacity-40" : "",
              ].join(" ")}
              aria-hidden={comingSoon ? "true" : undefined}
            >
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

            {comingSoon ? (
              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="relative w-full max-w-xl overflow-hidden rounded-none border-2 border-white/15 bg-black/80 p-8 text-center backdrop-blur-md"
                >
                  <div className="pointer-events-none absolute inset-0 opacity-70">
                    <motion.div
                      className="absolute -left-24 top-0 h-full w-48 bg-linear-to-r from-transparent via-accent-muted/25 to-transparent"
                      animate={{ x: ["0%", "220%"] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
                    />
                  </div>

                  <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-white/70">
                    Coming soon
                  </p>
                  <h2 className="text-balance text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
                    Atmos merch is on the way
                  </h2>
                  <p className="mx-auto mt-4 max-w-md text-sm text-white/70 sm:text-base">
                    We’re getting the store ready. Join the newsletter to hear about the first drop.
                  </p>
                </motion.div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

