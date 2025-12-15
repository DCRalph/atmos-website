"use client";

import { Suspense, useState, useEffect } from "react";
import { motion } from "motion/react";
import { OpeningAnimation } from "~/components/opening-animation";
import { VideoBackground } from "~/components/video-background";
import { LiveGigPopup } from "~/components/live-gig-popup";
import { GlitchLogo } from "~/components/glitch-logo";
import { SimpleLogo } from "~/components/simple-logo";
import { SocialLinks } from "~/components/social-links";
import { ArrowUpRight, ChevronDown, Loader2 } from "lucide-react";
import SlideOverMenu from "~/components/SlideOverMenu";
import { useIsMobile } from "~/hooks/use-mobile";
// import { UserIndicator } from "~/components/user-indicator";
import { Button } from "~/components/ui/button";
import { UpcomingGigCard } from "~/components/gigs/upcoming-gig-card";
import { PastGigCard } from "~/components/gigs/past-gig-card";
import { ContentItem } from "~/components/content/content-item";
import { api } from "~/trpc/react";
import { StaticBackground } from "~/components/static-background";
import { MainFooter } from "~/components/mainFooter";
import { UserIndicator } from "~/components/user-indicator";
import { NewsletterSection } from "~/components/newsletter/newsletter-section";
import Link from "next/link";
import { formatDate } from "~/lib/date-utils";
import { Badge } from "~/components/ui/badge";
import { isLightColor } from "~/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
import Image from "next/image";
import { type GigMedia } from "~Prisma/browser";
import { orbitron } from "~/lib/fonts";

function HomeContent() {

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isMobile = useIsMobile();

  return (
    <main className="h-dvh overflow-y-scroll overflow-x-hidden bg-black text-white" id="home-page-main">

      <UserIndicator />

      <HomeTopContent />

      {!isMobile ? (
        <div className="w-full flex">
          <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} key="1" />
          <HomeBottomContent isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} key="2" />
        </div>
      ) : (


        <div className={`transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-64" : "translate-x-0"}`}>
          <div className="fixed top-0 right-full z-20 h-full w-64">
            <SlideOverMenu setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} key="3" />
          </div>
          <HomeBottomContent isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} isMobile={isMobile} key="4" />
        </div>
      )}

      <MainFooter />

    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}


function HomeTopContent() {
  return (
    <div className="h-full relative">

      <OpeningAnimation />
      <VideoBackground />

      {/* <SocialLinks className="fixed z-20" /> */}
      <LiveGigPopup />

      {/* Logo section */}
      <section className="relative flex min-h-dvh items-center justify-center px-4 z-20">
        <div className="text-center w-full max-w-[70vw] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
          {/* <GlitchLogo /> */}
          <SimpleLogo />
        </div>

        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <button
            type="button"
            aria-label="Scroll to content"
            onClick={() => {
              const main = document.getElementById("home-page-main");
              if (!main) return;

              // Scroll exactly one viewport of the scroll container to reveal the next section.
              main.scrollTo({ top: main.clientHeight, behavior: "smooth" });
            }}
            className="group inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur-sm transition hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-0"
          >
            <ChevronDown className="h-5 w-5 transition-transform duration-200 group-hover:translate-y-0.5" />
          </button>
        </motion.div>
      </section>

      <div className="absolute w-full h-32 z-10 bg-linear-to-t from-black to-transparent bottom-0 left-0" />

    </div>
  );
}

function HomeBottomContent({ isMenuOpen, setIsMenuOpen, isMobile }: { isMenuOpen: boolean; setIsMenuOpen: (open: boolean) => void; isMobile: boolean }) {
  const { data: upcomingGigs, isLoading: isLoadingUpcomingGigs } = api.gigs.getUpcoming.useQuery();
  const { data: pastGigs, isLoading: isLoadingPastGigs } = api.gigs.getPast.useQuery();
  const { data: contentItems, isLoading: isLoadingContent } = api.content.getAll.useQuery();

  const sortedPastGigsWithStart = (pastGigs ?? [])
    .filter((gig) => gig.gigStartTime)
    .slice()
    .sort((a, b) => b.gigStartTime!.getTime() - a.gigStartTime!.getTime());

  // Limit past gigs to 6 most recent
  const recentPastGigs = sortedPastGigsWithStart.slice(0, 6);
  const latestPastGig = recentPastGigs[0];
  const otherRecentPastGigs = recentPastGigs.slice(1);
  // Ensure "latest" content is actually the most recent by date
  const sortedContentItems = (contentItems ?? []).slice().sort((a, b) => b.date.getTime() - a.date.getTime());
  // Limit content items to 3 most recent
  const recentContentItems = sortedContentItems.slice(0, 3);
  const latestContentItem = recentContentItems[0];
  const otherRecentContentItems = recentContentItems.slice(1);

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  };

  return (
    <main className="relative flex-1 bg-black text-white min-h-screen ">
      {/* <StaticBackground imageSrc="/home/atmos-46.jpg" /> */}

      {isMobile && (
        <nav className="sticky top-0 left-0 right-0 w-full bg-black/50 backdrop-blur h-16 z-50">
          <div className="flex items-center justify-between">
            <div className="absolute flex items-center justify-center top-0 left-2 h-16 w-16 z-30">
              <Button variant="link" className="text-lg uppercase" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                Menu
              </Button>
            </div>
          </div>
        </nav>
      )}

      <section className="relative z-10 min-h-screen px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          {/* About Section */}
          {/* <div className="mb-12 sm:mb-16">
            <p className="text-sm sm:text-base text-white/50 leading-relaxed max-w-2xl">
              A collective of DJs, producers, and creatives based in Pōneke (Wellington), New Zealand.
            </p>
          </div> */}

          {/* Upcoming Gigs Section */}
          <div className="mb-16 sm:mb-20">
            <h2 className={`mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4 ${orbitron.className}`}>
              Upcoming Gigs
            </h2>
            <div className="space-y-4">
              {isLoadingUpcomingGigs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-white/60" />
                </div>
              ) : upcomingGigs && upcomingGigs.filter((gig) => gig.gigStartTime).length > 0 ? (
                upcomingGigs
                  .filter((gig) => gig.gigStartTime)
                  .map((gig) => (
                    <UpcomingGigCard key={gig.id} gig={{ ...gig, gigStartTime: gig.gigStartTime! }} />
                  ))
              ) : (
                <p className="text-white/60 text-center py-8">No upcoming gigs scheduled.</p>
              )}
            </div>
          </div>

          {/* Content Items Section */}
          <div className="mb-16 sm:mb-20">
            <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4 border-b border-white/20 pb-3 sm:pb-4">
              <h2 className={`text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl ${orbitron.className}`}>
                Latest Content
              </h2>
              <Link href="/content" className="shrink-0">
                <Button
                  variant="outline"
                  className="h-9 rounded-full border-white/20 bg-white/5 px-4 text-xs font-semibold tracking-wide text-white/90 hover:bg-white/10 hover:text-white"
                >
                  View all
                  <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
              {isLoadingContent ? (
                <div className="flex items-center justify-center py-8 col-span-full">
                  <Loader2 className="w-6 h-6 animate-spin text-white/60" />
                </div>
              ) : latestContentItem ? (
                <>
                  {/* Featured (most recent) item */}
                  <motion.a
                    href={latestContentItem.link}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 sm:p-8 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:col-span-3"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    aria-label={`Open latest ${latestContentItem.type}: ${latestContentItem.title}`}
                  >
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <div className="absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent" />
                      <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
                    </div>

                    <div className="relative">
                      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                            {latestContentItem.type}
                          </span>
                          <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/80">
                            Most recent
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/60">
                          <span>
                            {latestContentItem.date.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          {getHostname(latestContentItem.link) ? (
                            <>
                              <span className="h-1 w-1 rounded-full bg-white/25" />
                              <span className="truncate">
                                {getHostname(latestContentItem.link)}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-end">
                        <div>
                          <h3 className="text-2xl font-bold tracking-wide sm:text-3xl md:text-4xl">
                            {latestContentItem.title}
                          </h3>
                          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
                            {latestContentItem.description}
                          </p>
                        </div>

                        <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:p-5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                            Quick info
                          </p>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-white/50">Type</p>
                              <p className="font-semibold text-white/90">
                                {latestContentItem.type}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-white/50">Date</p>
                              <p className="font-semibold text-white/90">
                                {latestContentItem.date.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-xs font-semibold text-white/70 transition-colors group-hover:text-white">
                              Open now
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/70 transition-colors group-hover:text-white">
                              <span className="translate-x-0 transition-transform duration-200 group-hover:translate-x-0.5">
                                Explore
                              </span>
                              <ArrowUpRight className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.a>

                  {/* Remaining recent items */}
                  {otherRecentContentItems.length > 0 ? (
                    <div className="lg:col-span-3 grid gap-4 sm:gap-6 md:grid-cols-2">
                      {otherRecentContentItems.map((item) => (
                        <ContentItem
                          key={item.id}
                          id={item.id}
                          type={item.type}
                          title={item.title}
                          description={item.description}
                          date={item.date}
                          link={item.link}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-white/60 text-center py-8 col-span-full">No content available.</p>
              )}
            </div>
          </div>

          {/* Past Gigs Section */}
          <div>
            <h2 className={`mb-6 sm:mb-8 text-2xl sm:text-3xl font-bold tracking-wide md:text-4xl border-b border-white/20 pb-3 sm:pb-4 ${orbitron.className}`}>
              Recent Gigs
            </h2>
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
              {isLoadingPastGigs ? (
                <div className="flex items-center justify-center py-8 col-span-full">
                  <Loader2 className="w-6 h-6 animate-spin text-white/60" />
                </div>
              ) : latestPastGig ? (
                <>
                  {/* Featured (most recent) gig */}
                  <motion.a
                    href={`/gigs/${latestPastGig.id}`}
                    className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 sm:p-8 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:col-span-3"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    aria-label={`Open most recent gig: ${latestPastGig.title}`}
                  >
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <div className="absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent" />
                      <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
                    </div>

                    <div className="relative">
                      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                            Gig
                          </span>
                          <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/80">
                            Most recent
                          </span>
                        </div>
                        <div className="text-xs text-white/60">
                          {formatDate(latestPastGig.gigStartTime!, "long")}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-end">
                        <div>
                          <h3 className="text-2xl font-bold tracking-wide sm:text-3xl md:text-4xl">
                            {latestPastGig.title}
                          </h3>
                          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
                            {latestPastGig.subtitle}
                          </p>

                          {latestPastGig.gigTags && latestPastGig.gigTags.length > 0 ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {latestPastGig.gigTags.slice(0, 6).map((gt) => (
                                <Badge
                                  key={gt.gigTag.id}
                                  variant="outline"
                                  className="rounded-full"
                                  style={{
                                    backgroundColor: gt.gigTag.color,
                                    borderColor: gt.gigTag.color,
                                    color: isLightColor(gt.gigTag.color) ? "black" : "white",
                                  }}
                                >
                                  {gt.gigTag.name}
                                </Badge>
                              ))}
                              {latestPastGig.gigTags.length > 6 ? (
                                <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs font-semibold text-white/70">
                                  +{latestPastGig.gigTags.length - 6}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {(() => {
                          const media = (latestPastGig.media ?? []) as GigMedia[];
                          const featuredPhotos = media.filter((m) => m.featured && m.type === "photo");
                          const photosToShow = featuredPhotos.length > 0 ? featuredPhotos : media.filter((m) => m.type === "photo");

                          if (photosToShow.length === 0) {
                            return (
                              <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:p-5">
                                <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                                  Featured photos
                                </p>
                                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-white/20">
                                  <p className="text-xs text-white/40">No photos available</p>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-white/60 px-1">
                                Featured photos
                              </p>
                              <Carousel
                                opts={{
                                  align: "start",
                                  loop: photosToShow.length > 1,
                                }}
                                className="relative w-full"
                              >
                                <CarouselContent className="-ml-2 md:-ml-4">
                                  {photosToShow.map((photo) => (
                                    <CarouselItem key={photo.id} className="pl-2 md:pl-4">
                                      <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black/20">
                                        <Image
                                          src={photo.url}
                                          alt={`${latestPastGig.title} photo`}
                                          fill
                                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                                          sizes="(max-width: 768px) 100vw, 50vw"
                                        />
                                      </div>
                                    </CarouselItem>
                                  ))}
                                </CarouselContent>
                                {photosToShow.length > 1 && (
                                  <>
                                    <CarouselPrevious className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 border-white/20 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 hover:border-white/40" />
                                    <CarouselNext className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 border-white/20 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 hover:border-white/40" />
                                  </>
                                )}
                              </Carousel>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </motion.a>

                  {/* Remaining recent gigs */}
                  {otherRecentPastGigs.length > 0 ? (
                    <div className="lg:col-span-3 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {otherRecentPastGigs.map((gig) => (
                        <PastGigCard key={gig.id} gig={{ ...gig, gigStartTime: gig.gigStartTime! }} />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-white/60 text-center py-8 col-span-full">No past gigs available.</p>
              )}
            </div>
          </div>

          <NewsletterSection />
        </div>
      </section>

    </main>
  );
}