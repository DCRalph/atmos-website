"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { buildMediaUrl } from "~/lib/media-url";
import { ScrollContainerContext } from "~/components/scroll-container-provider";
import { getBlockDef, type ClientBlock } from "~/lib/artist-blocks";
import {
  GRID,
  STEP,
  moveBlock,
  normalize,
  pxToRows,
  readingOrder,
  resizeBlock,
  rowsToPx,
  type Rect,
} from "~/lib/artist-grid";
import { toSection, type SectionContext } from "~/lib/artist-sections";
import { BlockCell, Section, type SectionProps } from "../sections";
import { BLOCK_ICONS, EMPTY_HINTS } from "./block-meta";
import { duplicate, remove } from "./actions";
import { useEditor, type EditorStore } from "./store";

/** Which part of a block is being dragged: the block, or an edge to resize it. */
type Grab = "move" | "e" | "s" | "se";

type Target = {
  id: string;
  grab: Grab;
  /** Where the block was when the drag started (a moving block stays drawn there). */
  start: Rect;
} & Rect;

type Drag = {
  id: string;
  grab: Grab;
  start: Rect;
  minW: number;
  minH: number;
  auto: boolean;
  from: { x: number; y: number; scroll: number };
  pointer: { x: number; y: number };
  colStep: number;
  active: boolean;
};

const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * The artist's grid in edit mode. On a laptop or tablet: drag a block to move
 * it, drag its edges to resize it, click it for its settings. On a phone the
 * blocks stack as visitors see them and a tap opens a block's settings;
 * arranging the grid waits for a bigger screen.
 */
export default function EditorGrid({
  store,
  ...props
}: SectionProps & { store: EditorStore }) {
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );
  return wide ? (
    <Grid store={store} {...props} />
  ) : (
    <List store={store} {...props} />
  );
}

function useSectionContext(profile: SectionProps["profile"]): SectionContext {
  const { socials, upcoming, past } = profile;
  return useMemo(
    () => ({
      socials: socials.length,
      upcoming: upcoming.length,
      past: past.length,
      mediaUrl: buildMediaUrl,
    }),
    [socials.length, upcoming.length, past.length],
  );
}

function Grid({ store, ...props }: SectionProps & { store: EditorStore }) {
  const blocks = useEditor(store, (s) => s.blocks);
  const selectedId = useEditor(store, (s) => s.selectedId);
  const scrollRef = useContext(ScrollContainerContext);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const targetRef = useRef<Target | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const ctx = useSectionContext(props.profile);
  const measure = useMeasure(store);

  const preview = useMemo(
    () => (target ? apply(blocks, target) : blocks),
    [blocks, target],
  );
  const bottom = Math.max(0, ...preview.map((b) => b.y + b.h));

  useEffect(() => {
    const scroller = () => scrollRef?.current ?? null;
    let raf = 0;
    let speed = 0;

    const update = () => {
      const d = dragRef.current;
      if (!d) return;
      const dx = d.pointer.x - d.from.x;
      const dy =
        d.pointer.y - d.from.y + ((scroller()?.scrollTop ?? 0) - d.from.scroll);
      if (!d.active) {
        if (Math.hypot(dx, dy) < 5) return;
        d.active = true;
        store.setState({ dragging: true });
        store.getState().select(d.id);
      }
      const cols = Math.round(dx / d.colStep);
      const rows = Math.round(dy / STEP);
      const rect =
        d.grab === "move"
          ? {
              ...d.start,
              x: d.start.x + cols,
              y: Math.max(0, d.start.y + rows),
            }
          : {
              ...d.start,
              w:
                d.grab === "s"
                  ? d.start.w
                  : Math.min(
                      GRID.cols - d.start.x,
                      Math.max(d.minW, d.start.w + cols),
                    ),
              h:
                d.grab === "e" || d.auto
                  ? d.start.h
                  : Math.max(d.minH, d.start.h + rows),
            };
      const prev = targetRef.current;
      const same =
        prev?.x === rect.x &&
        prev.y === rect.y &&
        prev.w === rect.w &&
        prev.h === rect.h;
      if (!same) {
        const next = { id: d.id, grab: d.grab, start: d.start, ...rect };
        targetRef.current = next;
        setTarget(next);
      }
      if (d.grab === "move") {
        const el = gridRef.current?.querySelector<HTMLElement>(
          `[data-block-id="${d.id}"]`,
        );
        if (el) el.style.translate = `${dx}px ${dy}px`;
      }
      // Scroll when the pointer nears the top or bottom of the window.
      const edge = 90;
      speed =
        d.pointer.y < edge
          ? -Math.ceil((edge - d.pointer.y) / 5)
          : d.pointer.y > window.innerHeight - edge
            ? Math.ceil((d.pointer.y - (window.innerHeight - edge)) / 5)
            : 0;
      if (speed && !raf) raf = requestAnimationFrame(tick);
    };

    const tick = () => {
      raf = 0;
      const el = scroller();
      if (!speed || !el || !dragRef.current?.active) return;
      el.scrollTop += speed;
      update();
    };

    const finish = (keep: boolean) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      speed = 0;
      if (!d) return;
      const el = gridRef.current?.querySelector<HTMLElement>(
        `[data-block-id="${d.id}"]`,
      );
      if (el) el.style.translate = "";
      const t = targetRef.current;
      targetRef.current = null;
      setTarget(null);
      if (d.active) {
        store.setState({ dragging: false });
        if (keep && t) store.getState().commit((current) => apply(current, t));
      }
    };

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      d.pointer = { x: e.clientX, y: e.clientY };
      update();
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragRef.current?.active) {
        e.stopPropagation();
        finish(false);
      }
    };
    const scroll = scroller();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    scroll?.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
      scroll?.removeEventListener("scroll", update);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollRef, store]);

  const begin = useCallback(
    (e: ReactPointerEvent, block: ClientBlock, grab: Grab) => {
      const grid = gridRef.current;
      if (e.button !== 0 || !grid || dragRef.current) return;
      e.stopPropagation();
      if (grab !== "move") e.preventDefault();
      const def = getBlockDef(block.type);
      dragRef.current = {
        id: block.id,
        grab,
        start: { x: block.x, y: block.y, w: block.w, h: block.h },
        minW: Math.min(def.minW, GRID.cols - block.x),
        minH: def.minH,
        auto: def.sizing === "auto",
        from: {
          x: e.clientX,
          y: e.clientY,
          scroll: scrollRef?.current?.scrollTop ?? 0,
        },
        pointer: { x: e.clientX, y: e.clientY },
        colStep: (grid.clientWidth + GRID.gap) / GRID.cols,
        active: false,
      };
    },
    [scrollRef],
  );

  // Keep the selected block in view (after adding one, or moving it by keyboard).
  useEffect(() => {
    const el = selectedId
      ? gridRef.current?.querySelector<HTMLElement>(
          `[data-block-id="${selectedId}"]`,
        )
      : null;
    const scroller = scrollRef?.current;
    if (!el || !scroller || dragRef.current) return;
    const box = el.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    const margin = 120;
    if (box.top < view.top + margin)
      scroller.scrollBy({
        top: box.top - view.top - margin,
        behavior: "smooth",
      });
    else if (box.top > view.bottom - margin)
      scroller.scrollBy({
        top: box.top - view.top - margin,
        behavior: "smooth",
      });
  }, [selectedId, scrollRef]);

  const moving = target?.grab === "move" ? target : null;
  const placeholder = moving ? preview.find((b) => b.id === moving.id) : null;

  return (
    <div>
      <div
        ref={gridRef}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) store.getState().select(null);
        }}
        className="relative grid grid-cols-12"
        style={{
          gridAutoRows: GRID.row,
          gap: GRID.gap,
          minHeight: rowsToPx(Math.max(bottom, 1)),
        }}
      >
        <Guides strong={!!target} />
        {placeholder ? (
          <div
            aria-hidden
            className="rounded-[var(--cp-r-media)] border-2 border-dashed border-[var(--ed-line)] bg-[color-mix(in_oklab,var(--ed-line)_10%,transparent)]"
            style={place(placeholder)}
          />
        ) : null}
        {preview.map((block) => (
          <EditorBlock
            key={block.id}
            block={block}
            rect={moving?.id === block.id ? moving.start : block}
            section={toSection(block, ctx)}
            selected={block.id === selectedId}
            dragged={target?.id === block.id}
            measure={measure}
            onBegin={begin}
            store={store}
            {...props}
          />
        ))}
      </div>
      <AddTile store={store} empty={!blocks.length} />
    </div>
  );
}

/** A drag's result: the block moved or resized, everything else settled round it. */
function apply(blocks: ClientBlock[], t: Target) {
  if (t.grab === "move") return moveBlock(blocks, t.id, t);
  const block = blocks.find((b) => b.id === t.id);
  const auto = block && getBlockDef(block.type).sizing === "auto";
  return resizeBlock(
    blocks,
    t.id,
    t.grab === "e" || auto
      ? { w: t.w }
      : t.grab === "s"
        ? { h: t.h }
        : { w: t.w, h: t.h },
  );
}

const place = (r: Rect): CSSProperties => ({
  gridColumn: `${r.x + 1} / span ${r.w}`,
  gridRow: `${r.y + 1} / span ${r.h}`,
});

/** The 12 columns, shown while a block is dragged or resized. */
function Guides({ strong }: { strong: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 grid grid-cols-12 transition-opacity duration-200",
        strong ? "opacity-100" : "opacity-0",
      )}
      style={{ columnGap: GRID.gap }}
    >
      {Array.from({ length: GRID.cols }, (_, i) => (
        <div
          key={i}
          className="bg-[color-mix(in_oklab,var(--ed-line)_7%,transparent)] shadow-[inset_1px_0_0_color-mix(in_oklab,var(--ed-line)_22%,transparent),inset_-1px_0_0_color-mix(in_oklab,var(--ed-line)_22%,transparent)]"
        />
      ))}
    </div>
  );
}

/**
 * Measures blocks that size to their content and gives them the rows they
 * need. One observer for the grid; each block registers its content box.
 */
function useMeasure(store: EditorStore) {
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(() => () => observer.current?.disconnect(), []);
  return useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      observer.current ??= new ResizeObserver((entries) => {
        const rows = new Map<string, number>();
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.measure;
          if (id && entry.target.isConnected)
            rows.set(id, pxToRows((entry.target as HTMLElement).offsetHeight));
        }
        store.getState().adjust((blocks) => {
          let changed = false;
          const next = blocks.map((b) => {
            const h = rows.get(b.id);
            if (h === undefined || h === b.h) return b;
            changed = true;
            return { ...b, h };
          });
          return changed ? normalize(next) : blocks;
        });
      });
      const ro = observer.current;
      ro.observe(el);
      return () => ro.unobserve(el);
    },
    [store],
  );
}

function EditorBlock({
  block,
  rect,
  section,
  selected,
  dragged,
  measure,
  onBegin,
  store,
  ...props
}: SectionProps & {
  block: ClientBlock;
  rect: Rect;
  section: ReturnType<typeof toSection>;
  selected: boolean;
  dragged: boolean;
  measure: (el: HTMLElement | null) => void;
  onBegin: (e: ReactPointerEvent, block: ClientBlock, grab: Grab) => void;
  store: EditorStore;
}) {
  const def = getBlockDef(block.type);
  const fill = def.sizing === "fill";
  const Icon = BLOCK_ICONS[block.type];
  const content = (
    <BlockCell
      section={block}
      className={cn("pointer-events-none", fill && "h-full")}
    >
      {block.type === "SPACER" ? (
        <div className="flex-1 rounded-[var(--cp-r-media)] bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--cp-ink)_7%,transparent)_0_2px,transparent_2px_10px)]" />
      ) : section ? (
        <Section section={section} {...props} />
      ) : (
        <Placeholder block={block} fill={fill} />
      )}
    </BlockCell>
  );

  return (
    <div
      data-block-id={block.id}
      onPointerDown={(e) => {
        if (e.pointerType !== "touch") onBegin(e, block, "move");
      }}
      onClick={() => store.getState().select(block.id)}
      className={cn(
        "group/block relative cursor-grab outline-offset-[6px] select-none",
        selected
          ? "z-10 outline-2 outline-[var(--ed-line)] outline-solid"
          : "outline-1 outline-[color-mix(in_oklab,var(--cp-ink)_20%,transparent)] outline-dashed hover:outline-[var(--ed-line)] hover:outline-solid",
        dragged &&
          "z-30 cursor-grabbing bg-[var(--cp-ground)] shadow-[0_28px_60px_-16px_rgb(0_0_0/0.7)]",
      )}
      style={place(rect)}
    >
      {fill ? (
        content
      ) : (
        <div ref={measure} data-measure={block.id}>
          {content}
        </div>
      )}

      <div
        className={cn(
          "absolute -top-[30px] right-3 left-3 z-10 flex items-start justify-between gap-2 transition-opacity",
          selected
            ? "opacity-100"
            : "opacity-0 group-focus-within/block:opacity-100 group-hover/block:opacity-100",
          dragged && "opacity-0",
        )}
      >
        <button
          type="button"
          aria-label={`Drag ${def.label}`}
          onPointerDown={(e) => onBegin(e, block, "move")}
          className="t-label inline-flex h-7 cursor-grab touch-none items-center gap-1.5 rounded-full bg-[var(--ed)] pr-3 pl-1.5 text-[9px] text-black shadow-[0_4px_12px_rgb(0_0_0/0.35)]"
        >
          <GripVertical className="size-3.5" />
          <Icon className="size-3.5" />
          {def.label}
        </button>
        <span className="flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
          <ChromeButton
            label={`Duplicate ${def.label}`}
            onClick={() => duplicate(store, block.id)}
          >
            <Copy className="size-3.5" />
          </ChromeButton>
          <ChromeButton
            label={`Remove ${def.label}`}
            danger
            onClick={() => remove(store, block.id)}
          >
            <Trash2 className="size-3.5" />
          </ChromeButton>
        </span>
      </div>

      <div
        className={cn(
          "transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover/block:opacity-100",
          dragged && "opacity-0",
        )}
      >
        <Handle
          label={`Resize ${def.label} width`}
          className="top-1/2 -right-[19px] h-12 w-[14px] -translate-y-1/2 cursor-ew-resize"
          bar="h-8 w-1"
          onPointerDown={(e) => onBegin(e, block, "e")}
        />
        {fill ? (
          <>
            <Handle
              label={`Resize ${def.label} height`}
              className="-bottom-[19px] left-1/2 h-[14px] w-12 -translate-x-1/2 cursor-ns-resize"
              bar="h-1 w-8"
              onPointerDown={(e) => onBegin(e, block, "s")}
            />
            <Handle
              label={`Resize ${def.label}`}
              className="-right-[19px] -bottom-[19px] size-[14px] cursor-nwse-resize"
              bar="size-2.5 rounded-full"
              onPointerDown={(e) => onBegin(e, block, "se")}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function ChromeButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full bg-black/80 text-white shadow-[0_0_0_1px_rgb(255_255_255/0.18),0_4px_12px_rgb(0_0_0/0.35)] backdrop-blur-md transition-colors",
        danger
          ? "hover:bg-[var(--site-danger)] hover:text-black"
          : "hover:bg-[var(--ed)] hover:text-black",
      )}
    >
      {children}
    </button>
  );
}

/** A resize grip in the gap beside a block: a wide hit area with a thin bar. */
function Handle({
  label,
  className,
  bar,
  onPointerDown,
}: {
  label: string;
  className: string;
  bar: string;
  onPointerDown: (e: ReactPointerEvent) => void;
}) {
  return (
    <span
      role="presentation"
      title={label}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute z-10 flex touch-none items-center justify-center",
        className,
      )}
    >
      <span
        className={cn(
          "rounded-full bg-[var(--ed)] shadow-[0_0_0_2px_rgb(0_0_0/0.45)]",
          bar,
        )}
      />
    </span>
  );
}

/** A block with nothing to show yet. Only the editor draws these. */
function Placeholder({ block, fill }: { block: ClientBlock; fill: boolean }) {
  const Icon = BLOCK_ICONS[block.type];
  const def = getBlockDef(block.type);
  return (
    <div
      className={cn(
        "flex gap-4 rounded-[var(--cp-r-media)] border border-dashed border-[color-mix(in_oklab,var(--cp-ink)_28%,transparent)] bg-[color-mix(in_oklab,var(--cp-ink)_4%,transparent)] px-5 text-[var(--cp-muted)]",
        fill
          ? "flex-1 flex-col items-center justify-center text-center"
          : "min-h-24 items-center py-5",
      )}
    >
      <Icon className="size-6 shrink-0" />
      <div>
        <p className="t-label text-[11px] text-[var(--cp-ink)]">{def.label}</p>
        {EMPTY_HINTS[block.type] ? (
          <p className="mt-2 text-[14px] leading-snug">
            {EMPTY_HINTS[block.type]}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AddTile({ store, empty }: { store: EditorStore; empty: boolean }) {
  return (
    <button
      type="button"
      onClick={() => store.getState().openPanel("add")}
      className={cn(
        "group/add mt-6 flex w-full items-center justify-center gap-3 rounded-[var(--cp-r-media)] border border-dashed border-[color-mix(in_oklab,var(--cp-ink)_28%,transparent)] text-[var(--cp-muted)] transition-colors hover:border-[var(--ed-line)] hover:text-[var(--cp-ink)]",
        empty ? "h-48 flex-col" : "h-20",
      )}
    >
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--ed)] text-black">
        <Plus className="size-4" />
      </span>
      <span className="t-label text-[11px]">
        {empty ? "Add your first block" : "Add a block"}
      </span>
    </button>
  );
}

/** Phones: the blocks in the order visitors see them, each opening its settings. */
function List({ store, ...props }: SectionProps & { store: EditorStore }) {
  const blocks = useEditor(store, (s) => s.blocks);
  const selectedId = useEditor(store, (s) => s.selectedId);
  const scrollRef = useContext(ScrollContainerContext);
  const listRef = useRef<HTMLDivElement>(null);
  const ctx = useSectionContext(props.profile);
  const ordered = useMemo(() => readingOrder(blocks), [blocks]);

  // The settings sheet covers the bottom of the screen: bring the block up
  // above it, under the header.
  useEffect(() => {
    const el = selectedId
      ? listRef.current?.querySelector<HTMLElement>(
          `[data-block-id="${selectedId}"]`,
        )
      : null;
    const scroller = scrollRef?.current;
    if (!el || !scroller) return;
    const top =
      el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    // Clear the header and any sticky tabs under it.
    scroller.scrollBy({ top: top - 144, behavior: "smooth" });
  }, [selectedId, scrollRef]);

  return (
    <div ref={listRef} className="flex flex-col gap-6">
      <p className="t-label text-[10px] leading-relaxed text-[var(--cp-muted)]">
        Tap a block to change it. Arrange your grid on a laptop or tablet.
      </p>
      {ordered.map((block) => {
        const section = toSection(block, ctx);
        const def = getBlockDef(block.type);
        const fill = def.sizing === "fill";
        const Icon = BLOCK_ICONS[block.type];
        const selected = block.id === selectedId;
        return (
          <div
            key={block.id}
            data-block-id={block.id}
            role="button"
            tabIndex={0}
            aria-label={`Edit ${def.label}`}
            onClick={() => store.getState().select(block.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                store.getState().select(block.id);
              }
            }}
            className={cn(
              "relative pt-4 outline-offset-[6px]",
              selected
                ? "outline-2 outline-[var(--ed-line)] outline-solid"
                : "outline-1 outline-[color-mix(in_oklab,var(--cp-ink)_20%,transparent)] outline-dashed",
            )}
          >
            <span className="t-label absolute -top-3 left-3 z-10 inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--ed)] px-3 text-[9px] text-black">
              <Icon className="size-3.5" /> {def.label}
            </span>
            <BlockCell
              section={block}
              className="pointer-events-none"
              style={fill ? { height: rowsToPx(block.h) } : undefined}
            >
              {block.type === "SPACER" ? (
                <div className="flex-1 bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--cp-ink)_7%,transparent)_0_2px,transparent_2px_10px)]" />
              ) : section ? (
                <Section section={section} {...props} />
              ) : (
                <Placeholder block={block} fill={fill} />
              )}
            </BlockCell>
          </div>
        );
      })}
      <AddTile store={store} empty={!blocks.length} />
    </div>
  );
}
