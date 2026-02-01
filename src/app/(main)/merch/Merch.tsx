"use client";

import { StaticBackground } from "~/components/static-background";
import { MerchItem } from "~/components/merch/merch-item";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { motion } from "motion/react";
import { AnimatedPageHeader } from "~/components/animated-page-header";

function MerchItemSkeleton() {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-6">
      <div className="mb-4 flex aspect-square w-full items-center justify-center rounded-lg bg-white/10">
        <Skeleton className="h-full w-full rounded-lg bg-white/20" />
      </div>
      <Skeleton className="mb-2 h-5 w-3/4 bg-white/20 sm:h-6" />
      <Skeleton className="mb-1 h-3 w-full bg-white/10 sm:h-4" />
      <Skeleton className="mb-4 h-3 w-5/6 bg-white/10 sm:h-4" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16 bg-white/20 sm:h-6" />
        <Skeleton className="h-8 w-24 rounded-md bg-white/20 sm:h-9 sm:w-28" />
      </div>
    </div>
  );
}

export default function MerchPage() {
  const { data: merchItems, isLoading: isLoadingMerchItems } =
    api.merch.getAll.useQuery();
  const comingSoon = true;

  return (
    <main className="bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-46.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <AnimatedPageHeader
            title="MERCH"
            subtitle="Limited drops and Atmos staples"
          />

          <div className="relative">
            <div
              className={[
                "grid gap-6 transition-all duration-300 sm:gap-8 md:grid-cols-2 lg:grid-cols-3",
                comingSoon
                  ? "pointer-events-none opacity-40 blur-[2px] select-none"
                  : "",
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
              <div className="fixed top-1/2 left-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="relative w-full max-w-xl overflow-hidden rounded-none border-2 border-white/15 bg-black/80 p-8 text-center backdrop-blur-md"
                >
                  <div className="pointer-events-none absolute inset-0 opacity-70">
                    <motion.div
                      className="via-accent-muted/25 absolute top-0 -left-24 h-full w-48 bg-linear-to-r from-transparent to-transparent"
                      animate={{ x: ["0%", "220%"] }}
                      transition={{
                        duration: 2.6,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  </div>

                  <p className="mb-3 text-xs font-black tracking-[0.25em] text-white/70 uppercase">
                    Coming soon
                  </p>
                  <h2 className="text-3xl font-extrabold tracking-tight text-balance uppercase sm:text-4xl">
                    Atmos merch is on the way
                  </h2>
                  <p className="mx-auto mt-4 max-w-md text-sm text-white/70 sm:text-base">
                    We’re getting the store ready. Join the newsletter to hear
                    about the first drop.
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
