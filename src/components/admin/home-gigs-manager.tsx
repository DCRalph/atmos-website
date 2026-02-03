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
import {
  ArrowDown,
  GripVertical,
  Loader2,
  RotateCcw,
  Save,
  Search,
  Star,
} from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";

const HOME_FEATURED_COUNT = 1;
const HOME_PAST_SHOWN_COUNT = 4;
const RECENT_UNPLACED_COUNT = 5;

type Placement = RouterOutputs["homeGigs"]["getPlacements"][number];
type GigFromList = RouterOutputs["gigs"]["getAll"][number];
type GigSummary = NonNullable<Placement["gig"]>;

function isPastGig(g: GigFromList, now: Date) {
  if (g.gigEndTime) return g.gigEndTime < now;
  if (g.gigStartTime) return g.gigStartTime < now;
  return false;
}

function gigSortTime(g: GigFromList) {
  const t = g.gigEndTime ?? g.gigStartTime ?? null;
  return t ? t.getTime() : 0;
}

function formatGigDateLabel(gig: GigSummary | undefined) {
  const date = gig?.gigStartTime ?? gig?.gigEndTime ?? null;
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

function SortableGigRow({
  id,
  gig,
  container,
  index,
  onRemove,
  onSetFeatured,
  onMoveToPast,
}: {
  id: string;
  gig: GigSummary | undefined;
  container: "featured" | "past";
  index?: number;
  onRemove: (id: string) => void;
  onSetFeatured: (id: string) => void;
  onMoveToPast: (id: string) => void;
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
          <p className="truncate font-medium">{gig?.title ?? "Unknown gig"}</p>
          {container === "featured" ? (
            <Badge variant="secondary">
              <Star className="h-3 w-3" />
              Featured
            </Badge>
          ) : index !== undefined && index < HOME_PAST_SHOWN_COUNT ? (
            <Badge>Shown on Home</Badge>
          ) : (
            <Badge variant="outline">Overflow</Badge>
          )}
          {formatGigDateLabel(gig) ? (
            <span className="text-muted-foreground text-xs">
              {formatGigDateLabel(gig)}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground truncate text-sm">
          {gig?.subtitle ?? id}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {container === "past" ? (
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
            onClick={() => onMoveToPast(id)}
            aria-label="Move to past list"
            title="Move to past list"
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
    api.homeGigs.getPlacements.useQuery({ section: "FEATURED" });
  const { data: pastPlacement, isLoading: isLoadingPast } =
    api.homeGigs.getPlacements.useQuery({ section: "PAST" });

  const setPlacements = api.homeGigs.setPlacements.useMutation();

  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [pastIds, setPastIds] = useState<string[]>([]);
  const [savedFeaturedIds, setSavedFeaturedIds] = useState<string[]>([]);
  const [savedPastIds, setSavedPastIds] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim();

  const { data: gigsList, isLoading: isLoadingGigsList } =
    api.gigs.getAll.useQuery(undefined, { staleTime: 60_000 });
  const { data: searchResultsRaw, isLoading: isLoadingSearch } =
    api.gigs.getAll.useQuery(
      trimmedSearch ? { search: trimmedSearch } : undefined,
      { enabled: !!trimmedSearch },
    );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // Build gig info map from placements + gig list
  const gigMap = useMemo(() => {
    const map = new Map<string, GigSummary>();

    for (const p of featuredPlacement ?? []) {
      if (p.gig) map.set(p.gig.id, p.gig);
    }
    for (const p of pastPlacement ?? []) {
      if (p.gig) map.set(p.gig.id, p.gig);
    }
    for (const g of gigsList ?? []) {
      map.set(g.id, {
        id: g.id,
        title: g.title,
        subtitle: g.subtitle,
        gigStartTime: g.gigStartTime ?? null,
        gigEndTime: g.gigEndTime ?? null,
      } satisfies GigSummary);
    }

    return map;
  }, [featuredPlacement, pastPlacement, gigsList]);

  useEffect(() => {
    const nextFeatured = (featuredPlacement ?? []).map((p) => p.gigId);
    const nextPast = (pastPlacement ?? []).map((p) => p.gigId);

    setFeaturedIds(nextFeatured.slice(0, HOME_FEATURED_COUNT));
    setPastIds(nextPast);
    setSavedFeaturedIds(nextFeatured.slice(0, HOME_FEATURED_COUNT));
    setSavedPastIds(nextPast);
  }, [featuredPlacement, pastPlacement]);

  const hasChanges =
    JSON.stringify(featuredIds) !== JSON.stringify(savedFeaturedIds) ||
    JSON.stringify(pastIds) !== JSON.stringify(savedPastIds);

  useUnsavedChangesWarning({ enabled: hasChanges });

  const now = useMemo(() => new Date(), []);

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

    setFeaturedIds(nextFeatured.slice(0, HOME_FEATURED_COUNT));
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

  const addToPast = (id: string, where: "start" | "end" = "end") => {
    setFeaturedIds((prev) => removeFromArray(prev, id));
    setPastIds((prev) => {
      const next = removeFromArray(prev, id);
      return where === "start" ? [id, ...next] : [...next, id];
    });
  };

  const handleDiscard = () => {
    setSaveError(null);
    setLastSavedAt(null);
    setFeaturedIds(savedFeaturedIds);
    setPastIds(savedPastIds);
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      await Promise.all([
        setPlacements.mutateAsync({
          section: "FEATURED",
          gigIds: featuredIds.slice(0, HOME_FEATURED_COUNT),
        }),
        setPlacements.mutateAsync({
          section: "PAST",
          gigIds: pastIds,
        }),
      ]);

      setSavedFeaturedIds(featuredIds.slice(0, HOME_FEATURED_COUNT));
      setSavedPastIds(pastIds);
      setLastSavedAt(Date.now());

      await Promise.all([
        utils.homeGigs.getPlacements.invalidate({
          section: "FEATURED",
        }),
        utils.homeGigs.getPlacements.invalidate({
          section: "PAST",
        }),
        utils.homeGigs.getHomeRecent.invalidate(),
      ]);
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Failed to save. Please try again.",
      );
    }
  };

  const isLoading = isLoadingFeatured || isLoadingPast;
  const isSaving = setPlacements.isPending;
  const selectedIds = useMemo(
    () => new Set<string>([...featuredIds, ...pastIds]),
    [featuredIds, pastIds],
  );
  const recentUnselectedGigs = useMemo(() => {
    const list = (gigsList ?? [])
      .filter((g) => isPastGig(g, now))
      .filter((g) => !selectedIds.has(g.id))
      .sort((a, b) => gigSortTime(b) - gigSortTime(a));
    return list.slice(0, RECENT_UNPLACED_COUNT);
  }, [gigsList, now, selectedIds]);

  const searchResults = useMemo(() => {
    const list = (searchResultsRaw ?? []).filter((g) => isPastGig(g, now));
    return list.slice(0, 20);
  }, [searchResultsRaw, now]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Home “Recent Gigs”</CardTitle>
            <CardDescription>
              Pick a featured past gig and order the past list. Home shows{" "}
              {HOME_FEATURED_COUNT} featured + the first {HOME_PAST_SHOWN_COUNT}{" "}
              items from the past list.
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
                      pastIds.length >= HOME_PAST_SHOWN_COUNT
                        ? "default"
                        : "secondary"
                    }
                  >
                    {Math.min(pastIds.length, HOME_PAST_SHOWN_COUNT)}/
                    {HOME_PAST_SHOWN_COUNT}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">Past list</span>
                  <Badge variant={pastIds.length ? "default" : "secondary"}>
                    {pastIds.length}
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
                        {gigMap.get(featuredIds[0])?.title ?? "Unknown gig"}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {gigMap.get(featuredIds[0])?.subtitle ?? featuredIds[0]}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      No featured gig selected.
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-md border">
                <div className="border-b px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">Past list</span>
                    <Badge variant="secondary">
                      Slots 2–{HOME_PAST_SHOWN_COUNT + 1}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2 px-3 py-2">
                  {pastIds.slice(0, HOME_PAST_SHOWN_COUNT).length ? (
                    pastIds.slice(0, HOME_PAST_SHOWN_COUNT).map((id, idx) => (
                      <div key={id} className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {gigMap.get(id)?.title ?? "Unknown gig"}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {gigMap.get(id)?.subtitle ?? id}
                          </p>
                        </div>
                        <Badge variant="outline">#{idx + 1}</Badge>
                      </div>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      Add at least {HOME_PAST_SHOWN_COUNT} past gigs to populate
                      Home.
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
                    Exactly {HOME_FEATURED_COUNT} gig appears as featured.
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
                            Drop a past gig here, or use “Set featured” from
                            search results.
                          </div>
                        ) : (
                          featuredIds.map((id) => (
                            <SortableGigRow
                              key={id}
                              id={id}
                              container="featured"
                              gig={gigMap.get(id)}
                              onRemove={handleRemove}
                              onSetFeatured={setFeatured}
                              onMoveToPast={(gid) => addToPast(gid, "start")}
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
                    Home shows the first {HOME_PAST_SHOWN_COUNT} items from this
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
                      items={pastIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <DroppableContainer id="past" className="space-y-2">
                        {pastIds.length === 0 ? (
                          <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                            Drop gigs here to build the past list.
                          </div>
                        ) : (
                          pastIds.map((id, idx) => (
                            <SortableGigRow
                              key={id}
                              id={id}
                              container="past"
                              index={idx}
                              gig={gigMap.get(id)}
                              onRemove={handleRemove}
                              onSetFeatured={setFeatured}
                              onMoveToPast={(gid) => addToPast(gid, "end")}
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
                  <CardTitle>Add gigs</CardTitle>
                  <CardDescription>
                    Quickly add gigs, or search to find older ones.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="Search gigs by title, subtitle, or short/long description…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="rounded-md border">
                  <div className="border-b px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {trimmedSearch ? "Results" : "Recent unplaced gigs"}
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
                        searchResults.map((g) => {
                          const alreadySelected = selectedIds.has(g.id);
                          const inFeatured = featuredIds.includes(g.id);
                          const inPast = pastIds.includes(g.id);

                          return (
                            <div
                              key={g.id}
                              className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3 last:border-b-0"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {g.title}
                                </p>
                                <p className="text-muted-foreground truncate text-xs">
                                  {g.subtitle}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {alreadySelected ? (
                                  <Badge variant="secondary">
                                    {inFeatured
                                      ? "In featured"
                                      : inPast
                                        ? "In past list"
                                        : "Selected"}
                                  </Badge>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setFeatured(g.id)}
                                  disabled={isSaving}
                                >
                                  <Star className="mr-2 h-4 w-4" />
                                  Featured
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => addToPast(g.id, "end")}
                                  disabled={isSaving}
                                >
                                  Add to past
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-muted-foreground px-3 py-4 text-sm">
                          No gigs found.
                        </div>
                      )
                    ) : isLoadingGigsList ? (
                      <div className="text-muted-foreground flex items-center gap-2 px-3 py-4 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                      </div>
                    ) : recentUnselectedGigs.length ? (
                      recentUnselectedGigs.map((g) => (
                        <div
                          key={g.id}
                          className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {g.title}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {g.subtitle}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setFeatured(g.id)}
                              disabled={isSaving}
                            >
                              <Star className="mr-2 h-4 w-4" />
                              Featured
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => addToPast(g.id, "end")}
                              disabled={isSaving}
                            >
                              Add to past
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground px-3 py-4 text-sm">
                        No unplaced past gigs found.
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
