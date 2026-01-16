"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
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
import { ArrowDown, GripVertical, Loader2, RotateCcw, Save, Search, Star } from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";

const HOME_FEATURED_COUNT = 1;
const HOME_LIST_SHOWN_COUNT = 2;
const RECENT_UNPLACED_COUNT = 5;

type Placement = RouterOutputs["homeContent"]["getPlacements"][number];
type ContentItemFromList = RouterOutputs["content"]["getAll"][number];
type ContentSummary = NonNullable<Placement["contentItem"]>;

function formatContentDateLabel(item: ContentSummary | undefined) {
  const date = item?.date ?? null;
  if (!date) return null;
  try {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function removeFromArray(arr: string[], id: string) {
  const idx = arr.indexOf(id);
  if (idx === -1) return arr;
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)];
}

function findContainerId(id: string, featuredIds: string[], listIds: string[]) {
  if (id === "featured" || id === "list") return id;
  if (featuredIds.includes(id)) return "featured";
  if (listIds.includes(id)) return "list";
  return null;
}

function DroppableContainer({
  id,
  className,
  children,
}: {
  id: "featured" | "list";
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && "ring-primary ring-2 ring-offset-2")}
    >
      {children}
    </div>
  );
}

function SortableContentRow({
  id,
  item,
  container,
  index,
  onRemove,
  onSetFeatured,
  onMoveToList,
}: {
  id: string;
  item: ContentSummary | undefined;
  container: "featured" | "list";
  index?: number;
  onRemove: (id: string) => void;
  onSetFeatured: (id: string) => void;
  onMoveToList: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dateLabel = formatContentDateLabel(item);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-border bg-background flex items-center gap-3 rounded-md border px-3 py-2",
        isDragging && "opacity-70",
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>Drag to reorder</TooltipContent>
      </Tooltip>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{item?.title ?? "Unknown content"}</p>
          {container === "featured" ? (
            <Badge variant="secondary">
              <Star className="h-3 w-3" />
              Featured
            </Badge>
          ) : index !== undefined && index < HOME_LIST_SHOWN_COUNT ? (
            <Badge>Shown on Home</Badge>
          ) : (
            <Badge variant="outline">Overflow</Badge>
          )}
          {dateLabel ? (
            <span className="text-muted-foreground text-xs">{dateLabel}</span>
          ) : null}
        </div>
        <p className="text-muted-foreground truncate text-sm">
          {(item?.type ?? "content") + (item?.dj ? ` · ${item.dj}` : "")}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {container === "list" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onSetFeatured(id)}
            aria-label="Set as featured"
            title="Set as featured"
          >
            <Star className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMoveToList(id)}
            aria-label="Move to list"
            title="Move to list"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => onRemove(id)}>
          Remove
        </Button>
      </div>
    </div>
  );
}

export function HomeContentManager() {
  const utils = api.useUtils();

  const { data: featuredPlacement, isLoading: isLoadingFeatured } =
    api.homeContent.getPlacements.useQuery({ section: "FEATURED" });
  const { data: listPlacement, isLoading: isLoadingList } =
    api.homeContent.getPlacements.useQuery({ section: "PAST" });

  const setPlacements = api.homeContent.setPlacements.useMutation();

  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [listIds, setListIds] = useState<string[]>([]);
  const [savedFeaturedIds, setSavedFeaturedIds] = useState<string[]>([]);
  const [savedListIds, setSavedListIds] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim();

  const { data: contentList, isLoading: isLoadingContentList } =
    api.content.getAll.useQuery(undefined, { staleTime: 60_000 });
  const { data: searchResultsRaw, isLoading: isLoadingSearch } =
    api.content.getAll.useQuery(
      trimmedSearch ? { search: trimmedSearch } : undefined,
      { enabled: !!trimmedSearch },
    );

  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const itemMap = useMemo(() => {
    const map = new Map<string, ContentSummary>();

    for (const p of featuredPlacement ?? []) {
      if (p.contentItem) map.set(p.contentItem.id, p.contentItem);
    }
    for (const p of listPlacement ?? []) {
      if (p.contentItem) map.set(p.contentItem.id, p.contentItem);
    }
    for (const c of contentList ?? []) {
      map.set(c.id, {
        id: c.id,
        type: c.type,
        title: c.title,
        dj: c.dj ?? null,
        description: c.description,
        date: c.date,
        linkType: c.linkType,
        link: c.link,
      } satisfies ContentSummary);
    }

    return map;
  }, [featuredPlacement, listPlacement, contentList]);

  useEffect(() => {
    const nextFeatured = (featuredPlacement ?? []).map((p) => p.contentItemId);
    const nextList = (listPlacement ?? []).map((p) => p.contentItemId);

    setFeaturedIds(nextFeatured.slice(0, HOME_FEATURED_COUNT));
    setListIds(nextList);
    setSavedFeaturedIds(nextFeatured.slice(0, HOME_FEATURED_COUNT));
    setSavedListIds(nextList);
  }, [featuredPlacement, listPlacement]);

  const hasChanges =
    JSON.stringify(featuredIds) !== JSON.stringify(savedFeaturedIds) ||
    JSON.stringify(listIds) !== JSON.stringify(savedListIds);

  useUnsavedChangesWarning({ enabled: hasChanges });

  const isLoading = isLoadingFeatured || isLoadingList;
  const isSaving = setPlacements.isPending;

  const selectedIds = useMemo(
    () => new Set<string>([...featuredIds, ...listIds]),
    [featuredIds, listIds],
  );

  const recentUnplaced = useMemo(() => {
    const list = (contentList ?? []).filter((c) => !selectedIds.has(c.id));
    // content.getAll already returns date desc, but keep it explicit
    list.sort((a, b) => b.date.getTime() - a.date.getTime());
    return list.slice(0, RECENT_UNPLACED_COUNT);
  }, [contentList, selectedIds]);

  const searchResults = useMemo(() => {
    const list = searchResultsRaw ?? [];
    return list.slice(0, 25);
  }, [searchResultsRaw]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const from = findContainerId(activeId, featuredIds, listIds);
    const to =
      findContainerId(overId, featuredIds, listIds) ??
      (overId === "featured" || overId === "list" ? overId : null);
    if (!from || !to) return;

    if (from === to) {
      const ids = from === "featured" ? featuredIds : listIds;
      const oldIndex = ids.indexOf(activeId);
      const newIndex = ids.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = arrayMove(ids, oldIndex, newIndex);
      if (from === "featured") setFeaturedIds(next);
      else setListIds(next);
      return;
    }

    // Move between containers
    let nextFeatured = removeFromArray(featuredIds, activeId);
    let nextList = removeFromArray(listIds, activeId);

    if (to === "featured") {
      const existing = nextFeatured[0];
      if (existing && existing !== activeId) {
        nextList = [existing, ...nextList];
      }
      nextFeatured = [activeId];
    } else {
      const overContentId = overId === "list" ? null : overId;
      const targetIndex = overContentId ? nextList.indexOf(overContentId) : -1;
      if (targetIndex === -1) nextList = [...nextList, activeId];
      else
        nextList = [
          ...nextList.slice(0, targetIndex),
          activeId,
          ...nextList.slice(targetIndex),
        ];
    }

    setFeaturedIds(nextFeatured.slice(0, HOME_FEATURED_COUNT));
    setListIds(nextList);
  };

  const handleRemove = (id: string) => {
    setFeaturedIds((prev) => removeFromArray(prev, id));
    setListIds((prev) => removeFromArray(prev, id));
  };

  const setFeatured = (id: string) => {
    setListIds((prevList) => {
      const next = removeFromArray(removeFromArray(prevList, id), featuredIds[0] ?? "");
      return featuredIds[0] && featuredIds[0] !== id ? [featuredIds[0], ...next] : next;
    });
    setFeaturedIds([id]);
  };

  const addToList = (id: string, where: "start" | "end" = "end") => {
    setFeaturedIds((prev) => removeFromArray(prev, id));
    setListIds((prev) => {
      const next = removeFromArray(prev, id);
      return where === "start" ? [id, ...next] : [...next, id];
    });
  };

  const handleDiscard = () => {
    setSaveError(null);
    setLastSavedAt(null);
    setFeaturedIds(savedFeaturedIds);
    setListIds(savedListIds);
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      await Promise.all([
        setPlacements.mutateAsync({
          section: "FEATURED",
          contentItemIds: featuredIds.slice(0, HOME_FEATURED_COUNT),
        }),
        setPlacements.mutateAsync({
          section: "PAST",
          contentItemIds: listIds,
        }),
      ]);

      setSavedFeaturedIds(featuredIds.slice(0, HOME_FEATURED_COUNT));
      setSavedListIds(listIds);
      setLastSavedAt(Date.now());

      await Promise.all([
        utils.homeContent.getPlacements.invalidate({ section: "FEATURED" }),
        utils.homeContent.getPlacements.invalidate({ section: "PAST" }),
        utils.homeContent.getHomeLatest.invalidate(),
      ]);
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Failed to save. Please try again.",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Home “Latest Content”</CardTitle>
            <CardDescription>
              Home shows {HOME_FEATURED_COUNT} featured + the first{" "}
              {HOME_LIST_SHOWN_COUNT} items from the list.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleDiscard}
              disabled={!hasChanges || isSaving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Discard
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          {hasChanges ? (
            <Badge variant="secondary">Unsaved changes</Badge>
          ) : (
            <Badge variant="outline">Up to date</Badge>
          )}
          {lastSavedAt ? (
            <span className="text-muted-foreground text-xs">
              Saved{" "}
              {new Date(lastSavedAt).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          ) : null}
          {saveError ? (
            <span className="text-destructive text-xs">{saveError}</span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preview (what Home shows)</CardTitle>
              <CardDescription>
                This is the exact ordering the Home page will display.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">Featured</span>
                  <Badge variant={featuredIds.length ? "default" : "secondary"}>
                    {featuredIds.length ? "Selected" : "Missing"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">Shown</span>
                  <Badge
                    variant={
                      listIds.length >= HOME_LIST_SHOWN_COUNT
                        ? "default"
                        : "secondary"
                    }
                  >
                    {Math.min(listIds.length, HOME_LIST_SHOWN_COUNT)}/
                    {HOME_LIST_SHOWN_COUNT}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">List</span>
                  <Badge variant={listIds.length ? "default" : "secondary"}>
                    {listIds.length}
                  </Badge>
                </div>
              </div>

              <div className="rounded-md border">
                <div className="border-b px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">Featured</span>
                    <Badge variant="secondary">Slot 1</Badge>
                  </div>
                </div>
                <div className="px-3 py-2">
                  {featuredIds[0] ? (
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {itemMap.get(featuredIds[0])?.title ?? "Unknown content"}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {(itemMap.get(featuredIds[0])?.type ?? "content") +
                          (itemMap.get(featuredIds[0])?.dj
                            ? ` · ${itemMap.get(featuredIds[0])?.dj}`
                            : "")}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      No featured content selected.
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-md border">
                <div className="border-b px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">List</span>
                    <Badge variant="secondary">
                      Slots 2–{HOME_LIST_SHOWN_COUNT + 1}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2 px-3 py-2">
                  {listIds.slice(0, HOME_LIST_SHOWN_COUNT).length ? (
                    listIds.slice(0, HOME_LIST_SHOWN_COUNT).map((id, idx) => (
                      <div key={id} className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {itemMap.get(id)?.title ?? "Unknown content"}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {(itemMap.get(id)?.type ?? "content") +
                              (itemMap.get(id)?.dj
                                ? ` · ${itemMap.get(id)?.dj}`
                                : "")}
                          </p>
                        </div>
                        <Badge variant="outline">#{idx + 1}</Badge>
                      </div>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      Add at least {HOME_LIST_SHOWN_COUNT} items to populate Home.
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Featured
                  </CardTitle>
                  <CardDescription>
                    Exactly {HOME_FEATURED_COUNT} item appears as featured.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  ) : (
                    <SortableContext
                      items={featuredIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <DroppableContainer id="featured" className="space-y-2">
                        {featuredIds.length === 0 ? (
                          <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                            Drop an item here, or use “Featured” from the recent
                            list.
                          </div>
                        ) : (
                          featuredIds.map((id) => (
                            <SortableContentRow
                              key={id}
                              id={id}
                              container="featured"
                              item={itemMap.get(id)}
                              onRemove={handleRemove}
                              onSetFeatured={setFeatured}
                              onMoveToList={(cid) => addToList(cid, "start")}
                            />
                          ))
                        )}
                      </DroppableContainer>
                    </SortableContext>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>List</CardTitle>
                  <CardDescription>
                    Home shows the first {HOME_LIST_SHOWN_COUNT} items from this
                    list.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  ) : (
                    <SortableContext
                      items={listIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <DroppableContainer id="list" className="space-y-2">
                        {listIds.length === 0 ? (
                          <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                            Drop items here to build the list.
                          </div>
                        ) : (
                          listIds.map((id, idx) => (
                            <SortableContentRow
                              key={id}
                              id={id}
                              container="list"
                              index={idx}
                              item={itemMap.get(id)}
                              onRemove={handleRemove}
                              onSetFeatured={setFeatured}
                              onMoveToList={(cid) => addToList(cid, "end")}
                            />
                          ))
                        )}
                      </DroppableContainer>
                    </SortableContext>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="space-y-1">
                  <CardTitle>Add content</CardTitle>
                  <CardDescription>
                    Quickly add recent content, or search to find older ones.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="Search content by type, title, description, or DJ…"
                    value={search}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSearch(e.target.value)
                    }
                    className="pl-9"
                  />
                </div>

                <div className="rounded-md border">
                  <div className="border-b px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {trimmedSearch ? "Results" : "Recent unplaced items"}
                      </span>
                      <Badge variant="outline">
                        {trimmedSearch ? "Search" : `Top ${RECENT_UNPLACED_COUNT}`}
                      </Badge>
                    </div>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto">
                    {trimmedSearch ? (
                      isLoadingSearch ? (
                        <div className="text-muted-foreground flex items-center gap-2 px-3 py-4 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Searching…
                        </div>
                      ) : searchResults.length ? (
                        searchResults.map((c) => {
                          const alreadySelected = selectedIds.has(c.id);
                          const inFeatured = featuredIds.includes(c.id);
                          const inList = listIds.includes(c.id);

                          return (
                            <div
                              key={c.id}
                              className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3 last:border-b-0"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {c.title}
                                </p>
                                <p className="text-muted-foreground truncate text-xs">
                                  {c.type + (c.dj ? ` · ${c.dj}` : "")}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {alreadySelected ? (
                                  <Badge variant="secondary">
                                    {inFeatured
                                      ? "In featured"
                                      : inList
                                        ? "In list"
                                        : "Selected"}
                                  </Badge>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setFeatured(c.id)}
                                  disabled={isSaving}
                                >
                                  <Star className="mr-2 h-4 w-4" />
                                  Featured
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => addToList(c.id, "end")}
                                  disabled={isSaving}
                                >
                                  Add to list
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-muted-foreground px-3 py-4 text-sm">
                          No content found.
                        </div>
                      )
                    ) : isLoadingContentList ? (
                      <div className="text-muted-foreground flex items-center gap-2 px-3 py-4 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                      </div>
                    ) : recentUnplaced.length ? (
                      recentUnplaced.map((c) => (
                        <div
                          key={c.id}
                          className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {c.title}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {c.type + (c.dj ? ` · ${c.dj}` : "")}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setFeatured(c.id)}
                              disabled={isSaving}
                            >
                              <Star className="mr-2 h-4 w-4" />
                              Featured
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => addToList(c.id, "end")}
                              disabled={isSaving}
                            >
                              Add to list
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground px-3 py-4 text-sm">
                        No unplaced content found.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DndContext>
      </CardContent>
    </Card>
  );
}

