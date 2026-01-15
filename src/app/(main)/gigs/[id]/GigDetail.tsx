import { notFound } from "next/navigation"
import { StaticBackground } from "~/components/static-background"
import { api } from "~/trpc/server"
import { formatDate, formatTime, isGigPast } from "~/lib/date-utils"
import { MediaGallery } from "../../../../components/gigs/media-gallery"
import { MarkdownContent } from "../../../../components/markdown-content"
import { GigDetailPhotoCarousel } from "../../../../components/gigs/gig-detail-photo-carousel"
import Link from "next/link"
import { authServer } from "~/lib/auth"
import { ArrowLeft, Calendar, Clock, Pencil, Ticket } from "lucide-react"
import { GigTagList } from "~/components/gig-tag-list"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function GigPage({ params }: PageProps) {
  const { id } = await params
  const gig = await api.gigs.getById({ id })

  if (!gig) {
    notFound()
  }

  // Check if user is admin
  const { user } = await authServer()
  const isAdmin = user?.role === "ADMIN"

  const upcoming = !isGigPast(gig)
  const hasMedia = gig.media && gig.media.length > 0

  return (
    <main className="bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-6.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          {/* Navigation */}
          <div className="mb-8 flex gap-4">
            <Link
              href="/gigs"
              className="group flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-sm font-black uppercase tracking-wider text-white transition-all hover:border-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Back to Gigs
            </Link>
            {isAdmin && (
              <Link
                href={`/admin/gigs/${id}`}
                className="group flex items-center gap-2 rounded-none border-2 border-white/30 bg-transparent px-4 py-2 text-sm font-black uppercase tracking-wider text-white transition-all hover:border-white hover:bg-white/10"
              >
                <Pencil className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                Manage Gig
              </Link>
            )}
          </div>

          {/* Gig Header Card */}
          <div className="mb-8 border-2 border-white/10 bg-black/80 backdrop-blur-sm p-6 sm:p-8 md:p-10 hover:border-accent-muted/50 transition-all relative overflow-hidden group">

            {/* Glow effect */}
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="absolute inset-0 bg-linear-to-br from-accent-muted/10 via-transparent to-transparent" />
              <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-accent-muted/20 blur-3xl" />
            </div>

            <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
              {/* Left side - Details */}
              <div>
                <div className="mb-4 flex items-center gap-2 text-accent-muted">
                  <Calendar className="w-5 h-5" />
                  <span className="text-xl sm:text-2xl font-black uppercase tracking-wider">
                    {formatDate(gig.gigStartTime, "long")}
                  </span>
                </div>

                <h1 className="mb-4 text-3xl sm:text-4xl md:text-5xl font-black tracking-tight uppercase">
                  {gig.title}
                </h1>

                <p className="text-lg sm:text-xl text-white/70 mb-6 font-medium">{gig.subtitle}</p>

                {/* Tags */}
                <GigTagList
                  gigTags={gig.gigTags}
                  className="mb-6"
                  size="md"
                />

                {/* Description */}
                {gig.description && (
                  <div className="border-l-4 border-accent-strong pl-4 py-2">
                    <MarkdownContent content={String(gig.description)} />
                  </div>
                )}
              </div>

              {/* Right side - Featured Photos Carousel */}
              {hasMedia ? (
                <GigDetailPhotoCarousel media={gig.media!} gigTitle={gig.title} />
              ) : (
                <div className="flex flex-col gap-3 rounded-none border-2 border-white/10 bg-black/40 p-4 sm:p-5">
                  {/* <p className="text-xs font-black uppercase tracking-widest text-accent-muted">Featured Photos</p> */}
                  <div className="flex h-32 items-center justify-center rounded-none border-2 border-dashed border-white/20">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/40">No photos available</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Event Details Section */}
          {upcoming && (
            <div className="mb-8 border-2 border-white/10 bg-black/80 backdrop-blur-sm p-6 sm:p-8 hover:border-accent-muted/50 transition-all">
              <h2 className="mb-6 text-2xl sm:text-3xl font-black tracking-wider uppercase border-l-4 border-accent-strong pl-4">
                Event Details
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
                    <Calendar className="h-5 w-5 text-accent-muted" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
                      Date
                    </h3>
                    <p className="text-lg font-bold">{formatDate(gig.gigStartTime, "long")}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
                    <Clock className="h-5 w-5 text-accent-muted" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
                      Time
                    </h3>
                    <p className="text-lg font-bold">
                      {gig.gigEndTime
                        ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                        : `Starts at ${formatTime(gig.gigStartTime)}`}
                    </p>
                  </div>
                </div>

                {gig.ticketLink && (
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
                      <Ticket className="h-5 w-5 text-accent-muted" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
                        Tickets
                      </h3>
                      <Link
                        href={gig.ticketLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white underline underline-offset-4 hover:text-accent-muted transition-colors"
                      >
                        {gig.ticketLink}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Past Gig Without Media */}
          {!upcoming && !hasMedia && (
            <div className="space-y-6">
              <div className="border-2 border-white/10 bg-black/80 backdrop-blur-sm p-6 sm:p-8 hover:border-accent-muted/50 transition-all">
                <h2 className="mb-6 text-2xl sm:text-3xl font-black tracking-wider uppercase border-l-4 border-accent-strong pl-4">
                  Event Details
                </h2>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
                      <Calendar className="h-5 w-5 text-accent-muted" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
                        Date
                      </h3>
                      <p className="text-lg font-bold">{formatDate(gig.gigStartTime, "long")}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-white/20 bg-black/50">
                      <Clock className="h-5 w-5 text-accent-muted" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
                        Time
                      </h3>
                      <p className="text-lg font-bold">
                        {gig.gigEndTime
                          ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                          : `Started at ${formatTime(gig.gigStartTime)}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coming Soon Message */}
              <div className="border-2 border-white/10 bg-black/80 backdrop-blur-sm p-8 text-center">
                <h2 className="mb-4 text-2xl sm:text-3xl font-black tracking-wider uppercase">
                  Photos & Videos
                </h2>
                <p className="text-lg text-white/60 font-bold uppercase tracking-wider">Coming Soon</p>
              </div>
            </div>
          )}

          {/* Past Gig With Media */}
          {!upcoming && hasMedia && (
            <div className="space-y-8">
              <div className="border-2 border-white/10 bg-black/80 backdrop-blur-sm p-6 sm:p-8 hover:border-accent-muted/50 transition-all">
                <h2 className="mb-4 text-2xl sm:text-3xl font-black tracking-wider uppercase border-l-4 border-accent-strong pl-4">
                  Event Details
                </h2>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-accent-muted" />
                    <span className="text-sm font-bold uppercase tracking-wider text-white/60">Date:</span>
                    <span className="text-base font-bold">{formatDate(gig.gigStartTime, "long")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-accent-muted" />
                    <span className="text-sm font-bold uppercase tracking-wider text-white/60">Time:</span>
                    <span className="text-base font-bold">
                      {gig.gigEndTime
                        ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                        : `Started at ${formatTime(gig.gigStartTime)}`}
                    </span>
                  </div>
                </div>
              </div>

              <MediaGallery media={gig.media} />
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
