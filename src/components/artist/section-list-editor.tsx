"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { toSections } from "~/lib/artist-sections";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { BlockInspector } from "./block-inspector";
import {
  BLOCK_TYPES,
  getBlockDef,
  toStoredOrder,
  type ClientBlock,
} from "./block-types";

/**
 * The profile builder's list of sections: everything below the hero, top to
 * bottom. Drag a grip (or focus it and use space and the arrow keys) or use
 * the arrow buttons to reorder; open a section to edit it in place.
 */
export function SectionListEditor({
  blocks,
  socialsCount,
  selectedId,
  onSelect,
  onChange,
  profileId,
}: {
  blocks: ClientBlock[];
  socialsCount: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: ClientBlock[]) => void;
  profileId?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const commit = (next: ClientBlock[]) => onChange(toStoredOrder(next));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    commit(arrayMove(blocks, from, to));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(
      blocks.findIndex((b) => b.id === active.id),
      blocks.findIndex((b) => b.id === over.id),
    );
  };

  return (
    <div className="space-y-3">
      {blocks.length ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="space-y-2">
              {blocks.map((block, i) => (
                <SectionRow
                  key={block.id}
                  block={block}
                  index={i}
                  count={blocks.length}
                  hidden={!showsOnPage(block, socialsCount)}
                  open={block.id === selectedId}
                  onToggle={() =>
                    onSelect(block.id === selectedId ? null : block.id)
                  }
                  onMove={(to) => move(i, to)}
                  onRemove={() => {
                    commit(blocks.filter((b) => b.id !== block.id));
                    if (block.id === selectedId) onSelect(null);
                  }}
                  onChange={(nb) =>
                    commit(blocks.map((b) => (b.id === nb.id ? nb : b)))
                  }
                  profileId={profileId}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          No sections yet, so your page shows your upcoming and past sets from
          Atmos lineups. Add sections to choose what goes on it and in what
          order.
        </p>
      )}
      <AddSection
        onAdd={(block) => {
          commit([...blocks, block]);
          onSelect(block.id);
        }}
      />
    </div>
  );
}

/**
 * Whether the public page will show this section. The counts for lineups
 * aren't known here, so gig sections always count as showing.
 */
function showsOnPage(block: ClientBlock, socials: number) {
  return (
    toSections([block], {
      socials,
      upcoming: 1,
      past: 1,
      mediaUrl: (id) => id,
    }).length > 0
  );
}

/** One line under the section's name, so a closed list still says what's in it. */
function summary(block: ClientBlock): string {
  const d = block.data;
  const str = (k: string) => (typeof d[k] === "string" ? d[k].trim() : "");
  const count = (k: string) => (Array.isArray(d[k]) ? d[k].length : 0);
  switch (block.type) {
    case "HEADING":
      return str("text") || "No text yet";
    case "GIG_LIST":
    case "PAST_GIGS":
      return str("title") || "Untitled";
    case "GALLERY":
      return `${count("fileIds")} photos`;
    case "LINK_LIST":
      return `${count("links")} links`;
    case "IMAGE":
      return str("alt") || (str("fileId") ? "Photo" : "No photo yet");
    case "SOUNDCLOUD_TRACK":
    case "SOUNDCLOUD_PLAYLIST":
    case "YOUTUBE_VIDEO":
    case "SPOTIFY_EMBED":
    case "CUSTOM_EMBED":
      return str("url").replace(/^https?:\/\/(www\.)?/, "") || "No link yet";
    default:
      return getBlockDef(block.type)?.description ?? "";
  }
}

function SectionRow({
  block,
  index,
  count,
  hidden,
  open,
  onToggle,
  onMove,
  onRemove,
  onChange,
  profileId,
}: {
  block: ClientBlock;
  index: number;
  count: number;
  hidden: boolean;
  open: boolean;
  onToggle: () => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onChange: (next: ClientBlock) => void;
  profileId?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });
  const def = getBlockDef(block.type);
  const label = def?.label ?? block.type;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-background rounded-md border",
        open && "border-foreground/30",
        isDragging && "relative z-10 opacity-80 shadow-lg",
      )}
    >
      <div className="flex items-center gap-1 p-1.5">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-grab rounded p-1.5 active:cursor-grabbing"
          aria-label={`Drag to reorder ${label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {label}
              {hidden ? (
                <span
                  className="text-muted-foreground inline-flex items-center gap-1 text-[11px] font-normal"
                  title="Visitors won't see this until it has content"
                >
                  <EyeOff className="h-3 w-3" /> Not shown yet
                </span>
              ) : null}
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {summary(block)}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "text-muted-foreground h-4 w-4 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={`Move ${label} up`}
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={`Move ${label} down`}
          disabled={index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-destructive hover:text-destructive h-8 w-8"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {open ? (
        <div className="border-t p-3">
          <BlockInspector
            block={block}
            onChange={onChange}
            profileId={profileId}
          />
        </div>
      ) : null}
    </li>
  );
}

function AddSection({ onAdd }: { onAdd: (block: ClientBlock) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Add section
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-96 w-80 overflow-y-auto p-1.5">
        <ul>
          {BLOCK_TYPES.map((def) => (
            <li key={def.type}>
              <button
                type="button"
                onClick={() => {
                  onAdd({
                    id: `tmp_${Math.random().toString(36).slice(2, 10)}`,
                    isNew: true,
                    type: def.type,
                    x: 0,
                    y: 0,
                    w: 12,
                    h: 1,
                    data: { ...def.defaultData },
                  });
                  setOpen(false);
                }}
                className="hover:bg-accent w-full rounded-md px-2.5 py-2 text-left transition-colors"
              >
                <span className="block text-sm font-medium">{def.label}</span>
                <span className="text-muted-foreground block text-xs">
                  {def.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
