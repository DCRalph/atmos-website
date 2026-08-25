"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Trash2, Settings2, Plus } from "lucide-react";
import {
  BlockRenderer,
  type PublicGigAttribution,
  type PublicSocial,
} from "./block-renderer";
import { InlineBlockEditor } from "./inline-block-editor";
import {
  applyLayoutChange,
  BLOCK_TYPES,
  findFreeSlot,
  fitRows,
  getBlockSizing,
  type ClientBlock,
} from "./block-types";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

type GridEditorProps = {
  blocks: ClientBlock[];
  onChange: (next: ClientBlock[]) => void;
  onSelectBlock: (id: string | null) => void;
  selectedBlockId: string | null;
  cols: number;
  rowHeightPx: number;
  /** Grid gap in px — must match the public grid's density gap, or blocks
   * arranged here land on a differently-spaced grid when published. */
  gapPx?: number;
  accent?: string | null;
  /** Real data for previews, so intrinsic blocks measure at their true size. */
  socials?: PublicSocial[];
  gigAttributions?: PublicGigAttribution[];
};

type DragState =
  | { kind: "idle" }
  | {
      kind: "move";
      blockId: string;
      startPointer: { x: number; y: number };
      startPos: { x: number; y: number };
    }
  | {
      kind: "resize";
      blockId: string;
      startPointer: { x: number; y: number };
      startSize: { w: number; h: number };
    };

/**
 * Grid editor with pointer-based drag & resize. We intentionally do not use
 * @dnd-kit here because absolute-positioned CSS grid resize requires custom
 * pointer arithmetic against the measured cell size.
 *
 * Intrinsic blocks (see `BlockSizing`) manage their own height: their content
 * is measured and `h` snaps to fit, and the resize handle only changes width.
 */
export function CreatorGridEditor({
  blocks,
  onChange,
  onSelectBlock,
  selectedBlockId,
  cols,
  rowHeightPx,
  gapPx = 12,
  accent,
  socials,
  gigAttributions,
}: GridEditorProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>({ kind: "idle" });
  const [hoverPreview, setHoverPreview] = useState<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const gridMetrics = useCallback(() => {
    const el = gridRef.current;
    if (!el) return { colWidth: 0, gapPx };
    const rect = el.getBoundingClientRect();
    const colWidth = (rect.width - gapPx * (cols - 1)) / cols;
    return { colWidth, gapPx };
  }, [cols, gapPx]);

  const toGridDelta = useCallback(
    (dx: number, dy: number) => {
      const { colWidth } = gridMetrics();
      const colStep = colWidth + gapPx;
      const rowStep = rowHeightPx + gapPx;
      return {
        dxCells: colStep > 0 ? Math.round(dx / colStep) : 0,
        dyCells: rowStep > 0 ? Math.round(dy / rowStep) : 0,
      };
    },
    [gridMetrics, gapPx, rowHeightPx],
  );

  // ---------------------------------------------------------------------
  // Intrinsic height fitting. Each intrinsic block registers its measurable
  // content node; one ResizeObserver watches them all and snaps every
  // mismatched `h` in a single onChange, so parallel corrections (e.g. on
  // first load) can't clobber each other with stale block arrays.
  // ---------------------------------------------------------------------
  const measureNodes = useRef(new Map<string, HTMLElement>());
  const measureRef = useCallback(
    (id: string) => (node: HTMLDivElement | null) => {
      if (node) measureNodes.current.set(id, node);
      else measureNodes.current.delete(id);
    },
    [],
  );

  useEffect(() => {
    if (drag.kind !== "idle") return; // don't fight an in-flight drag
    const fitAll = () => {
      let next = blocks;
      let changed = false;
      for (const [id, node] of measureNodes.current) {
        const block = next.find((b) => b.id === id);
        if (!block || getBlockSizing(block.type) !== "intrinsic") continue;
        const root = node.closest<HTMLElement>("[data-editor-block-type]");
        const header = root?.querySelector<HTMLElement>(
          "[data-editor-block-header]",
        );
        if (!root || !header) continue;
        const rootCs = getComputedStyle(root);
        const area = header.nextElementSibling
          ? getComputedStyle(header.nextElementSibling)
          : null;
        const chrome =
          header.offsetHeight +
          parseFloat(rootCs.borderTopWidth) +
          parseFloat(rootCs.borderBottomWidth) +
          (area
            ? parseFloat(area.paddingTop) + parseFloat(area.paddingBottom)
            : 0);
        const rows = fitRows(
          Math.ceil(node.offsetHeight + chrome),
          rowHeightPx,
          gapPx,
        );
        if (rows !== block.h) {
          next = applyLayoutChange(next, { ...block, h: rows }, cols);
          changed = true;
        }
      }
      if (changed) onChange(next);
    };

    const observer = new ResizeObserver(fitAll);
    for (const node of measureNodes.current.values()) observer.observe(node);
    return () => observer.disconnect();
  }, [blocks, cols, rowHeightPx, gapPx, onChange, drag.kind]);

  const onPointerDownMove = useCallback(
    (e: React.PointerEvent, block: ClientBlock) => {
      if (e.button !== 0) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onSelectBlock(block.id);
      setDrag({
        kind: "move",
        blockId: block.id,
        startPointer: { x: e.clientX, y: e.clientY },
        startPos: { x: block.x, y: block.y },
      });
    },
    [onSelectBlock],
  );

  const onPointerDownResize = useCallback(
    (e: React.PointerEvent, block: ClientBlock) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onSelectBlock(block.id);
      setDrag({
        kind: "resize",
        blockId: block.id,
        startPointer: { x: e.clientX, y: e.clientY },
        startSize: { w: block.w, h: block.h },
      });
    },
    [onSelectBlock],
  );

  useEffect(() => {
    if (drag.kind === "idle") return;
    const onMove = (e: PointerEvent) => {
      const block = blocks.find((b) => b.id === drag.blockId);
      if (!block) return;
      if (drag.kind === "move") {
        const { dxCells, dyCells } = toGridDelta(
          e.clientX - drag.startPointer.x,
          e.clientY - drag.startPointer.y,
        );
        const nextX = Math.max(
          0,
          Math.min(cols - block.w, drag.startPos.x + dxCells),
        );
        const nextY = Math.max(0, drag.startPos.y + dyCells);
        setHoverPreview({
          id: block.id,
          x: nextX,
          y: nextY,
          w: block.w,
          h: block.h,
        });
      } else if (drag.kind === "resize") {
        const { dxCells, dyCells } = toGridDelta(
          e.clientX - drag.startPointer.x,
          e.clientY - drag.startPointer.y,
        );
        const nextW = Math.max(
          1,
          Math.min(cols - block.x, drag.startSize.w + dxCells),
        );
        // Intrinsic blocks derive their height from content; only fill
        // blocks resize vertically.
        const nextH =
          getBlockSizing(block.type) === "intrinsic"
            ? block.h
            : Math.max(1, drag.startSize.h + dyCells);
        setHoverPreview({
          id: block.id,
          x: block.x,
          y: block.y,
          w: nextW,
          h: nextH,
        });
      }
    };
    const onUp = () => {
      if (hoverPreview) {
        const block = blocks.find((b) => b.id === hoverPreview.id);
        if (block) {
          const nextBlock: ClientBlock = {
            ...block,
            x: hoverPreview.x,
            y: hoverPreview.y,
            w: hoverPreview.w,
            h: hoverPreview.h,
          };
          const nextBlocks = applyLayoutChange(blocks, nextBlock, cols);
          onChange(nextBlocks);
        }
      }
      setHoverPreview(null);
      setDrag({ kind: "idle" });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [blocks, cols, drag, hoverPreview, onChange, toGridDelta]);

  const totalRows = useMemo(() => {
    const base = blocks.reduce((acc, b) => Math.max(acc, b.y + b.h), 0);
    return Math.max(6, base + 4);
  }, [blocks]);

  return (
    <div
      ref={gridRef}
      className="relative w-full"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridAutoRows: `${rowHeightPx}px`,
        gridGap: gapPx,
        minHeight: totalRows * (rowHeightPx + gapPx),
      }}
    >
      {/* Background grid lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(to right, rgba(127,127,127,0.12), rgba(127,127,127,0.12) 1px, transparent 1px, transparent calc((100% - ${
            (cols - 1) * gapPx
          }px) / ${cols} + ${gapPx}px)), repeating-linear-gradient(to bottom, rgba(127,127,127,0.07), rgba(127,127,127,0.07) 1px, transparent 1px, transparent ${
            rowHeightPx + gapPx
          }px)`,
        }}
      />

      {blocks.map((block) => {
        const isSelected = selectedBlockId === block.id;
        const intrinsic = getBlockSizing(block.type) === "intrinsic";
        const preview =
          hoverPreview?.id === block.id ? hoverPreview : null;
        const x = preview?.x ?? block.x;
        const y = preview?.y ?? block.y;
        const w = preview?.w ?? block.w;
        const h = preview?.h ?? block.h;
        return (
          <div
            key={block.id}
            data-editor-block-type={block.type}
            data-editor-block-size={`${w}x${h}`}
            className={cn(
              "group bg-card/50 relative flex flex-col overflow-hidden rounded-md border backdrop-blur",
              isSelected && "ring-primary ring-2",
              drag.kind !== "idle" &&
                drag.blockId === block.id &&
                "opacity-80 shadow-2xl",
            )}
            style={{
              gridColumn: `${x + 1} / span ${w}`,
              gridRow: `${y + 1} / span ${h}`,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) onSelectBlock(block.id);
            }}
          >
            {/* Block header */}
            <div
              data-editor-block-header
              className="bg-muted/30 flex flex-none items-center justify-between border-b px-2 py-1"
            >
              <button
                type="button"
                className="flex cursor-grab items-center gap-1 text-xs font-medium active:cursor-grabbing"
                onPointerDown={(e) => onPointerDownMove(e, block)}
                title="Drag to move"
              >
                <GripVertical className="h-3 w-3" />
                <span>{block.type}</span>
              </button>
              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => onSelectBlock(block.id)}
                  title="Configure"
                >
                  <Settings2 className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive h-6 w-6 p-0"
                  onClick={() =>
                    onChange(blocks.filter((b) => b.id !== block.id))
                  }
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {/* Content */}
            <div className="min-h-0 flex-1 p-2">
              {block.type === "RICH_TEXT" || block.type === "HEADING" ? (
                <div className="flex h-full flex-col justify-center">
                  <div ref={measureRef(block.id)} className="min-w-0 flow-root">
                    <InlineBlockEditor
                      block={block}
                      onChange={(nb) =>
                        onChange(blocks.map((b) => (b.id === nb.id ? nb : b)))
                      }
                      onFocus={() => onSelectBlock(block.id)}
                    />
                  </div>
                </div>
              ) : intrinsic ? (
                <div className="pointer-events-none flex h-full flex-col justify-center">
                  <div ref={measureRef(block.id)} className="min-w-0 flow-root">
                    <BlockRenderer
                      block={block}
                      socials={socials}
                      gigAttributions={gigAttributions}
                      accent={accent}
                    />
                  </div>
                </div>
              ) : (
                <div className="pointer-events-none h-full w-full">
                  <BlockRenderer
                    block={block}
                    socials={socials}
                    gigAttributions={gigAttributions}
                    accent={accent}
                  />
                </div>
              )}
            </div>
            {/* Resize handle */}
            <div
              onPointerDown={(e) => onPointerDownResize(e, block)}
              className={cn(
                "bg-primary/40 hover:bg-primary absolute right-0 bottom-0 h-4 w-4 rounded-tl-md",
                intrinsic ? "cursor-ew-resize" : "cursor-nwse-resize",
              )}
              title={
                intrinsic
                  ? "Drag to resize width (height follows content)"
                  : "Drag to resize"
              }
            />
          </div>
        );
      })}
    </div>
  );
}

export function AddBlockPopover({
  blocks,
  cols,
  onAdd,
}: {
  blocks: ClientBlock[];
  cols: number;
  onAdd: (block: ClientBlock) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add block
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-96 w-80 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          {BLOCK_TYPES.map((def) => (
            <button
              key={def.type}
              type="button"
              onClick={() => {
                const pos = findFreeSlot(
                  blocks,
                  cols,
                  def.defaultW,
                  def.defaultH,
                );
                const newBlock: ClientBlock = {
                  id: `tmp_${Math.random().toString(36).slice(2, 10)}`,
                  isNew: true,
                  type: def.type,
                  x: pos.x,
                  y: pos.y,
                  w: def.defaultW,
                  h: def.defaultH,
                  data: { ...def.defaultData },
                };
                onAdd(newBlock);
                setOpen(false);
              }}
              className="hover:bg-accent/40 rounded-md border p-2 text-left transition-colors"
            >
              <div className="text-sm font-medium">{def.label}</div>
              <div className="text-muted-foreground text-xs">
                {def.description}
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
