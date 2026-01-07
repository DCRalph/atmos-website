import Link from "next/link";
import { formatDate, formatTime } from "~/lib/date-utils";
import { Badge } from "~/components/ui/badge";
import { motion } from "framer-motion";

type Gig = {
  id: string;
  gigStartTime: Date;
  title: string;
  subtitle: string;
  gigEndTime?: Date | null;
  ticketLink?: string | null;
  gigTags?: Array<{ gigTag: { id: string; name: string; color: string } }> | null;
};

type UpcomingGigCardProps = {
  gig: Gig;
};

export function UpcomingGigCard({ gig }: UpcomingGigCardProps) {
  return (
    <motion.div
      className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6 shadow-glass backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Link wrapper for the entire card except buttons */}
      <Link href={`/gigs/${gig.id}`} className="block">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
          {/* Date/Time Section */}
          <div className="flex shrink-0 flex-col items-start md:w-32 lg:w-40">
            <div className="text-2xl font-bold leading-tight md:text-3xl">
              {formatDate(gig.gigStartTime)}
            </div>
            <div className="mt-1 text-sm text-white/60">
              {gig.gigEndTime
                ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
                : `${formatTime(gig.gigStartTime)}`}
            </div>
          </div>

          {/* Event Details Section */}
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-xl font-semibold leading-tight md:text-2xl">
                {gig.title}
              </h3>
              <p className="mt-1 text-sm text-white/60 md:text-base">
                {gig.subtitle}
              </p>
            </div>

            {/* Tags */}
            {gig.gigTags && gig.gigTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {gig.gigTags.map((gt) => (
                  <Badge
                    key={gt.gigTag.id}
                    variant="outline"
                    className="rounded-full text-xs"
                    style={{
                      backgroundColor: gt.gigTag.color + "20",
                      borderColor: gt.gigTag.color,
                      color: gt.gigTag.color,
                    }}
                  >
                    {gt.gigTag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row md:mt-4 md:justify-end">
        <Link
          href={`/gigs/${gig.id}`}
          className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-center text-sm font-medium text-white transition-all hover:border-white/40 hover:bg-white/10 sm:flex-none sm:px-6"
        >
          View Details
        </Link>
        {gig.ticketLink && (
          <a
            href={gig.ticketLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-black transition-all hover:bg-white/90 sm:flex-none sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            Get Tickets
          </a>
        )}
      </div>
    </motion.div>
  );
}