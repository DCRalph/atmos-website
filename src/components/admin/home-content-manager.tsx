"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Plus, Video } from "lucide-react";
import { toast } from "sonner";
import { api, type RouterOutputs } from "~/trpc/react";
import { HOME_ITEM_COUNT, contentVideoId } from "~/lib/home-content";
import { cn } from "~/lib/utils";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import { SaveBar, type SaveStatus } from "~/components/admin/save-status";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type ContentItem = RouterOutputs["content"]["getAll"][number];
type Arrangement = { videoId: string; itemIds: string[] };
const fingerprint = (value: Arrangement) => JSON.stringify(value);

/** The same four slots Home renders, committed together by one Save. */
export function HomeContentManager() {
  const utils = api.useUtils();
  const content = api.content.getAll.useQuery();
  const home = api.homeContent.getHomeLatest.useQuery();
  const savePlacements = api.homeContent.setAllPlacements.useMutation();
  const [draft, setDraft] = useState<Arrangement | null>(null);
  const [baseline, setBaseline] = useState<Arrangement | null>(null);
  const [saveState, setSaveState] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const baselineFingerprint = baseline ? fingerprint(baseline) : null;
  const dirty = draft !== null && fingerprint(draft) !== baselineFingerprint;
  const saving = saveState === "saving" || savePlacements.isPending;

  const serverState = home.data
    ? {
        videoId: home.data.video?.id ?? "",
        itemIds: home.data.items.map((item) => item.id),
      }
    : null;
  const serverFingerprint = serverState ? fingerprint(serverState) : null;
  if (
    serverState &&
    serverFingerprint &&
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
  const videos = items.filter((item) => contentVideoId(item));
  const selectedVideo = items.find((item) => item.id === draft?.videoId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const itemIds = Array.from(
    { length: HOME_ITEM_COUNT },
    (_, i) => draft?.itemIds[i] ?? "",
  );
  const slotKeys = ["home-item-0", "home-item-1", "home-item-2"];

  const move = (from: number, to: number) => {
    if (!draft || to < 0 || to >= HOME_ITEM_COUNT) return;
    setDraft({ ...draft, itemIds: arrayMove(itemIds, from, to) });
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(
      slotKeys.indexOf(String(active.id)),
      slotKeys.indexOf(String(over.id)),
    );
  };
  const save = async () => {
    if (!draft || saving) return;
    if (!draft.videoId || itemIds.some((id) => !id)) {
      setError("Choose a YouTube video and all three items.");
      setSaveState("error");
      return;
    }
    setError(null);
    setSaveState("saving");
    try {
      await savePlacements.mutateAsync({
        videoContentItemId: draft.videoId,
        itemContentItemIds: itemIds,
      });
      setBaseline(draft);
      await utils.homeContent.invalidate();
      setSaveState("saved");
      toast.success("Home content saved");
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Couldn't save the home content.";
      setError(message);
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

  return (
    <SaveBar
      status={
        dirty && (saveState === "idle" || saveState === "saved")
          ? "dirty"
          : saveState
      }
      errorMessage={error}
      message="One video above three items, as they appear on Home."
      saveLabel="Save home content"
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
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Home video</CardTitle>
            <CardDescription>
              A YouTube video spanning the full width of the content section.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="home-video">YouTube video</Label>
              <Select
                value={draft?.videoId ?? undefined}
                disabled={saving || videos.length === 0}
                onValueChange={(videoId) =>
                  setDraft((current) =>
                    current
                      ? {
                          videoId,
                          itemIds: current.itemIds.map((id) =>
                            id === videoId ? current.videoId : id,
                          ),
                        }
                      : current,
                  )
                }
              >
                <SelectTrigger id="home-video" className="w-full">
                  <SelectValue placeholder="Choose a YouTube video" />
                </SelectTrigger>
                <SelectContent>
                  {videos.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedVideo?.imageUrl ? (
              <div className="relative aspect-video max-w-lg overflow-hidden rounded-md">
                <Image
                  src={selectedVideo.imageUrl}
                  alt={selectedVideo.title}
                  fill
                  sizes="(min-width: 640px) 512px, 100vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Video className="size-4" />
                {videos.length
                  ? "Choose the video to play on Home."
                  : "Add a YouTube video to your content first."}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Three items below</CardTitle>
            <CardDescription>
              Choose the items, then drag or use the arrows to set their order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={slotKeys}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {slotKeys.map((key, index) => (
                    <ItemSlot
                      key={key}
                      id={key}
                      index={index}
                      value={itemIds[index] ?? ""}
                      disabled={saving}
                      items={items.filter(
                        (item) =>
                          item.id !== draft?.videoId &&
                          (item.id === itemIds[index] ||
                            !itemIds.includes(item.id)),
                      )}
                      onChange={(value) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                itemIds: itemIds.map((id, i) =>
                                  i === index ? value : id,
                                ),
                              }
                            : current,
                        )
                      }
                      onMove={(to) => move(index, to)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
        <Button variant="outline" asChild className="w-fit">
          <Link href="/admin/content/new">
            <Plus className="size-4" />
            Add content
          </Link>
        </Button>
      </div>
    </SaveBar>
  );
}

function ItemSlot({
  id,
  index,
  value,
  items,
  disabled,
  onChange,
  onMove,
}: {
  id: string;
  index: number;
  value: string;
  items: ContentItem[];
  disabled: boolean;
  onChange: (value: string) => void;
  onMove: (index: number) => void;
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
        "bg-background flex min-w-0 items-center gap-2 rounded-md border p-3",
        isDragging && "relative z-10 opacity-80",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        className="text-muted-foreground shrink-0 cursor-grab touch-none p-2"
        aria-label={`Drag item ${index + 1} to reorder`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label htmlFor={id}>Item {index + 1}</Label>
        <Select
          value={value || undefined}
          disabled={disabled}
          onValueChange={onChange}
        >
          <SelectTrigger id={id} className="w-full min-w-0">
            <SelectValue placeholder="Choose content" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex shrink-0 flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || index === 0}
          onClick={() => onMove(index - 1)}
          aria-label={`Move item ${index + 1} up`}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || index === HOME_ITEM_COUNT - 1}
          onClick={() => onMove(index + 1)}
          aria-label={`Move item ${index + 1} down`}
        >
          <ArrowDown className="size-4" />
        </Button>
      </div>
    </div>
  );
}
