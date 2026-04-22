"use client";

import {
  BlockRenderer,
  type PublicBlock,
  type PublicGigAttribution,
  type PublicSocial,
} from "./block-renderer";

type Props = {
  blocks: PublicBlock[];
  socials: PublicSocial[];
  gigAttributions: PublicGigAttribution[];
  cols: number;
  rowHeightPx: number;
  accent?: string | null;
};

export function PublicProfileGrid({
  blocks,
  socials,
  gigAttributions,
  cols,
  rowHeightPx,
  accent,
}: Props) {
  if (blocks.length === 0) {
    return (
      <div className="text-muted-foreground py-16 text-center text-sm">
        Nothing here yet.
      </div>
    );
  }
  return (
    <>
      {/* Desktop: css grid */}
      <div
        className="hidden md:grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridAutoRows: `${rowHeightPx}px`,
        }}
      >
        {blocks.map((b) => (
          <div
            key={b.id}
            className="overflow-hidden"
            style={{
              gridColumn: `${b.x + 1} / span ${b.w}`,
              gridRow: `${b.y + 1} / span ${b.h}`,
            }}
          >
            <BlockRenderer
              block={b}
              socials={socials}
              gigAttributions={gigAttributions}
              accent={accent}
            />
          </div>
        ))}
      </div>
      {/* Mobile: single column */}
      <div className="flex md:hidden flex-col gap-4">
        {[...blocks]
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((b) => (
            <div
              key={b.id}
              style={{ minHeight: `${Math.max(2, b.h) * rowHeightPx}px` }}
            >
              <BlockRenderer
                block={b}
                socials={socials}
                gigAttributions={gigAttributions}
                accent={accent}
              />
            </div>
          ))}
      </div>
    </>
  );
}
