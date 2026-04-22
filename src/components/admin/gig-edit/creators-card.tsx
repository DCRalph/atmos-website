"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { GripVertical, Loader2, Search, X } from "lucide-react";
import { api } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";

type GigCreatorRow = {
  id: string;
  role: string | null;
  sortOrder: number;
  creatorProfile: {
    id: string;
    handle: string;
    displayName: string;
    avatarFileId: string | null;
    claimStatus: "ACTIVE" | "UNCLAIMED" | "PENDING_CLAIM";
  };
};

type CreatorsCardProps = {
  gigId: string;
  gigCreators: GigCreatorRow[];
  onSaved: () => Promise<unknown> | void;
};

export function CreatorsCard({ gigId, gigCreators, onSaved }: CreatorsCardProps) {
  const [search, setSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<GigCreatorRow | null>(null);
  const [localOrder, setLocalOrder] = useState<GigCreatorRow[]>(gigCreators);

  // Keep local order in sync when parent data changes.
  useMemo(() => {
    setLocalOrder(gigCreators);
  }, [gigCreators]);

  const { data: searchResults, isLoading: isSearching } =
    api.gigCreators.searchProfiles.useQuery({ query: search });

  const addCreator = api.gigCreators.addCreatorToGig.useMutation({
    onSuccess: async () => {
      await onSaved();
      toast.success("Creator added");
    },
    onError: (err) => toast.error(err.message || "Failed to add creator"),
  });

  const removeCreator = api.gigCreators.removeCreatorFromGig.useMutation({
    onSuccess: async () => {
      await onSaved();
      toast.success("Creator removed");
      setRemoveTarget(null);
    },
    onError: (err) => toast.error(err.message || "Failed to remove creator"),
  });

  const updateRole = api.gigCreators.updateRole.useMutation({
    onSuccess: async () => {
      await onSaved();
    },
    onError: (err) => toast.error(err.message || "Failed to update role"),
  });

  const reorder = api.gigCreators.reorderCreators.useMutation({
    onSuccess: () => void onSaved(),
    onError: (err) => toast.error(err.message || "Failed to reorder"),
  });

  const assignedIds = new Set(gigCreators.map((gc) => gc.creatorProfile.id));
  const available =
    searchResults?.filter((p) => !assignedIds.has(p.id)) ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localOrder.findIndex((g) => g.id === active.id);
    const newIndex = localOrder.findIndex((g) => g.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(localOrder, oldIndex, newIndex);
    setLocalOrder(next);
    reorder.mutate({ gigId, orderedIds: next.map((g) => g.id) });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Line-up</CardTitle>
          <CardDescription>
            Attribute creator profiles to this gig. Drag to reorder. Optional
            per-row role (e.g. Headliner, Support).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs tracking-wide uppercase">
              Assigned
            </Label>
            {localOrder.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No creators assigned yet.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={localOrder.map((g) => g.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="flex flex-col gap-2">
                    {localOrder.map((gc) => (
                      <SortableCreatorRow
                        key={gc.id}
                        row={gc}
                        onRemove={() => setRemoveTarget(gc)}
                        onRoleBlur={(role) => {
                          if ((gc.role ?? "") === role) return;
                          updateRole.mutate({
                            id: gc.id,
                            role: role.trim() ? role.trim() : null,
                          });
                        }}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div className="border-t pt-4">
            <Label className="mb-2 block text-xs tracking-wide uppercase">
              Add creator
            </Label>
            <div className="relative mb-3">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search creators by handle or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9"
              />
              {isSearching && (
                <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
              )}
            </div>
            {available.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {available.map((p) => {
                  const avatar = p.avatarFileId
                    ? buildMediaUrl(p.avatarFileId)
                    : null;
                  return (
                    <Button
                      key={p.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        addCreator.mutate({
                          gigId,
                          creatorProfileId: p.id,
                        })
                      }
                      disabled={addCreator.isPending}
                      className="flex items-center gap-2"
                    >
                      <span className="bg-muted relative h-5 w-5 overflow-hidden rounded-full">
                        {avatar ? (
                          <Image
                            src={avatar}
                            alt=""
                            fill
                            sizes="20px"
                            className="object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="font-medium">{p.displayName}</span>
                      <span className="text-muted-foreground">
                        @{p.handle}
                      </span>
                      {p.claimStatus === "UNCLAIMED" ? (
                        <span className="text-muted-foreground ml-1 rounded border px-1 text-[10px] uppercase">
                          unclaimed
                        </span>
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {search.trim()
                  ? "No matching creators."
                  : "Start typing to find a creator profile."}
              </p>
            )}
            <p className="text-muted-foreground mt-3 text-xs">
              Need a profile for a non-user?{" "}
              <Link
                href="/admin/creator-profiles"
                className="underline hover:text-foreground"
              >
                Create a placeholder profile
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove creator</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removeTarget?.creatorProfile.displayName} from this gig?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeCreator.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeTarget) removeCreator.mutate({ id: removeTarget.id });
              }}
              disabled={removeCreator.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeCreator.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SortableCreatorRow({
  row,
  onRemove,
  onRoleBlur,
}: {
  row: GigCreatorRow;
  onRemove: () => void;
  onRoleBlur: (role: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const [role, setRole] = useState(row.role ?? "");
  const avatar = row.creatorProfile.avatarFileId
    ? buildMediaUrl(row.creatorProfile.avatarFileId)
    : null;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="bg-card flex items-center gap-3 rounded-md border p-3"
    >
      <button
        type="button"
        aria-label="Reorder"
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="bg-muted relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
        {avatar ? (
          <Image
            src={avatar}
            alt=""
            fill
            sizes="36px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs font-bold">
            {row.creatorProfile.displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/@${row.creatorProfile.handle}`}
          target="_blank"
          className="truncate text-sm font-semibold hover:underline"
        >
          {row.creatorProfile.displayName}
        </Link>
        <span className="text-muted-foreground text-xs">
          @{row.creatorProfile.handle}
          {row.creatorProfile.claimStatus === "UNCLAIMED"
            ? " · unclaimed"
            : ""}
        </span>
      </div>
      <Input
        aria-label="Role"
        placeholder="Role (optional)"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        onBlur={() => onRoleBlur(role)}
        className="max-w-[180px]"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        aria-label="Remove creator"
      >
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
}
