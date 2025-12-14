import Link from "next/link";
import { formatDate } from "~/lib/date-utils";
import { Badge } from "~/components/ui/badge";
import { isLightColor } from "~/lib/utils";
import { motion } from "framer-motion";

type Gig = {
  id: string;
  gigStartTime: Date;
  title: string;
  subtitle: string;
  media?: Array<unknown> | null;
  gigTags?: Array<{ gigTag: { id: string; name: string; color: string } }> | null;
};

type PastGigCardProps = {
  gig: Gig;
};

export function PastGigCard({ gig }: PastGigCardProps) {
  return (
    <motion.a
      href={`/gigs/${gig.id}`}
      className="group rounded-lg shadow-glass border border-zinc/20 bg-black/20 p-4 sm:p-6 backdrop-blur-sm transition-all hover:border-zinc/50 hover:bg-black/30"
    >
      <h3 className="text-base sm:text-lg font-semibold mb-2">{gig.title}</h3>
      <p className="text-white/60 text-sm sm:text-base mb-2">{gig.subtitle}</p>
      <div className="text-lg sm:text-xl font-bold mb-2">
        {formatDate(gig.gigStartTime)}
      </div>
      {gig.gigTags && gig.gigTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
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
      {gig.media && gig.media.length > 0 && (
        <p className="text-xs sm:text-sm text-white/60">
          {gig.media.length} {gig.media.length === 1 ? "media item" : "media items"}
        </p>
      )}
    </motion.a>
  );
}

