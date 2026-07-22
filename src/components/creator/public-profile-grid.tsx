"use client";

import {
  BlockRenderer,
  type PublicBlock,
  type PublicGigAttribution,
  type PublicSocial,
} from "./block-renderer";
import {
  DEFAULT_THEME_TOKENS,
  themeToCssVars,
  type BlockOverrides,
  type ThemeTokens,
} from "~/lib/creator-theme";

type Props = {
  blocks: PublicBlock[];
  socials: PublicSocial[];
  gigAttributions: PublicGigAttribution[];
  cols: number;
  rowHeightPx: number;
  accent?: string | null;
  tokens?: ThemeTokens;
  blockOverrides?: BlockOverrides;
};

export function PublicProfileGrid({
  blocks,
  socials,
  gigAttributions,
  cols,
  rowHeightPx,
  accent,
  tokens = DEFAULT_THEME_TOKENS,
  blockOverrides = {},
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
        className="hidden md:grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridAutoRows: `${rowHeightPx}px`,
          gap: "var(--creator-density-gap)",
        }}
      >
        {blocks.map((b) => (
          <div
            key={b.id}
            className="creator-block overflow-hidden"
            style={{
              ...themeToCssVars(tokens, blockOverrides, b.type),
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
      <div
        className="flex md:hidden flex-col"
        style={{ gap: "var(--creator-density-gap)" }}
      >
        {[...blocks]
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((b) => (
            <div
              key={b.id}
              className="creator-block"
              style={{
                ...themeToCssVars(tokens, blockOverrides, b.type),
                minHeight: `${Math.max(2, b.h) * rowHeightPx}px`,
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
    </>
  );
}
