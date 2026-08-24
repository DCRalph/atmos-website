"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Plus, Search, UserPlus, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { buildMediaUrl } from "~/lib/media-url";
import { cn } from "~/lib/utils";
import { CreatorQuickCreateDialog } from "./creator-quick-create-dialog";
import {
  newScheduleItem,
  type DraftScheduleItem,
  type PickedCreator,
} from "./types";

type LineUpFieldProps = {
  /** The `SET` rows of the run sheet, in running order. */
  creators: DraftScheduleItem[];
  onChange: (creators: DraftScheduleItem[]) => void;
  disabled?: boolean;
};

/** The "create a new profile" entry, treated as one more row for the keyboard. */
const CREATE_ROW = "__create__";

export function LineUpField({
  creators,
  onChange,
  disabled,
}: LineUpFieldProps) {
  const [query, setQuery] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query);
  const assignedIds = useMemo(
    () => creators.flatMap((row) => (row.creatorProfileId ? [row.creatorProfileId] : [])),
    [creators],
  );

  const search = api.lineUp.searchProfiles.useQuery(
    { query: debouncedQuery, excludeIds: assignedIds, limit: 20 },
    {
      enabled: isPickerOpen,
      // Keep the previous page on screen while the next one loads, so the list
      // does not blink empty between keystrokes.
      placeholderData: (previous) => previous,
    },
  );

  const assigned = new Set(assignedIds);
  const results = (search.data?.profiles ?? []).filter(
    (profile) => !assigned.has(profile.id),
  );
  const total = search.data?.total ?? 0;
  const isRecent = search.data?.isRecent ?? false;
  const canCreate = query.trim().length > 0;

  /** Rows the keyboard walks: profile ids, then the create action. */
  const rows: string[] = [
    ...results.map((profile) => profile.id),
    ...(canCreate ? [CREATE_ROW] : []),
  ];
  const safeIndex = Math.min(activeIndex, Math.max(rows.length - 1, 0));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const add = (profile: PickedCreator) => {
    if (assigned.has(profile.creatorProfileId)) return;
    onChange([...creators, newScheduleItem({ kind: "SET", ...profile })]);
    setQuery("");
    setActiveIndex(0);
    searchRef.current?.focus();
  };

  const commitRow = (row: string) => {
    if (row === CREATE_ROW) {
      setIsCreateOpen(true);
      return;
    }
    const profile = results.find((candidate) => candidate.id === row);
    if (!profile) return;
    add({
      creatorProfileId: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      avatarFileId: profile.avatarFileId,
      claimStatus: profile.claimStatus,
      isPublished: profile.isPublished,
    });
  };

  const onSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (rows.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (safeIndex + delta + rows.length) % rows.length;
      setActiveIndex(next);
      listRef.current
        ?.querySelector(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[safeIndex];
      if (row) commitRow(row);
      return;
    }
    if (event.key === "Escape") {
      if (query) setQuery("");
      else setIsPickerOpen(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = creators.findIndex((row) => row.key === active.id);
    const to = creators.findIndex((row) => row.key === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(creators, from, to));
  };

  const updateRole = (key: string, role: string) => {
    onChange(creators.map((row) => (row.key === key ? { ...row, role } : row)));
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Line-up</CardTitle>
          <CardDescription>
            Who is on this bill, in running order. Drag to reorder; roles are
            optional. Changes save with the rest of the page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs tracking-wide uppercase">
              On the bill ({creators.length})
            </Label>
            {creators.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nobody yet — search below to add someone.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={creators.map((row) => row.key)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="flex flex-col gap-2">
                    {creators.map((row, index) => (
                      <SortableCreatorRow
                        key={row.key}
                        row={row}
                        position={index + 1}
                        disabled={disabled}
                        onRoleChange={(role) => updateRole(row.key, role)}
                        onRemove={() =>
                          onChange(
                            creators.filter(
                              (candidate) => candidate.key !== row.key,
                            ),
                          )
                        }
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div className="border-t pt-4">
            <Label
              htmlFor="creator-search"
              className="mb-2 block text-xs tracking-wide uppercase"
            >
              Add to the bill
            </Label>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                id="creator-search"
                ref={searchRef}
                role="combobox"
                aria-expanded={isPickerOpen}
                aria-controls="creator-search-results"
                aria-autocomplete="list"
                placeholder="Search creators by name or handle..."
                value={query}
                disabled={disabled}
                onFocus={() => setIsPickerOpen(true)}
                // Closing on blur would fire before a click on a result lands;
                // rows suppress mousedown instead, so focus never leaves.
                onBlur={() => setIsPickerOpen(false)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onSearchKeyDown}
                className="w-full pr-9 pl-9"
              />
              {search.isFetching ? (
                <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
              ) : null}
            </div>

            {isPickerOpen ? (
              <div
                ref={listRef}
                id="creator-search-results"
                role="listbox"
                className="bg-popover mt-2 max-h-72 overflow-y-auto rounded-md border p-1 shadow-sm"
              >
                {isRecent && results.length > 0 ? (
                  <p className="text-muted-foreground px-2 py-1.5 text-xs">
                    Recently updated profiles
                  </p>
                ) : null}

                {results.map((profile, index) => (
                  <div
                    key={profile.id}
                    data-index={index}
                    role="option"
                    aria-selected={index === safeIndex}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitRow(profile.id)}
                    onPointerEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm",
                      index === safeIndex && "bg-accent",
                    )}
                  >
                    <Avatar
                      fileId={profile.avatarFileId}
                      name={profile.displayName}
                      size={28}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {profile.displayName}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        @{profile.handle}
                      </span>
                    </span>
                    <StatusBadges
                      claimStatus={profile.claimStatus}
                      isPublished={profile.isPublished}
                    />
                    <Plus className="text-muted-foreground h-4 w-4 shrink-0" />
                  </div>
                ))}

                {results.length === 0 && !search.isFetching ? (
                  <p className="text-muted-foreground px-2 py-3 text-sm">
                    {query.trim()
                      ? `No profile matches "${query.trim()}".`
                      : "No profiles yet."}
                  </p>
                ) : null}

                {canCreate ? (
                  <div
                    data-index={rows.length - 1}
                    role="option"
                    aria-selected={safeIndex === rows.length - 1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitRow(CREATE_ROW)}
                    onPointerEnter={() => setActiveIndex(rows.length - 1)}
                    className={cn(
                      "mt-1 flex cursor-pointer items-center gap-2 rounded-sm border-t px-2 py-2 text-sm",
                      safeIndex === rows.length - 1 && "bg-accent",
                    )}
                  >
                    <UserPlus className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      Create{" "}
                      <span className="font-medium">
                        &quot;{query.trim()}&quot;
                      </span>{" "}
                      as a new profile
                    </span>
                  </div>
                ) : null}

                {/* `total` already excludes who is on the bill. */}
                {total > results.length ? (
                  <p className="text-muted-foreground border-t px-2 py-2 text-xs">
                    Showing {results.length} of {total}. Keep typing to narrow
                    it down.
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="text-muted-foreground mt-3 text-xs">
              Profiles can also be managed on the{" "}
              <Link
                href="/admin/creator-profiles"
                target="_blank"
                className="hover:text-foreground underline"
              >
                creator profiles
              </Link>{" "}
              page.
            </p>
          </div>
        </CardContent>
      </Card>

      <CreatorQuickCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        initialName={query.trim()}
        onCreated={(creator) => {
          add(creator);
          void search.refetch();
        }}
      />
    </>
  );
}

function SortableCreatorRow({
  row,
  position,
  disabled,
  onRoleChange,
  onRemove,
}: {
  row: DraftScheduleItem;
  position: number;
  disabled?: boolean;
  onRoleChange: (role: string) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.key });

  const name = row.displayName ?? "Unnamed";

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="bg-card flex items-center gap-3 rounded-md border p-3"
    >
      <button
        type="button"
        aria-label={`Reorder ${name}`}
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-muted-foreground w-4 shrink-0 text-xs tabular-nums">
        {position}
      </span>
      <Avatar fileId={row.avatarFileId} name={name} size={36} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/@${row.handle}`}
          target="_blank"
          className="truncate text-sm font-semibold hover:underline"
        >
          {name}
        </Link>
        <span className="text-muted-foreground truncate text-xs">
          @{row.handle}
        </span>
      </div>
      <StatusBadges
        claimStatus={row.claimStatus}
        isPublished={row.isPublished}
      />
      <Input
        aria-label={`Role for ${name}`}
        placeholder="Role (optional)"
        value={row.role}
        disabled={disabled}
        onChange={(e) => onRoleChange(e.target.value)}
        className="max-w-[180px]"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove ${name}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
}

function Avatar({
  fileId,
  name,
  size,
}: {
  fileId: string | null;
  name: string;
  size: number;
}) {
  return (
    <span
      className="bg-muted relative shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      {fileId ? (
        // A plain img on purpose: these are small, already-cached /api/media
        // responses, so the image optimiser adds a hop and an allowlist to keep
        // in sync for no gain.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={buildMediaUrl(fileId)}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs font-bold">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function StatusBadges({
  claimStatus,
  isPublished,
}: {
  claimStatus: DraftScheduleItem["claimStatus"];
  isPublished: boolean;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {claimStatus === "UNCLAIMED" ? (
        <Badge>unclaimed</Badge>
      ) : claimStatus === "PENDING_CLAIM" ? (
        <Badge>claim pending</Badge>
      ) : null}
      {!isPublished ? <Badge>draft</Badge> : null}
    </span>
  );
}

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="text-muted-foreground rounded border px-1 text-[10px] uppercase">
    {children}
  </span>
);
