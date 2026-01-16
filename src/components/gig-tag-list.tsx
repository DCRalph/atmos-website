"use client";

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

type GigTag = {
  id: string;
  name: string;
  color: string;
};

type GigTagRelationship = {
  gigTag: GigTag;
};

export function GigTagList({
  gigTags,
  max,
  size = "sm",
  className,
  showOverflowCount = false,
}: {
  gigTags?: GigTagRelationship[] | null;
  max?: number;
  size?: "sm" | "md";
  className?: string;
  showOverflowCount?: boolean;
}) {
  if (!gigTags || gigTags.length === 0) return null;

  const tagsToShow = typeof max === "number" ? gigTags.slice(0, max) : gigTags;
  const overflowCount =
    typeof max === "number" ? Math.max(0, gigTags.length - max) : 0;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {tagsToShow.map((gt) => {
        return <GigTag key={gt.gigTag.id} gigTag={gt.gigTag} size={size} />;
      })}

      {showOverflowCount && overflowCount > 0 ? (
        <span className="rounded-none border-2 border-white/20 bg-black/40 px-3 py-1 text-xs font-black text-white/70 uppercase">
          +{overflowCount}
        </span>
      ) : null}
    </div>
  );
}

function GigTag({ gigTag, size }: { gigTag: GigTag; size: "sm" | "md" }) {
  const badgeClass = cn(
    "rounded-none border-2 font-bold uppercase tracking-wide",
    size === "sm" ? "px-1 text-[10px]" : "px-3 py-1 text-sm",
  );

  const color = gigTag.color;
  const style: React.CSSProperties = {
    backgroundColor: `${color}20`,
    borderColor: color,
    color: "white",
  };

  return (
    <Badge variant="outline" className={badgeClass} style={style}>
      {gigTag.name}
    </Badge>
  );
}
