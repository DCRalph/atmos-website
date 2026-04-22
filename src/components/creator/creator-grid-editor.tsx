"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Trash2, Settings2, Plus } from "lucide-react";
import { BlockRenderer } from "./block-renderer";
import { InlineBlockEditor } from "./inline-block-editor";
import {
  applyLayoutChange,
  BLOCK_TYPES,
  findFreeSlot,
  type ClientBlock,
  type CreatorBlockTypeName,
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
  accent?: string | null;
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
 */
export function CreatorGridEditor({
  blocks,
  onChange,
  onSelectBlock,
  selectedBlockId,
  cols,
  rowHeightPx,
  accent,
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
    if (!el) return { colWidth: 0, gapPx: 16 };
    const rect = el.getBoundingClientRect();
    const gapPx = 16;
    const colWidth = (rect.width - gapPx * (cols - 1)) / cols;
    return { colWidth, gapPx };
  }, [cols]);

  const toGridDelta = useCallback(
    (dx: number, dy: number) => {
      const { colWidth, gapPx } = gridMetrics();
      const colStep = colWidth + gapPx;
      const rowStep = rowHeightPx + gapPx;
      return {
        dxCells: colStep > 0 ? Math.round(dx / colStep) : 0,
        dyCells: rowStep > 0 ? Math.round(dy / rowStep) : 0,
      };
    },
    [gridMetrics, rowHeightPx],
  );

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
        const nextH = Math.max(1, drag.startSize.h + dyCells);
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
        gridGap: 16,
        minHeight: totalRows * (rowHeightPx + 16),
      }}
    >
      {/* Background grid lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(to right, rgba(127,127,127,0.12), rgba(127,127,127,0.12) 1px, transparent 1px, transparent calc((100% - ${
            (cols - 1) * 16
          }px) / ${cols} + 16px)), repeating-linear-gradient(to bottom, rgba(127,127,127,0.07), rgba(127,127,127,0.07) 1px, transparent 1px, transparent ${
            rowHeightPx + 16
          }px)`,
        }}
      />

      {blocks.map((block) => {
        const isSelected = selectedBlockId === block.id;
        const preview =
          hoverPreview && hoverPreview.id === block.id ? hoverPreview : null;
        const x = preview?.x ?? block.x;
        const y = preview?.y ?? block.y;
        const w = preview?.w ?? block.w;
        const h = preview?.h ?? block.h;
        return (
          <div
            key={block.id}
            className={cn(
              "group relative bg-card/50 backdrop-blur rounded-md border overflow-hidden",
              isSelected && "ring-2 ring-primary",
              drag.kind !== "idle" &&
                drag.blockId === block.id &&
                "shadow-2xl opacity-80",
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
            <div className="flex items-center justify-between border-b bg-muted/30 px-2 py-1">
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium cursor-grab active:cursor-grabbing"
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
                  className="h-6 w-6 p-0 text-destructive"
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
            <div className="p-2 h-[calc(100%-28px)]">
              {block.type === "RICH_TEXT" || block.type === "HEADING" ? (
                <div className="h-full w-full">
                  <InlineBlockEditor
                    block={block}
                    onChange={(nb) =>
                      onChange(
                        blocks.map((b) => (b.id === nb.id ? nb : b)),
                      )
                    }
                    onFocus={() => onSelectBlock(block.id)}
                  />
                </div>
              ) : (
                <div className="pointer-events-none h-full w-full">
                  <BlockRenderer block={block} accent={accent} />
                </div>
              )}
            </div>
            {/* Resize handle */}
            <div
              onPointerDown={(e) => onPointerDownResize(e, block)}
              className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize bg-primary/40 hover:bg-primary rounded-tl-md"
              title="Drag to resize"
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
      <PopoverContent className="w-80 p-2 max-h-96 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {BLOCK_TYPES.map((def) => (
            <button
              key={def.type}
              type="button"
              onClick={() => {
                const pos = findFreeSlot(blocks, cols, def.defaultW, def.defaultH);
                const newBlock: ClientBlock = {
                  id: `tmp_${Math.random().toString(36).slice(2, 10)}`,
                  isNew: true,
                  type: def.type as CreatorBlockTypeName,
                  x: pos.x,
                  y: pos.y,
                  w: def.defaultW,
                  h: def.defaultH,
                  data: { ...def.defaultData },
                };
                onAdd(newBlock);
                setOpen(false);
              }}
              className="text-left rounded-md border p-2 hover:bg-accent/40 transition-colors"
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
