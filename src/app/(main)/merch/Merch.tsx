"use client";

import { StaticBackground } from "~/components/static-background";
import { MerchItem } from "~/components/merch/merch-item";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { motion, AnimatePresence } from "motion/react";
import { AnimatedPageHeader } from "~/components/animated-page-header";
import { MainPageSection } from "~/components/main-page-section";
import { ShoppingBag } from "lucide-react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Toggle this to enable/disable the "Coming Soon" overlay
const COMING_SOON = true;
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

function ComingSoonOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-8"
    >
      {/* Darkened backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Content card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
        className="relative z-20 w-full max-w-lg"
      >
        <div className="relative overflow-hidden rounded-none border-2 border-white/15 bg-black/90 p-8 text-center backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.55)] sm:p-12">


          {/* Icon */}
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-none border-2 border-white/20 bg-black/70"
          >
            <ShoppingBag className="h-8 w-8 text-white/80" />
          </div>

          {/* Badge */}
          <span
            className="inline-block border-2 border-white/20 bg-black/70 px-4 py-1.5 text-xs font-bold tracking-[0.35em] text-white/90 uppercase"
          >
            Coming Soon
          </span>

          {/* Title */}
          <h2
            className="mt-6 text-2xl font-black tracking-tight text-white uppercase sm:text-3xl"
          >
            Atmos Merch is on the Way
          </h2>

          {/* Description */}
          <p
            className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/60 sm:text-base"
          >
            We're putting the finishing touches on our store. Join the
            newsletter to be first in line for the drop.
          </p>

        </div>
      </motion.div>
    </motion.div>
  );
}

export default function MerchPage() {
  const { data: merchItems, isLoading: isLoadingMerchItems } =
    api.merch.getAll.useQuery();

  return (
    <main className="min-h-content bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-46.jpg" />

      <MainPageSection>
        <AnimatedPageHeader
          title="MERCH"
          subtitle="Limited drops and Atmos staples"
        />

        <div className="relative">
          {/* Product grid */}
          <div
            className={`grid gap-4 transition-all duration-500 sm:gap-6 md:grid-cols-2 lg:grid-cols-3`}
            aria-hidden={COMING_SOON}
          >
            {isLoadingMerchItems
              ? Array.from({ length: 6 }).map((_, i) => (
                  <MerchItemSkeleton key={i} />
                ))
              : merchItems?.map((item) => (
                  <MerchItem
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    description={item.description}
                    price={item.price}
                    image={item.image}
                  />
                ))}
          </div>

          {/* Coming soon overlay */}
          <AnimatePresence>{COMING_SOON && <ComingSoonOverlay />}</AnimatePresence>
        </div>
      </MainPageSection>
    </main>
  );
}