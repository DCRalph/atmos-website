import Link from "next/link";
import { formatDate } from "~/lib/date-utils";

type Gig = {
  id: string;
  gigStartTime: Date;
  title: string;
  subtitle: string;
  media?: Array<unknown> | null;
};

type PastGigCardProps = {
  gig: Gig;
};

export function PastGigCard({ gig }: PastGigCardProps) {
  return (
    <Link
      href={`/gigs/${gig.id}`}
      className="group rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
    >
      <h3 className="text-base sm:text-lg font-semibold mb-2">{gig.title}</h3>
      <p className="text-white/60 text-sm sm:text-base mb-2">{gig.subtitle}</p>
      <div className="text-lg sm:text-xl font-bold mb-2">
        {formatDate(gig.gigStartTime)}
      </div>
      {gig.media && gig.media.length > 0 && (
        <p className="text-xs sm:text-sm text-white/60">
          {gig.media.length} {gig.media.length === 1 ? "media item" : "media items"}
        </p>
      )}
    </Link>
  );
}

