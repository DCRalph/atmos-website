// "use client";

// import { use, useEffect } from "react";
// import posthog from "posthog-js";
// import { StaticBackground } from "~/components/static-background";
// import { api } from "~/trpc/react";
// import { formatDate, formatTime, isGigPast } from "~/lib/date-utils";
// import { MediaGallery } from "../../../../components/gigs/media-gallery";
// import { MarkdownContent } from "../../../../components/markdown-content";
// import Link from "next/link";
// import { authClient } from "~/lib/auth-client";
// import { ArrowLeft, Calendar, Clock, Loader2, Pencil, Ticket } from "lucide-react";
// import { GigTagList } from "~/components/gig-tag-list";
// import Image from "next/image";

// type PageProps = {
//   params: Promise<{ id: string }>;
// };

// export default function GigPage({ params }: PageProps) {
//   const { id } = use(params);
//   const { data: gig, isLoading } = api.gigs.getById.useQuery({ id });
//   const { data: session } = authClient.useSession();
//   const isAdmin = session?.user?.role === "ADMIN";

//   useEffect(() => {
//     if (!gig) return;
//     const isTba = gig.mode === "TO_BE_ANNOUNCED";
//     const displayTitle = isTba ? "TBA..." : gig.title;
//     const upcoming = !isGigPast(gig);
//     posthog.capture("gig_detail_viewed", {
//       gig_id: gig.id,
//       gig_title: displayTitle,
//       upcoming,
//       is_tba: isTba,
//     });
//   }, [gig]);

//   if (isLoading) {
//     return (
//       <main className="bg-black text-white">
//         <StaticBackground imageSrc="/home/atmos-6.jpg" />
//         <section className="relative z-10 min-h-dvh px-4 pb-8 pt-2">
//           <div className="mx-auto max-w-6xl">
//             <div className="flex items-center justify-center border-2 border-white/10 bg-black/80 py-12 backdrop-blur-sm">
//               <Loader2 className="text-accent-muted h-6 w-6 animate-spin" />
//             </div>
//           </div>
//         </section>
//       </main>
//     );
//   }

//   if (!gig) {
//     return (
//       <main className="bg-black text-white">
//         <StaticBackground imageSrc="/home/atmos-6.jpg" />
//         <section className="relative z-10 min-h-dvh px-4 pb-8 pt-2">
//           <div className="mx-auto max-w-6xl">
//             <div className="border-2 border-white/10 bg-black/80 p-8 text-center backdrop-blur-sm">
//               <h2 className="text-2xl font-black tracking-wider uppercase sm:text-3xl">
//                 Gig not found
//               </h2>
//               <p className="mt-2 text-sm text-white/60">
//                 The event you are looking for may have been removed.
//               </p>
//             </div>
//           </div>
//         </section>
//       </main>
//     );
//   }

//   const isTba = gig.mode === "TO_BE_ANNOUNCED";
//   const displayTitle = isTba ? "TBA..." : gig.title;
//   const upcoming = !isGigPast(gig);
//   const hasMedia = !isTba && gig.media && gig.media.length > 0;
//   const hasPoster = !!gig.posterFileUpload?.url;

//   if (isTba) {
//     return (
//       <main className="bg-black text-white">
//         <StaticBackground imageSrc="/home/atmos-6.jpg" />

//         <section className="relative z-10 min-h-dvh px-4 py-10">
//           <div className="mx-auto max-w-6xl">
//             <div className="mb-8 flex gap-4">
//               <Link
//                 href="/gigs"
//                 className="group flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-sm font-black tracking-wider text-white uppercase transition-all hover:border-white hover:bg-white/10"
//               >
//                 <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
//                 Back to Gigs
//               </Link>
//               {isAdmin && (
//                 <Link
//                   href={`/admin/gigs/${id}`}
//                   className="group flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-sm font-black tracking-wider text-white uppercase transition-all hover:border-white hover:bg-white/10"
//                 >
//                   <Pencil className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
//                   Manage Gig
//                 </Link>
//               )}
//             </div>

//             <div className="hover:border-accent-muted/50 group relative overflow-hidden border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all sm:p-8 md:p-10">
//               <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
//                 <div className="from-accent-muted/10 absolute inset-0 bg-linear-to-br via-transparent to-transparent" />
//                 <div className="bg-accent-muted/20 absolute top-0 -right-24 h-72 w-72 rounded-full blur-3xl" />
//               </div>

//               <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
//                 <div>
//                   <h1 className="text-3xl font-black tracking-tight uppercase sm:text-4xl md:text-5xl">
//                     {displayTitle}
//                   </h1>
//                 </div>
//                 {hasPoster && (
//                   <div className="hover:border-accent-muted/50 relative aspect-3/4 w-full overflow-hidden rounded-none border-2 border-white/10 bg-black/20 transition-all">
//                     <Image
//                       src={gig.posterFileUpload!.url}
//                       alt="TBA poster"
//                       fill
//                       sizes="(max-width: 1024px) 100vw, 33vw"
//                       className="object-cover blur-md"
//                     />
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         </section>
//       </main>
//     );
//   }

//   return (
//     <main className="bg-black text-white">
//       <StaticBackground imageSrc="/home/atmos-6.jpg" />

//       <section className="relative z-10 min-h-dvh px-4 py-10">
//         <div className="mx-auto max-w-6xl">
//           {/* Navigation */}
//           <div className="mb-8 flex gap-4">
//             <Link
//               href="/gigs"
//               className="group flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-sm font-black tracking-wider text-white uppercase transition-all hover:border-white hover:bg-white/10"
//             >
//               <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
//               Back to Gigs
//             </Link>
//             {isAdmin && (
//               <Link
//                 href={`/admin/gigs/${id}`}
//                 className="group flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-sm font-black tracking-wider text-white uppercase transition-all hover:border-white hover:bg-white/10"
//               >
//                 <Pencil className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
//                 Manage Gig
//               </Link>
//             )}
//           </div>

//           {/* Gig Header Card */}
//           <div className="hover:border-accent-muted/50 group relative mb-8 overflow-hidden border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all sm:p-8 md:p-10">
//             {/* Glow effect */}
//             <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
//               <div className="from-accent-muted/10 absolute inset-0 bg-linear-to-br via-transparent to-transparent" />
//               <div className="bg-accent-muted/20 absolute top-0 -right-24 h-72 w-72 rounded-full blur-3xl" />
//             </div>

//             <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
//               {/* Left side - Details */}
//               <div>
//                 <div className="text-accent-muted mb-4 flex items-center gap-2">
//                   <Calendar className="h-5 w-5" />
//                   <span className="text-xl font-black tracking-wider uppercase sm:text-2xl">
//                     {formatDate(gig.gigStartTime, "long")}
//                   </span>
//                 </div>

//                 <h1 className="mb-4 text-3xl font-black tracking-tight uppercase sm:text-4xl md:text-5xl">
//                   {displayTitle}
//                 </h1>

//                 <p className="mb-6 text-lg font-medium text-white/70 sm:text-xl">
//                   {gig.subtitle}
//                 </p>

//                 {/* Tags */}
//                 <GigTagList gigTags={gig.gigTags} className="mb-6" size="md" />

//                 {/* Description */}
//                 {gig.longDescription && (
//                   <div className="border-accent-strong border-l-4 py-2 pl-4">
//                     <MarkdownContent content={String(gig.longDescription)} />
//                   </div>
//                 )}
//               </div>

//               {/* Right side - Poster + Featured Photos Carousel */}
//               <div className="flex flex-col gap-4">
//                 {hasPoster && (
//                   <div className="hover:border-accent-muted/50 relative aspect-3/4 w-full overflow-hidden rounded-none border-2 border-white/10 bg-black/20 transition-all">
//                     <Image
//                       src={gig.posterFileUpload!.url}
//                       alt={`${gig.title} poster`}
//                       fill
//                       sizes="(max-width: 1024px) 100vw, 33vw"
//                       className="object-cover transition-transform duration-300 hover:scale-105"
//                     />
//                   </div>
//                 )}


//               </div>
//             </div>
//           </div>

//           {/* Event Details Section */}
//           {upcoming && (
//             <div className="hover:border-accent-muted/50 mb-8 border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all sm:p-8">
//               <h2 className="border-accent-strong mb-6 border-l-4 pl-4 text-2xl font-black tracking-wider uppercase sm:text-3xl">
//                 Event Details
//               </h2>
//               <div className="space-y-6">
//                 <div className="flex items-start gap-4">
//                   <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
//                     <Calendar className="text-accent-muted h-5 w-5" />
//                   </div>
//                   <div>
//                     <h3 className="text-sm font-bold tracking-wider text-white/60 uppercase">
//                       Date
//                     </h3>
//                     <p className="text-lg font-bold">
//                       {formatDate(gig.gigStartTime, "long")}
//                     </p>
//                   </div>
//                 </div>

//                 <div className="flex items-start gap-4">
//                   <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
//                     <Clock className="text-accent-muted h-5 w-5" />
//                   </div>
//                   <div>
//                     <h3 className="text-sm font-bold tracking-wider text-white/60 uppercase">
//                       Time
//                     </h3>
//                     <p className="text-lg font-bold">
//                       {gig.gigEndTime
//                         ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
//                         : `Starts at ${formatTime(gig.gigStartTime)}`}
//                     </p>
//                   </div>
//                 </div>

//                 {gig.ticketLink && (
//                   <div className="flex items-start gap-4">
//                     <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
//                       <Ticket className="text-accent-muted h-5 w-5" />
//                     </div>
//                     <div className="flex flex-col">
//                       <h3 className="text-sm font-bold tracking-wider text-white/60 uppercase">
//                         Tickets
//                       </h3>
//                       <Link
//                         href={gig.ticketLink}
//                         target="_blank"
//                         rel="noopener noreferrer"
//                         className="hover:text-accent-muted text-white underline underline-offset-4 transition-colors"
//                         onClick={() =>
//                           posthog.capture("ticket_link_clicked", {
//                             gig_id: gig.id,
//                             gig_title: gig.title,
//                           })
//                         }
//                       >
//                         {gig.ticketLink}
//                       </Link>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </div>
//           )}

//           {/* Past Gig Without Media */}
//           {!upcoming && !hasMedia && (
//             <div className="space-y-6">
//               <div className="hover:border-accent-muted/50 border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all sm:p-8">
//                 <h2 className="border-accent-strong mb-6 border-l-4 pl-4 text-2xl font-black tracking-wider uppercase sm:text-3xl">
//                   Event Details
//                 </h2>
//                 <div className="grid gap-6 sm:grid-cols-2">
//                   <div className="flex items-start gap-4">
//                     <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
//                       <Calendar className="text-accent-muted h-5 w-5" />
//                     </div>
//                     <div>
//                       <h3 className="text-sm font-bold tracking-wider text-white/60 uppercase">
//                         Date
//                       </h3>
//                       <p className="text-lg font-bold">
//                         {formatDate(gig.gigStartTime, "long")}
//                       </p>
//                     </div>
//                   </div>

//                   <div className="flex items-start gap-4">
//                     <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
//                       <Clock className="text-accent-muted h-5 w-5" />
//                     </div>
//                     <div>
//                       <h3 className="text-sm font-bold tracking-wider text-white/60 uppercase">
//                         Time
//                       </h3>
//                       <p className="text-lg font-bold">
//                         {gig.gigEndTime
//                           ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
//                           : `Started at ${formatTime(gig.gigStartTime)}`}
//                       </p>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {/* Coming Soon Message */}
//               <div className="border-2 border-white/10 bg-black/80 p-8 text-center backdrop-blur-sm">
//                 <h2 className="mb-4 text-2xl font-black tracking-wider uppercase sm:text-3xl">
//                   Photos & Videos
//                 </h2>
//                 <p className="text-lg font-bold tracking-wider text-white/60 uppercase">
//                   Coming Soon
//                 </p>
//               </div>
//             </div>
//           )}

//           {/* Past Gig With Media */}
//           {!upcoming && hasMedia && (
//             <div className="space-y-8">
//               <div className="hover:border-accent-muted/50 border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all sm:p-8">
//                 <h2 className="border-accent-strong mb-4 border-l-4 pl-4 text-2xl font-black tracking-wider uppercase sm:text-3xl">
//                   Event Details
//                 </h2>
//                 <div className="flex flex-wrap gap-6">
//                   <div className="flex items-center gap-2">
//                     <Calendar className="text-accent-muted h-4 w-4" />
//                     <span className="text-sm font-bold tracking-wider text-white/60 uppercase">
//                       Date:
//                     </span>
//                     <span className="text-base font-bold">
//                       {formatDate(gig.gigStartTime, "long")}
//                     </span>
//                   </div>
//                   <div className="flex items-center gap-2">
//                     <Clock className="text-accent-muted h-4 w-4" />
//                     <span className="text-sm font-bold tracking-wider text-white/60 uppercase">
//                       Time:
//                     </span>
//                     <span className="text-base font-bold">
//                       {gig.gigEndTime
//                         ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
//                         : `Started at ${formatTime(gig.gigStartTime)}`}
//                     </span>
//                   </div>
//                 </div>
//               </div>

//               <MediaGallery media={gig.media} gigTitle={gig.title} />
//             </div>
//           )}
//         </div>
//       </section>
//     </main>
//   );
// }

"use client";

import { use, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Ticket,
  Pencil,
  MapPin,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { api } from "~/trpc/react";
import { formatDate, formatTime, isGigPast } from "~/lib/date-utils";
import { GigTagList } from "~/components/gig-tag-list";
import { LexicalContent } from "~/components/lexical";
import { MediaGallery } from "~/components/gigs/media-gallery";
import { buildMediaUrl } from "~/lib/media-url";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function GigPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: gig, isLoading } = api.gigs.getById.useQuery({ id });
  const { data: viewerUser } = api.user.me.useQuery();
  const isAdmin =
    viewerUser?.roles?.some((r) => r.role === "ADMIN") ?? false;

  const upcoming = gig ? !isGigPast(gig) : true;
  const hasPoster = !!gig?.posterFileUpload?.url;

  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // All hooks must run before any conditional returns (Rules of Hooks)
  const posterY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const posterScale = useTransform(scrollYProgress, [0, 0.5], [1, 1.1]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.3], [0.4, 0.85]);
  const titleY = useTransform(scrollYProgress, [0, 0.5], ["0%", "50%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  if (isLoading) {
    return (
      <main
        ref={containerRef}
        className="relative flex min-h-screen items-center justify-center bg-black text-white"
      >
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </main>
    );
  }

  if (!gig) {
    return (
      <main
        ref={containerRef}
        className="relative min-h-screen bg-black text-white"
      >
        <section className="flex min-h-screen flex-col items-center justify-center px-4">
          <h2 className="text-2xl font-black tracking-wider uppercase sm:text-3xl">
            Gig not found
          </h2>
          <p className="mt-2 text-sm text-white/60">
            The event you are looking for may have been removed.
          </p>
          <Link
            href="/gigs"
            className="mt-6 flex items-center gap-2 border border-white/30 px-4 py-2 text-sm font-bold tracking-wider uppercase transition-all hover:border-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Gigs
          </Link>
        </section>
      </main>
    );
  }

  const isTba = gig.mode === "TO_BE_ANNOUNCED";
  const displayTitle = isTba ? "TBA..." : gig.title;
  const posterLayoutId = `gig-poster-${gig.id}`;
  const hasMedia =
    gig.mode !== "TO_BE_ANNOUNCED" &&
    !!gig.media &&
    gig.media.length > 0;

  const fadeInUp = {
    hidden: { opacity: 0, y: "30%" },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
    }),
  };

  return (
    <main ref={containerRef} className="relative min-h-screen bg-black text-white">
      {/* Hero Section - Full viewport immersive */}
      <section ref={heroRef} className="relative h-[90vh] overflow-hidden">
        {/* Background Poster with Parallax */}
        {hasPoster && (
          <motion.div
            className="absolute inset-0 z-0"
            style={{ y: posterY, scale: posterScale }}
          >
            <Image
              src={gig.posterFileUpload!.url}
              alt={`${displayTitle} poster`}
              fill
              priority
              className="object-cover blur-2xl absolute inset-0"
              sizes="100vw"
            />
          </motion.div>
        )}

        {hasPoster && (
          <motion.div
            layoutId={posterLayoutId}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="pointer-events-none absolute inset-0 z-10"
            style={{ y: posterY, scale: posterScale }}
          >
            <Image
              src={gig.posterFileUpload!.url}
              alt={`${displayTitle} poster`}
              fill
              priority
              className={isTba ? "object-contain blur-md pb-48" : "object-contain pb-48"}
              sizes="100vw"
            />
          </motion.div>
        )}

        {/* linear Overlays (lighter for TBA) */}
        {!isTba && (
          <>
            <motion.div
              className="absolute inset-0 z-10 bg-black"
              style={{ opacity: overlayOpacity }}
            />
            <div className="absolute inset-0 z-10 bg-linear-to-t from-black via-black/20 to-transparent" />
            <div className="absolute inset-0 z-10 bg-linear-to-r from-black/60 via-transparent to-transparent" />
          </>
        )}
        {isTba && (
          <div className="absolute inset-0 z-10 bg-black/40" />
        )}

        {/* Navigation - Floating */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute top-0 left-0 right-0 z-30 px-4 py-4"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-4">
            <Link
              href="/gigs"
              className="group flex items-center gap-2 border border-white/20 bg-black/30 px-4 py-2.5 text-sm font-bold tracking-wider text-white uppercase backdrop-blur-md transition-all hover:border-white/50 hover:bg-black/50"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back
            </Link>
            {isAdmin && (
              <Link
                href={`/admin/gigs/${gig.id}`}
                className="group flex items-center gap-2 border border-white/20 bg-black/30 px-4 py-2.5 text-sm font-bold tracking-wider text-white uppercase backdrop-blur-md transition-all hover:border-white/50 hover:bg-black/50"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            )}
          </div>
        </motion.div>

        {/* Hero Content */}
        <motion.div
          className="relative z-20 flex h-full flex-col justify-end px-4 pb-4"
          style={{ y: titleY, opacity: contentOpacity }}
        >
          <div className="mx-auto w-full max-w-7xl">
            {isTba ? (
              /* TBA Content */
              <motion.h1
                custom={0}
                initial="hidden"
                animate="visible"
                variants={fadeInUp}
                className="text-6xl font-black tracking-tight uppercase sm:text-7xl md:text-8xl lg:text-9xl"
              >
                <span className="bg-linear-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                  TBA...
                </span>
              </motion.h1>
            ) : (
              <>
                {/* Title */}
                <motion.h1
                  custom={0}
                  initial="hidden"
                  animate="visible"
                  variants={fadeInUp}
                  className="mb-4 max-w-4xl text-5xl font-black tracking-tight uppercase sm:text-6xl md:text-7xl lg:text-8xl"
                >
                  <span className="bg-linear-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                    {displayTitle}
                  </span>
                </motion.h1>

                {/* Subtitle */}
                {gig.subtitle && (
                  <motion.p
                    custom={1}
                    initial="hidden"
                    animate="visible"
                    variants={fadeInUp}
                    className="mb-5 max-w-2xl text-lg text-white/70 sm:text-xl md:text-2xl"
                  >
                    {gig.subtitle}
                  </motion.p>
                )}

                {/* Inline event meta */}
                <motion.div
                  custom={2}
                  initial="hidden"
                  animate="visible"
                  variants={fadeInUp}
                  className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/60"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-white/40" />
                    {formatDate(gig.gigStartTime, "long")}
                  </span>

                  {upcoming && (
                    <>
                      <span className="text-white/20">|</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-white/40" />
                        {gig.gigEndTime
                          ? `${formatTime(gig.gigStartTime)} – ${formatTime(gig.gigEndTime)}`
                          : `Starts at ${formatTime(gig.gigStartTime)}`}
                      </span>
                    </>
                  )}

                  {gig.gigCreators && gig.gigCreators.length > 0 && (
                    <>
                      <span className="text-white/20">|</span>
                      <div className="group/lineup flex items-center">
                        {gig.gigCreators.map((gc, i) => {
                          const cp = gc.creatorProfile;
                          const avatar = cp.avatarFileId
                            ? buildMediaUrl(cp.avatarFileId)
                            : null;
                          return (
                            <Link
                              key={gc.id}
                              href={`/@${cp.handle}`}
                              aria-label={cp.displayName}
                              className={`group/avatar relative block h-8 w-8 transition-[margin-left,transform,z-index] duration-300 ease-out hover:z-20 ${
                                i === 0
                                  ? "ml-0"
                                  : "-ml-2 group-hover/lineup:ml-1"
                              }`}
                            >
                              <div className="relative h-8 w-8 overflow-hidden rounded-full bg-white/10 ring-2 ring-black transition-all group-hover/avatar:ring-white/70">
                                {avatar ? (
                                  <Image
                                    src={avatar}
                                    alt={cp.displayName}
                                    fill
                                    sizes="32px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[11px] font-black text-white/60">
                                    {cp.displayName.slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <span className="pointer-events-none absolute top-full left-1/2 z-30 mt-2 -translate-x-1/2 translate-y-1 whitespace-nowrap border border-white/15 bg-black/90 px-2 py-1 text-[10px] font-bold tracking-wider text-white uppercase opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 group-hover/avatar:translate-y-0 group-hover/avatar:opacity-100">
                                {cp.displayName}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                </motion.div>

                {/* Tags + ticket CTA */}
                <motion.div
                  custom={3}
                  initial="hidden"
                  animate="visible"
                  variants={fadeInUp}
                  className="flex flex-wrap items-center gap-4"
                >
                  <GigTagList gigTags={gig.gigTags} size="md" />

                  {gig.ticketLink && upcoming && (
                    <Link
                      href={gig.ticketLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative inline-flex items-center gap-2 overflow-hidden bg-accent-strong px-5 py-2 text-sm font-black tracking-wider text-white uppercase transition-all hover:bg-accent-muted hover:shadow-[0_0_20px_var(--accent-muted)]"
                    >
                      <Ticket className="h-4 w-4" />
                      Get Tickets
                    </Link>
                  )}
                </motion.div>
              </>
            )}
          </div>
        </motion.div>

        {/* Scroll indicator */}
        {/* <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="absolute bottom-8 left-1/2 z-30 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-xs font-bold tracking-widest text-white/50 uppercase">
              Scroll
            </span>
            <ChevronDown className="h-5 w-5 text-white/50" />
          </motion.div>
        </motion.div> */}
      </section>

      {/* Content Section */}
      {!isTba && (
        <section className="relative z-20 bg-linear-to-b from-transparent via-black to-black">
          <div className="mx-auto max-w-7xl px-4 pb-24">
            {/* Description */}
            {gig.descriptionLexical && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className="mx-auto max-w-3xl"
              >
                <LexicalContent
                  value={gig.descriptionLexical}
                  namespace={`gig-description-${gig.id}`}
                  contentClassName="prose prose-invert max-w-none"
                />
              </motion.div>
            )}

            {/* Past gig media gallery */}
            {!upcoming && hasMedia && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className="mt-16"
              >
                <MediaGallery media={gig.media} gigTitle={gig.title} />
              </motion.div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
