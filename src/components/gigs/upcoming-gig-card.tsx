import Link from "next/link";
import { formatDate, formatTime } from "~/lib/date-utils";
import { Badge } from "~/components/ui/badge";
import { isLightColor } from "~/lib/utils";

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
    <div
      className="group flex shadow-glass flex-col gap-4 rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10 md:flex-row md:items-center md:justify-between"
    >
      <Link href={`/gigs/${gig.id}`} className="flex-1">
        <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <span className="text-xl sm:text-2xl font-bold">
            {formatDate(gig.gigStartTime)}
          </span>
          <div className="flex-1">
            <h3 className="text-lg sm:text-xl font-semibold">{gig.title}</h3>
            <p className="text-white/60 text-sm sm:text-base">{gig.subtitle}</p>
            {gig.gigTags && gig.gigTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {gig.gigTags.map((gt) => (
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
              </div>
            )}
          </div>
        </div>
        <p className="text-xs sm:text-sm text-white/60">
          {gig.gigEndTime
            ? `${formatTime(gig.gigStartTime)} - ${formatTime(gig.gigEndTime)}`
            : `Starts at ${formatTime(gig.gigStartTime)}`}
        </p>
      </Link>
      <div className="flex gap-2">
        <Link
          href={`/gigs/${gig.id}`}
          className="rounded-md border border-white/30 bg-white/10 px-4 sm:px-6 py-2 sm:py-3 text-center font-semibold text-white transition-all hover:bg-white/20 text-sm sm:text-base"
        >
          View Details
        </Link>
        {gig.ticketLink && (
          <a
            href={gig.ticketLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-white px-4 sm:px-6 py-2 sm:py-3 text-center font-semibold text-black transition-all hover:bg-white/90 text-sm sm:text-base"
            onClick={(e) => e.stopPropagation()}
          >
            Get Tickets
          </a>
        )}
      </div>
    </div>
  );
}

