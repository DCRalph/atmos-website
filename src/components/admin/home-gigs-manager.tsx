"use client";

import { useEffect, useMemo, useState } from "react";
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
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, RotateCcw, Save, Search } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import { formatDate } from "~/lib/date-utils";
import { SaveStatusPill, type SaveStatus } from "./save-status";

const RECENT_UNPLACED_COUNT = 5;

type Placement = RouterOutputs["homeGigs"]["getPlacements"][number];
type GigFromList = RouterOutputs["gigs"]["getAll"][number];
type GigSummary = Placement["gig"];

/** Match the public home list's eligibility before offering a gig to add. */
function isEligibleGig(gig: GigFromList, now: Date) {
  return (
    gig.status === "PUBLISHED" &&
    !gig.isTba &&
    !gig.isAffiliated &&
    gig.gigEndTime !== null &&
    gig.gigEndTime < now
  );
}

function formatGigDateLabel(gig: GigSummary | undefined) {
  const date = gig?.gigStartTime ?? gig?.gigEndTime;
  return date ? formatDate(date, "short") : null;
}

function SortableGigRow({
  id,
  gig,
  index,
  disabled,
  onRemove,
}: {
  id: string;
  gig: GigSummary | undefined;
  index: number;
  disabled: boolean;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "border-border bg-background flex items-center gap-3 rounded-md border px-3 py-2",
        isDragging && "opacity-70",
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground -m-2 cursor-grab touch-none p-2 active:cursor-grabbing disabled:cursor-default"
            aria-label={`Reorder ${gig?.title ?? "gig"}`}
            disabled={disabled}
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
          <Badge variant="outline">#{index + 1}</Badge>
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => onRemove(id)}
        disabled={disabled}
      >
        Remove
      </Button>
    </div>
  );
}

export function HomeGigsManager() {
  const utils = api.useUtils();
  const placements = api.homeGigs.getPlacements.useQuery();
  const savePlacements = api.homeGigs.setPlacements.useMutation();
  const [gigIds, setGigIds] = useState<string[]>([]);
  const [savedGigIds, setSavedGigIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const trimmedSearch = useDebouncedValue(search).trim();
  const { data: gigsList, isLoading: isLoadingGigsList } =
    api.gigs.getAll.useQuery(undefined, { staleTime: 60_000 });
  const { data: searchResultsRaw, isLoading: isLoadingSearch } =
    api.gigs.getAll.useQuery(
      trimmedSearch ? { search: trimmedSearch } : undefined,
      { enabled: !!trimmedSearch },
    );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveStatus>("idle");

  const gigMap = useMemo(() => {
    const map = new Map<string, GigSummary>();
    for (const placement of placements.data ?? []) {
      map.set(placement.gig.id, placement.gig);
    }
    for (const gig of gigsList ?? []) {
      map.set(gig.id, {
        id: gig.id,
        slug: gig.slug,
        title: gig.title,
        subtitle: gig.subtitle,
        gigStartTime: gig.gigStartTime,
        gigEndTime: gig.gigEndTime,
      });
    }
    return map;
  }, [placements.data, gigsList]);

  const hasChanges = JSON.stringify(gigIds) !== JSON.stringify(savedGigIds);
  const isSaving = savePlacements.isPending;
  const disabled = isSaving || placements.isPending || placements.isError;
  const serverIds = useMemo(
    () => (placements.data ?? []).map((placement) => placement.gigId),
    [placements.data],
  );
  const serverKey = placements.data ? JSON.stringify(serverIds) : null;
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  // Background refetches must not discard unsaved reordering or interrupt a save.
  if (serverKey && serverKey !== hydratedKey && !isSaving && !hasChanges) {
    setHydratedKey(serverKey);
    setGigIds(serverIds);
    setSavedGigIds(serverIds);
  }

  useUnsavedChangesWarning({ enabled: hasChanges && !isSaving });

  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = setTimeout(() => setSaveState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [saveState]);

  const status: SaveStatus =
    hasChanges && (saveState === "idle" || saveState === "saved")
      ? "dirty"
      : saveState;
  const now = useMemo(() => new Date(), []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Focus a grip, space to pick up, arrows to move, space to drop.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || disabled) return;
    const oldIndex = gigIds.indexOf(String(active.id));
    const newIndex = gigIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    setGigIds((ids) => arrayMove(ids, oldIndex, newIndex));
  };

  const handleRemove = (id: string) => {
    setGigIds((ids) => ids.filter((gigId) => gigId !== id));
  };

  const addGig = (id: string) => {
    setGigIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  };

  const handleDiscard = () => {
    setSaveError(null);
    setSaveState("idle");
    setGigIds(savedGigIds);
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaveState("saving");
    const nextIds = [...gigIds];
    try {
      await savePlacements.mutateAsync({ gigIds: nextIds });
      setSavedGigIds(nextIds);
      setSaveState("saved");
      await Promise.all([
        utils.homeGigs.getPlacements.invalidate(),
        utils.homeGigs.getHomeRecent.invalidate(),
      ]);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to save. Please try again.",
      );
      setSaveState("error");
    }
  };

  const selectedIds = useMemo(() => new Set(gigIds), [gigIds]);
  const recentUnselectedGigs = useMemo(
    () =>
      (gigsList ?? [])
        .filter((gig) => isEligibleGig(gig, now) && !selectedIds.has(gig.id))
        .sort(
          (a, b) =>
            (b.gigEndTime?.getTime() ?? 0) - (a.gigEndTime?.getTime() ?? 0),
        )
        .slice(0, RECENT_UNPLACED_COUNT),
    [gigsList, now, selectedIds],
  );
  const searchResults = useMemo(
    () =>
      (searchResultsRaw ?? [])
        .filter((gig) => isEligibleGig(gig, now))
        .slice(0, 20),
    [searchResultsRaw, now],
  );
  const candidates = trimmedSearch ? searchResults : recentUnselectedGigs;
  const candidatesLoading = trimmedSearch ? isLoadingSearch : isLoadingGigsList;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Home “Recent Gigs”</CardTitle>
            <CardDescription>
              Choose past gigs and drag to set their order on Home. If fewer
              than three published gigs are selected, Home fills the remaining
              places with the latest past gigs.
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
            <Button onClick={handleSave} disabled={!hasChanges || disabled}>
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
          <SaveStatusPill status={status} errorMessage={saveError} />
          {status === "idle" ? (
            <span className="text-muted-foreground text-xs">
              This arrangement is up to date.
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid min-w-0 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Recent gigs</CardTitle>
              <CardDescription>
                All selected gigs appear in this order. Only published,
                announced, non-affiliated past gigs are shown.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {placements.isPending ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : placements.isError ? (
                <div role="alert" className="space-y-3">
                  <p className="text-sm">
                    Couldn&apos;t load the recent gigs list.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void placements.refetch()}
                  >
                    Try again
                  </Button>
                </div>
              ) : gigIds.length === 0 ? (
                <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                  No gigs selected. Home uses the latest past gigs. Add gigs to
                  choose your own order.
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={gigIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {gigIds.map((id, index) => (
                        <SortableGigRow
                          key={id}
                          id={id}
                          index={index}
                          gig={gigMap.get(id)}
                          disabled={disabled}
                          onRemove={handleRemove}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add gigs</CardTitle>
              <CardDescription>
                Quickly add gigs, or search to find older ones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search past gigs…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="rounded-md border">
                <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                  <span className="text-sm font-medium">
                    {trimmedSearch ? "Results" : "Recent unplaced gigs"}
                  </span>
                  <Badge variant="outline">
                    {trimmedSearch ? "Search" : `Top ${RECENT_UNPLACED_COUNT}`}
                  </Badge>
                </div>
                <div className="max-h-[520px] overflow-y-auto">
                  {candidatesLoading ? (
                    <p className="text-muted-foreground px-3 py-4 text-sm">
                      {trimmedSearch ? "Searching…" : "Loading…"}
                    </p>
                  ) : candidates.length ? (
                    candidates.map((gig) => {
                      const selected = selectedIds.has(gig.id);
                      return (
                        <div
                          key={gig.id}
                          className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {gig.title}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {gig.subtitle}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addGig(gig.id)}
                            disabled={disabled || selected}
                          >
                            {selected ? "Added" : "Add gig"}
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-muted-foreground px-3 py-4 text-sm">
                      {trimmedSearch
                        ? "No gigs found."
                        : "No unplaced past gigs found."}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
