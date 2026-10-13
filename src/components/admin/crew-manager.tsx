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
import { GripVertical, Loader2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useConfirm } from "~/components/confirm-provider";
import { ArtistCoreSheet } from "~/components/admin/artist-core-sheet";
import { ProfileAvatar } from "~/components/admin/profile-avatar";
import { CrewMemberDialog } from "~/components/admin/crew-member-dialog";
import { resolveCrewDisplay } from "~/lib/crew-display";
import { cn } from "~/lib/utils";

export type CrewRow = RouterOutputs["crew"]["getAll"][number];

/**
 * The crew directory, in the order the public page shows it.
 *
 * A row is either linked to an artist profile (name, photo and socials come
 * from there) or manual. The table shows what the public page renders, plus
 * where it comes from, so gaps are visible at a glance.
 */
export function CrewManager() {
  const confirm = useConfirm();
  const { data, isLoading, refetch } = api.crew.getAll.useQuery();
  // Holds the dragged order until the save lands, so rows don't jump back.
  const [order, setOrder] = useState<string[] | null>(null);
  const [dialog, setDialog] = useState<
    { kind: "add" } | { kind: "edit"; member: CrewRow } | null
  >(null);
  const [sheetProfileId, setSheetProfileId] = useState<string | null>(null);

  const reorder = api.crew.reorder.useMutation({
    onError: (error) => toast.error(error.message),
    onSettled: async () => {
      await refetch();
      setOrder(null);
    },
  });
  const deleteMember = api.crew.delete.useMutation({
    onSuccess: async () => {
      toast.success("Removed from the crew");
      await refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const makeProfile = api.crew.makeProfile.useMutation({
    onSuccess: async ({ profileId, handle }) => {
      toast.success(`Created @${handle}`);
      await refetch();
      setSheetProfileId(profileId);
    },
    onError: (error) => toast.error(error.message),
  });

  const fetched = data ?? [];
  const byId = new Map(fetched.map((row) => [row.id, row]));
  const rows = order
    ? order.flatMap((id) => byId.get(id) ?? [])
    : fetched;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = rows.map((row) => row.id);
    const next = arrayMove(
      ids,
      ids.indexOf(String(active.id)),
      ids.indexOf(String(over.id)),
    );
    setOrder(next);
    reorder.mutate({ ids: next });
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Drag rows to reorder the public crew page.
          </p>
          <Button onClick={() => setDialog({ kind: "add" })}>
            <Plus className="h-4 w-4" aria-hidden />
            Add member
          </Button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Socials</TableHead>
                <TableHead>Source</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No crew members yet.
                  </TableCell>
                </TableRow>
              ) : (
                <SortableContext
                  items={rows.map((row) => row.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {rows.map((member) => (
                    <SortableCrewRow
                      key={member.id}
                      member={member}
                      onEdit={() => setDialog({ kind: "edit", member })}
                      onOpenProfile={setSheetProfileId}
                      onMakeProfile={async () => {
                        const ok = await confirm({
                          title: `Make an artist profile for ${member.name}?`,
                          description:
                            "Creates an unclaimed, unpublished profile from this row's name, photo and socials, and links it. From then on they're edited on the profile.",
                          confirmLabel: "Make profile",
                        });
                        if (ok) makeProfile.mutate({ id: member.id });
                      }}
                      onDelete={async () => {
                        const ok = await confirm({
                          title: `Remove ${member.name} from the crew?`,
                          description:
                            "They come off the public crew page. Any linked artist profile is kept.",
                          confirmLabel: "Remove",
                          variant: "destructive",
                        });
                        if (ok) deleteMember.mutate({ id: member.id });
                      }}
                    />
                  ))}
                </SortableContext>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </CardContent>

      <CrewMemberDialog
        // A fresh form per open, so add and edit never share leftover state.
        key={
          dialog?.kind === "edit" ? dialog.member.id : (dialog?.kind ?? "closed")
        }
        open={Boolean(dialog)}
        member={dialog?.kind === "edit" ? dialog.member : null}
        onClose={() => setDialog(null)}
        onSaved={async () => {
          setDialog(null);
          await refetch();
        }}
        onEditProfile={(profileId) => {
          setDialog(null);
          setSheetProfileId(profileId);
        }}
      />

      <ArtistCoreSheet
        profileId={sheetProfileId}
        onClose={() => setSheetProfileId(null)}
      />
    </Card>
  );
}

function SortableCrewRow({
  member,
  onEdit,
  onOpenProfile,
  onMakeProfile,
  onDelete,
}: {
  member: CrewRow;
  onEdit: () => void;
  onOpenProfile: (profileId: string) => void;
  onMakeProfile: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id });
  const display = resolveCrewDisplay(member);
  const profile = member.artistProfile;
  const socials = [
    display.instagram && "IG",
    display.soundcloud && "SC",
  ].filter(Boolean);

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "bg-muted relative z-10 opacity-80")}
    >
      <TableCell>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground -m-2 cursor-grab touch-none p-2 active:cursor-grabbing"
          aria-label={`Drag to reorder ${display.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell>
        <ProfileAvatar src={display.image} name={display.name} />
      </TableCell>
      <TableCell className="font-medium">{display.name}</TableCell>
      <TableCell>
        {display.role ? (
          <span className={cn(display.roleFromTagline && "text-muted-foreground")}>
            {display.role}
            {display.roleFromTagline ? (
              <span className="ml-1.5 text-[10px] tracking-wide uppercase">
                tagline
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">No role</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {socials.length ? socials.join(" · ") : "None"}
      </TableCell>
      <TableCell>
        {profile ? (
          <button
            type="button"
            onClick={() => onOpenProfile(profile.id)}
            className="text-primary font-mono text-xs hover:underline"
          >
            @{profile.handle}
          </button>
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
              Manual
            </span>
            {display.image ? null : (
              <span className="text-destructive text-xs">No photo</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onMakeProfile}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Make profile
            </Button>
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            Remove
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
