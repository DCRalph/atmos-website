"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { GripVertical, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { api, type RouterOutputs } from "~/trpc/react";
import {
  HOME_GRID_CELLS,
  HOME_GRID_COLUMNS,
  dropHomeTile,
  dropStart,
  layoutHomeContent,
  tileCells,
  tileSpan,
  type HomeSlot,
  type HomeTile,
} from "~/lib/home-content";
import { cn } from "~/lib/utils";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import { SaveBar, type SaveStatus } from "~/components/admin/save-status";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";

type ContentItem = RouterOutputs["content"]["getAll"][number];
const fingerprint = (slots: readonly HomeSlot[]) => JSON.stringify(slots);
const ROWS = HOME_GRID_CELLS / HOME_GRID_COLUMNS;

// Drag ids carry their source: `tile:<itemId>`, `lib:<itemId>` and `cell:<slot>`.
const idAfterColon = (id: UniqueIdentifier) => {
  const value = String(id);
  return value.slice(value.indexOf(":") + 1);
};

// Pointer drags drop where the pointer is, so letting go over the library drops
// nothing. Keyboard drags have no pointer and snap to the nearest cell.
const collisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);

/**
 * Home's 3 x 2 content grid, edited by dragging. Tiles and library items drop
 * onto any cell; videos take two squares. Cells left empty preview the newest
 * content that Home fills them with, and one Save commits the whole grid.
 */
export function HomeContentManager() {
  const utils = api.useUtils();
  const content = api.content.getAll.useQuery();
  const home = api.homeContent.getHomeLatest.useQuery();
  const saveLayout = api.homeContent.setLayout.useMutation();
  const [draft, setDraft] = useState<HomeSlot[] | null>(null);
  const [baseline, setBaseline] = useState<HomeSlot[] | null>(null);
  const [saveState, setSaveState] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const baselineFingerprint = baseline ? fingerprint(baseline) : null;
  const dirty = draft !== null && fingerprint(draft) !== baselineFingerprint;
  const saving = saveState === "saving" || saveLayout.isPending;

  // Only tiles an admin placed are saved; auto-filled ones stay free to change.
  const serverState = home.data
    ?.filter((tile) => !tile.auto)
    .map((tile) => ({ slot: tile.slot, contentItemId: tile.item.id }));
  const serverFingerprint = serverState ? fingerprint(serverState) : null;
  if (
    serverState &&
    serverFingerprint !== baselineFingerprint &&
    !dirty &&
    !saving
  ) {
    setDraft(serverState);
    setBaseline(serverState);
  }
  useUnsavedChangesWarning({ enabled: dirty && !saving });
  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = setTimeout(() => setSaveState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [saveState]);

  const items = useMemo(() => content.data ?? [], [content.data]);
  const byId = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const slots = useMemo(() => draft ?? [], [draft]);
  const tiles = useMemo(() => layoutHomeContent(items, slots), [items, slots]);
  const onHome = new Set(tiles.map((tile) => tile.item.id));
  const spanOf = (id: string) => {
    const item = byId.get(id);
    return item ? tileSpan(item) : 1;
  };

  const activeItem =
    activeId === null ? undefined : byId.get(idAfterColon(activeId));
  // Where the dragged item would land, drawn over the tiles it would move.
  const target =
    activeItem && overSlot !== null
      ? {
          slot: dropStart(overSlot, tileSpan(activeItem)),
          span: tileSpan(activeItem),
        }
      : null;

  // Arrow keys step a whole cell at a time while dragging with the keyboard.
  const coordinateGetter: KeyboardCoordinateGetter = (
    event,
    { currentCoordinates },
  ) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    const x = rect.width / HOME_GRID_COLUMNS;
    const y = rect.height / ROWS;
    const { x: cx, y: cy } = currentCoordinates;
    switch (event.code) {
      case "ArrowRight":
        return { x: cx + x, y: cy };
      case "ArrowLeft":
        return { x: cx - x, y: cy };
      case "ArrowDown":
        return { x: cx, y: cy + y };
      case "ArrowUp":
        return { x: cx, y: cy - y };
    }
    return undefined;
  };
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short hold, so a swipe over the grid still scrolls the page.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );

  const place = (item: ContentItem, slot: number) => {
    const next = dropHomeTile(slots, item, slot, spanOf);
    const bumped = slots.filter(
      (s) => !next.some((n) => n.contentItemId === s.contentItemId),
    );
    for (const s of bumped) {
      toast(
        `${byId.get(s.contentItemId)?.title ?? "A tile"} came off the grid`,
        {
          description: "There was no room left to move it.",
        },
      );
    }
    setDraft(next);
    setSaveState("idle");
    setError(null);
  };
  /** The first cell no placed tile covers, or the top left when the grid is full. */
  const addToGrid = (item: ContentItem) => {
    const span = tileSpan(item);
    const taken = new Set(
      slots.flatMap((s) => tileCells(s.slot, spanOf(s.contentItemId)) ?? []),
    );
    const free = Array.from({ length: HOME_GRID_CELLS }, (_, i) => i).find(
      (slot) => tileCells(slot, span)?.every((c) => !taken.has(c)),
    );
    place(item, free ?? 0);
  };
  const remove = (id: string) =>
    setDraft((current) =>
      (current ?? []).filter((s) => s.contentItemId !== id),
    );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setOverSlot(null);
    const item = byId.get(idAfterColon(active.id));
    if (!item || !over) return;
    place(item, Number(idAfterColon(over.id)));
  };

  const save = async () => {
    if (!draft || saving) return;
    setError(null);
    setSaveState("saving");
    try {
      await saveLayout.mutateAsync({ tiles: draft });
      setBaseline(draft);
      await utils.homeContent.invalidate();
      setSaveState("saved");
      toast.success("Home grid saved");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn't save the home grid.",
      );
      setSaveState("error");
    }
  };

  if (content.isPending || home.isPending) {
    return (
      <p role="status" className="text-muted-foreground py-8 text-sm">
        Loading home content…
      </p>
    );
  }
  if (content.isError || home.isError) {
    return (
      <div role="alert" className="space-y-3 py-8">
        <p>Couldn&apos;t load the home content.</p>
        <Button
          variant="outline"
          onClick={() => {
            void content.refetch();
            void home.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const library = query
    ? items.filter((item) =>
        [item.title, item.dj, item.type, item.platform].some((field) =>
          field?.toLowerCase().includes(query),
        ),
      )
    : items;

  return (
    <SaveBar
      status={
        dirty && (saveState === "idle" || saveState === "saved")
          ? "dirty"
          : saveState
      }
      errorMessage={error}
      message="The grid as it appears on Home."
      saveLabel="Save home grid"
      isSaving={saving}
      disabled={!draft || !dirty}
      onSave={() => void save()}
      onDiscard={
        dirty
          ? () => {
              setDraft(baseline);
              setSaveState("idle");
              setError(null);
            }
          : undefined
      }
    >
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragOver={({ over }) =>
          setOverSlot(over ? Number(idAfterColon(over.id)) : null)
        }
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setOverSlot(null);
        }}
      >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Home grid</CardTitle>
              <CardDescription>
                Drag tiles to move them, or drag content in from the list.
                YouTube videos take two squares. Dashed squares fill with the
                newest content until you place something there.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={gridRef} className="relative">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {Array.from({ length: HOME_GRID_CELLS }, (_, slot) => (
                    <GridCell key={slot} slot={slot} />
                  ))}
                </div>
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-2 gap-2 sm:gap-3">
                  {tiles.map((tile) => (
                    <GridTile
                      key={tile.item.id}
                      tile={tile}
                      disabled={saving}
                      dragging={activeId === `tile:${tile.item.id}`}
                      onRemove={() => remove(tile.item.id)}
                    />
                  ))}
                  {target ? (
                    <div
                      aria-hidden
                      style={gridArea(target.slot, target.span)}
                      className="z-10 rounded-md border-2 border-white bg-white/15"
                    />
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle>Content</CardTitle>
              <CardDescription>
                Drag onto a square, or press + to add to the first free one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search content"
                  aria-label="Search content"
                  className="pl-8"
                />
              </div>
              <ul className="max-h-[32rem] space-y-1.5 overflow-y-auto pr-1">
                {library.map((item) => (
                  <LibraryItem
                    key={item.id}
                    item={item}
                    onHome={onHome.has(item.id)}
                    disabled={saving}
                    onAdd={() => addToGrid(item)}
                  />
                ))}
                {!library.length ? (
                  <li className="text-muted-foreground py-6 text-center text-sm">
                    {items.length ? "No matches." : "No content yet."}
                  </li>
                ) : null}
              </ul>
              <Button variant="outline" asChild className="w-full">
                <Link href="/admin/content/new">
                  <Plus className="size-4" />
                  Add content
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeItem && activeId !== null ? (
            String(activeId).startsWith("tile:") ? (
              <div className="size-full scale-95 cursor-grabbing overflow-hidden rounded-md opacity-75 shadow-xl">
                <TileArt item={activeItem} />
              </div>
            ) : (
              <LibraryRow item={activeItem} className="shadow-xl" />
            )
          ) : null}
        </DragOverlay>
      </DndContext>
    </SaveBar>
  );
}

/** Places a tile in the 3-column editor grid. */
const gridArea = (slot: number, span: 1 | 2) => ({
  gridColumn: `${(slot % HOME_GRID_COLUMNS) + 1} / span ${span}`,
  gridRow: Math.floor(slot / HOME_GRID_COLUMNS) + 1,
});

function GridCell({ slot }: { slot: number }) {
  const { setNodeRef } = useDroppable({ id: `cell:${slot}` });
  return (
    <div
      ref={setNodeRef}
      aria-hidden
      className="bg-muted/40 aspect-square rounded-md border border-dashed"
    />
  );
}

function GridTile({
  tile,
  disabled,
  dragging,
  onRemove,
}: {
  tile: HomeTile<ContentItem>;
  disabled: boolean;
  dragging: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `tile:${tile.item.id}`,
    disabled,
  });
  const position = `square ${tile.slot + 1}${tile.span === 2 ? ` and ${tile.slot + 2}` : ""}`;
  return (
    <div
      ref={setNodeRef}
      style={gridArea(tile.slot, tile.span)}
      className={cn(
        "group pointer-events-auto relative cursor-grab overflow-hidden rounded-md select-none",
        tile.auto && "opacity-60 hover:opacity-100",
        dragging && "opacity-20",
      )}
      {...attributes}
      {...listeners}
      aria-label={`${tile.item.title}, ${position}${tile.auto ? ", filled automatically" : ""}. Drag to move.`}
    >
      <TileArt item={tile.item} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-6 text-white">
        <p className="truncate text-xs font-medium sm:text-sm">
          {tile.item.title}
        </p>
        <p className="truncate text-[10px] text-white/70 sm:text-xs">
          {tile.auto ? "Auto · newest" : tile.item.type}
        </p>
      </div>
      {!tile.auto ? (
        <button
          type="button"
          disabled={disabled}
          aria-label={`Take ${tile.item.title} off Home`}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-black/70 text-white opacity-100 transition-opacity hover:bg-black sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function TileArt({ item }: { item: ContentItem }) {
  return item.imageUrl ? (
    <Image
      src={item.imageUrl}
      alt=""
      fill
      sizes="(min-width: 1024px) 30vw, 50vw"
      draggable={false}
      className="bg-muted object-cover"
    />
  ) : (
    <div className="bg-muted text-muted-foreground flex size-full items-center justify-center p-2 text-center text-xs">
      {item.type}
    </div>
  );
}

function LibraryItem({
  item,
  onHome,
  disabled,
  onAdd,
}: {
  item: ContentItem;
  onHome: boolean;
  disabled: boolean;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib:${item.id}`,
    disabled,
  });
  return (
    <li ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <LibraryRow
        item={item}
        onHome={onHome}
        handle={
          <button
            type="button"
            disabled={disabled}
            className="text-muted-foreground shrink-0 cursor-grab touch-none p-1"
            aria-label={`Drag ${item.title} onto the grid`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={onAdd}
            aria-label={`Add ${item.title} to Home`}
          >
            <Plus className="size-4" />
          </Button>
        }
      />
    </li>
  );
}

function LibraryRow({
  item,
  onHome = false,
  handle,
  action,
  className,
}: {
  item: ContentItem;
  onHome?: boolean;
  handle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const span = tileSpan(item);
  return (
    <div
      className={cn(
        "bg-background flex min-w-0 items-center gap-2 rounded-md border p-1.5",
        className,
      )}
    >
      {handle}
      <div
        className={cn(
          "relative h-9 shrink-0 overflow-hidden rounded-sm",
          span === 2 ? "w-[4.5rem]" : "w-9",
        )}
      >
        <TileArt item={item} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-muted-foreground truncate text-xs">
          {span === 2 ? "Video · 2 squares" : item.type}
          {item.dj ? ` · ${item.dj}` : ""}
        </p>
      </div>
      {onHome ? (
        <Badge variant="secondary" className="shrink-0">
          On Home
        </Badge>
      ) : null}
      {action}
    </div>
  );
}
