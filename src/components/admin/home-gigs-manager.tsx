"use client";

import { useEffect, useMemo, useState } from "react";
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
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Save, RotateCcw, Star } from "lucide-react";
import { api } from "~/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

type GigSummary = {
  id: string;
  title: string;
  subtitle: string;
  gigStartTime: Date | null;
  gigEndTime: Date | null;
};

function SortableGigRow({
  id,
  gig,
  onRemove,
}: {
  id: string;
  gig: GigSummary | undefined;
  onRemove: (id: string) => void;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-border bg-background flex items-center gap-3 border px-3 py-2",
        isDragging && "opacity-70",
      )}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{gig?.title ?? "Unknown gig"}</p>
        <p className="text-muted-foreground truncate text-sm">
          {gig?.subtitle ?? id}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => onRemove(id)}>
        Remove
      </Button>
    </div>
  );
}

function removeFromArray(arr: string[], id: string) {
  const idx = arr.indexOf(id);
  if (idx === -1) return arr;
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)];
}

function findContainerId(id: string, featuredIds: string[], pastIds: string[]) {
  if (id === "featured" || id === "past") return id;
  if (featuredIds.includes(id)) return "featured";
  if (pastIds.includes(id)) return "past";
  return null;
}

function DroppableContainer({
  id,
  className,
  children,
}: {
  id: "featured" | "past";
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

export function HomeGigsManager() {
  const utils = api.useUtils();

  const { data: featuredPlacement, isLoading: isLoadingFeatured } =
    api.homeGigs.getPlacements.useQuery({ section: "FEATURED_RECENT_PAST" });
  const { data: pastPlacement, isLoading: isLoadingPast } =
    api.homeGigs.getPlacements.useQuery({ section: "PAST_RECENT_LIST" });

  const setPlacements = api.homeGigs.setPlacements.useMutation();

  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [pastIds, setPastIds] = useState<string[]>([]);
  const [savedFeaturedIds, setSavedFeaturedIds] = useState<string[]>([]);
  const [savedPastIds, setSavedPastIds] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const { data: searchResults, isLoading: isLoadingSearch } =
    api.gigs.getAll.useQuery(search.trim() ? { search } : undefined);

  // Build gig info map from placements + search results
  const gigMap = useMemo(() => {
    const map = new Map<string, GigSummary>();

    for (const p of featuredPlacement ?? []) {
      const g = (p as any).gig as GigSummary | undefined;
      if (g) map.set(g.id, g);
    }
    for (const p of pastPlacement ?? []) {
      const g = (p as any).gig as GigSummary | undefined;
      if (g) map.set(g.id, g);
    }
    for (const g of searchResults ?? []) {
      map.set(g.id, {
        id: g.id,
        title: g.title,
        subtitle: g.subtitle,
        gigStartTime: g.gigStartTime ?? null,
        gigEndTime: g.gigEndTime ?? null,
      });
    }

    return map;
  }, [featuredPlacement, pastPlacement, searchResults]);

  useEffect(() => {
    const nextFeatured = (featuredPlacement ?? []).map((p: any) => p.gigId);
    const nextPast = (pastPlacement ?? []).map((p: any) => p.gigId);

    setFeaturedIds(nextFeatured.slice(0, 1));
    setPastIds(nextPast);
    setSavedFeaturedIds(nextFeatured.slice(0, 1));
    setSavedPastIds(nextPast);
  }, [featuredPlacement, pastPlacement]);

  const hasChanges =
    JSON.stringify(featuredIds) !== JSON.stringify(savedFeaturedIds) ||
    JSON.stringify(pastIds) !== JSON.stringify(savedPastIds);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeGigId = active.id as string;
    const overId = over.id as string;

    const from = findContainerId(activeGigId, featuredIds, pastIds);
    const to =
      findContainerId(overId, featuredIds, pastIds) ??
      (overId === "featured" || overId === "past" ? overId : null);
    if (!from || !to) return;

    if (from === to) {
      // Reorder within container
      const ids = from === "featured" ? featuredIds : pastIds;
      const oldIndex = ids.indexOf(activeGigId);
      const newIndex = ids.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = arrayMove(ids, oldIndex, newIndex);
      if (from === "featured") setFeaturedIds(next);
      else setPastIds(next);
      return;
    }

    // Move between containers
    let nextFeatured = removeFromArray(featuredIds, activeGigId);
    let nextPast = removeFromArray(pastIds, activeGigId);

    // Remove duplicates across both
    nextFeatured = removeFromArray(nextFeatured, activeGigId);
    nextPast = removeFromArray(nextPast, activeGigId);

    if (to === "featured") {
      const existing = nextFeatured[0];
      if (existing && existing !== activeGigId) {
        nextPast = [existing, ...nextPast];
      }
      nextFeatured = [activeGigId];
    } else {
      const overGigId = overId === "past" ? null : overId;
      const targetIndex = overGigId ? nextPast.indexOf(overGigId) : -1;
      if (targetIndex === -1) nextPast = [...nextPast, activeGigId];
      else
        nextPast = [
          ...nextPast.slice(0, targetIndex),
          activeGigId,
          ...nextPast.slice(targetIndex),
        ];
    }

    setFeaturedIds(nextFeatured.slice(0, 1));
    setPastIds(nextPast);
  };

  const handleRemove = (id: string) => {
    setFeaturedIds((prev) => removeFromArray(prev, id));
    setPastIds((prev) => removeFromArray(prev, id));
  };

  const setFeatured = (id: string) => {
    setPastIds((prevPast) => {
      const nextPast = removeFromArray(
        removeFromArray(prevPast, id),
        featuredIds[0] ?? "",
      );
      return featuredIds[0] && featuredIds[0] !== id
        ? [featuredIds[0], ...nextPast]
        : nextPast;
    });
    setFeaturedIds([id]);
  };

  const addToPast = (id: string) => {
    setFeaturedIds((prev) => removeFromArray(prev, id));
    setPastIds((prev) => {
      const next = removeFromArray(prev, id);
      return [...next, id];
    });
  };

  const handleDiscard = () => {
    setFeaturedIds(savedFeaturedIds);
    setPastIds(savedPastIds);
  };

  const handleSave = async () => {
    await Promise.all([
      setPlacements.mutateAsync({
        section: "FEATURED_RECENT_PAST",
        gigIds: featuredIds.slice(0, 1),
      }),
      setPlacements.mutateAsync({
        section: "PAST_RECENT_LIST",
        gigIds: pastIds,
      }),
    ]);

    await Promise.all([
      utils.homeGigs.getPlacements.invalidate({
        section: "FEATURED_RECENT_PAST",
      }),
      utils.homeGigs.getPlacements.invalidate({ section: "PAST_RECENT_LIST" }),
      utils.homeGigs.getHomeRecent.invalidate(),
    ]);
  };

  const isLoading = isLoadingFeatured || isLoadingPast;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Home “Recent Gigs” placements</CardTitle>
          <CardDescription>
            Drag to reorder, move between lists, and save. The Home page shows 1
            featured gig + 2 past gigs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[240px] flex-1">
              <Input
                placeholder="Search gigs to add…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {hasChanges ? (
              <>
                <Button onClick={handleSave} disabled={setPlacements.isPending}>
                  {setPlacements.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDiscard}
                  disabled={setPlacements.isPending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Discard
                </Button>
              </>
            ) : null}
          </div>

          {search.trim() ? (
            <div className="border-border space-y-2 border p-3">
              <p className="text-sm font-medium">Results</p>
              {isLoadingSearch ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              ) : searchResults?.length ? (
                <div className="space-y-2">
                  {searchResults.slice(0, 10).map((g) => (
                    <div
                      key={g.id}
                      className="border-border bg-background flex flex-wrap items-center justify-between gap-2 border px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{g.title}</p>
                        <p className="text-muted-foreground truncate text-sm">
                          {g.subtitle}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setFeatured(g.id)}
                          className="gap-1"
                        >
                          <Star className="h-4 w-4" />
                          Set featured
                        </Button>
                        <Button size="sm" onClick={() => addToPast(g.id)}>
                          Add to past
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No results.</p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Featured (Recent Past)
              </CardTitle>
              <CardDescription>
                Exactly 1 gig will be featured on the Home page.
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
                      <div className="border-border text-muted-foreground border border-dashed p-4 text-sm">
                        Drop a gig here to set the featured slot.
                      </div>
                    ) : (
                      featuredIds.map((id) => (
                        <SortableGigRow
                          key={id}
                          id={id}
                          gig={gigMap.get(id)}
                          onRemove={handleRemove}
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
              <CardTitle>Past list</CardTitle>
              <CardDescription>
                Home shows the first 2 items from this list.
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
                  items={pastIds}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableContainer id="past" className="space-y-2">
                    {pastIds.length === 0 ? (
                      <div className="border-border text-muted-foreground border border-dashed p-4 text-sm">
                        Drop gigs here to build the past list.
                      </div>
                    ) : (
                      pastIds.map((id) => (
                        <SortableGigRow
                          key={id}
                          id={id}
                          gig={gigMap.get(id)}
                          onRemove={handleRemove}
                        />
                      ))
                    )}
                  </DroppableContainer>
                </SortableContext>
              )}
            </CardContent>
          </Card>
        </div>
      </DndContext>
    </div>
  );
}
