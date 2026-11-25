"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { cn } from "~/lib/utils";

/**
 * A list whose rows drag to reorder, by a grip handle at the start of each
 * row, the same way the run sheet and the tier table do. The handle also
 * takes the keyboard: focus it, Space to lift, arrows to move, Space to drop.
 *
 * `children` draws a row's content; the grip is drawn before it.
 */
export function SortableList<Item>({
  items,
  keyOf,
  labelOf,
  onReorder,
  className,
  rowClassName,
  children,
}: {
  items: readonly Item[];
  keyOf: (item: Item) => string;
  /** What the handle's label calls the row, as in "Drag {label} to reorder". */
  labelOf: (item: Item) => string;
  onReorder: (items: Item[]) => void;
  className?: string;
  rowClassName?: (item: Item) => string;
  children: (item: Item, index: number) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => keyOf(item) === active.id);
    const to = items.findIndex((item) => keyOf(item) === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove([...items], from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map(keyOf)}
        strategy={verticalListSortingStrategy}
      >
        <ul className={className}>
          {items.map((item, index) => (
            <SortableRow
              key={keyOf(item)}
              id={keyOf(item)}
              label={labelOf(item)}
              className={rowClassName?.(item)}
            >
              {children(item, index)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-card relative flex items-start gap-2",
        isDragging && "z-10 opacity-70",
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Drag ${label} to reorder`}
        className="text-muted-foreground hover:text-foreground mt-2 shrink-0 cursor-grab touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
