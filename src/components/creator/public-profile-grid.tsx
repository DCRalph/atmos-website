"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BlockRenderer,
  blockHasContent,
  type PublicBlock,
  type PublicGigAttribution,
  type PublicSocial,
} from "./block-renderer";
import {
  fitLayout,
  fitRows,
  getBlockSizing,
  type CreatorBlockTypeName,
} from "./block-types";
import {
  DEFAULT_THEME_TOKENS,
  densityGapPx,
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

/** Blocks that render as bare marks, without the themed card surface. */
const CHROMELESS = new Set<CreatorBlockTypeName>(["DIVIDER", "SPACER"]);

const CHROMELESS_STYLE: React.CSSProperties = {
  background: "transparent",
  border: "none",
  boxShadow: "none",
  padding: 0,
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
  const gapPx = densityGapPx(tokens.density);

  // Blocks with nothing to show ("No image selected", empty link lists, …)
  // are editor placeholders; a published page simply skips them.
  const visible = useMemo(
    () => blocks.filter((b) => blockHasContent(b, socials, gigAttributions)),
    [blocks, socials, gigAttributions],
  );

  // Measured "needed box height" (content + the block's padding and border)
  // per intrinsic block. Empty until the client measures, so the server and
  // first client render agree and hydration stays clean.
  const [neededPx, setNeededPx] = useState<Record<string, number>>({});

  // Intrinsic blocks get their row span from their rendered content: the
  // stored h is only the editor's estimate at the editor's width. Fill blocks
  // keep the height the user gave them. The layout re-packs around any
  // corrected heights, preserving arrangement.
  const layout = useMemo(
    () =>
      fitLayout(visible, (b) => {
        if (getBlockSizing(b.type) !== "intrinsic") return b.h;
        const needed = neededPx[b.id];
        if (needed === undefined) return b.h;
        return fitRows(needed, rowHeightPx, gapPx);
      }),
    [visible, neededPx, rowHeightPx, gapPx],
  );

  // Ref for the measurable content of one intrinsic block. The ResizeObserver
  // reports content height; the block's own padding/border are read off the
  // computed style so per-type theme overrides are respected.
  const measureRef = useCallback(
    (id: string) => (node: HTMLDivElement | null) => {
      if (!node) return;
      const observer = new ResizeObserver(() => {
        const root = node.closest(".creator-block");
        const cs = root ? getComputedStyle(root) : null;
        const chrome = cs
          ? parseFloat(cs.paddingTop) +
            parseFloat(cs.paddingBottom) +
            parseFloat(cs.borderTopWidth) +
            parseFloat(cs.borderBottomWidth)
          : 0;
        const needed = Math.ceil(node.offsetHeight + chrome);
        setNeededPx((prev) =>
          prev[id] === needed ? prev : { ...prev, [id]: needed },
        );
      });
      observer.observe(node);
      return () => observer.disconnect();
    },
    [],
  );

  if (visible.length === 0) {
    return (
      <div className="text-muted-foreground py-16 text-center text-sm">
        Nothing here yet.
      </div>
    );
  }

  const blockStyle = (b: PublicBlock): React.CSSProperties => ({
    ...themeToCssVars(tokens, blockOverrides, b.type),
    ...(CHROMELESS.has(b.type) ? CHROMELESS_STYLE : {}),
  });

  return (
    <>
      {/* Desktop: css grid */}
      <div
        className="hidden md:grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridAutoRows: `${rowHeightPx}px`,
          gap: `${gapPx}px`,
        }}
      >
        {layout.map((b) => (
          <div
            key={b.id}
            className="creator-block overflow-hidden"
            data-block-type={b.type}
            data-block-size={`${b.w}x${b.h}`}
            style={{
              ...blockStyle(b),
              gridColumn: `${b.x + 1} / span ${b.w}`,
              gridRow: `${b.y + 1} / span ${b.h}`,
            }}
          >
            {getBlockSizing(b.type) === "intrinsic" ? (
              <div className="flex h-full flex-col justify-center">
                {/* flow-root so child margins can't collapse out of the measurement */}
                <div ref={measureRef(b.id)} className="min-w-0 flow-root">
                  <BlockRenderer
                    block={b}
                    socials={socials}
                    gigAttributions={gigAttributions}
                    accent={accent}
                  />
                </div>
              </div>
            ) : (
              <BlockRenderer
                block={b}
                socials={socials}
                gigAttributions={gigAttributions}
                accent={accent}
              />
            )}
          </div>
        ))}
      </div>
      {/* Mobile: single column. Intrinsic blocks hug their content; fill
          blocks keep the height they were given on the grid. */}
      <div
        className="flex flex-col md:hidden"
        style={{ gap: `${gapPx}px` }}
      >
        {[...visible]
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((b) => (
            <div
              key={b.id}
              className="creator-block overflow-hidden"
              data-block-type={b.type}
              data-block-size={`${b.w}x${b.h}`}
              style={{
                ...blockStyle(b),
                ...(getBlockSizing(b.type) === "fill"
                  ? { height: `${b.h * rowHeightPx + (b.h - 1) * gapPx}px` }
                  : {}),
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
