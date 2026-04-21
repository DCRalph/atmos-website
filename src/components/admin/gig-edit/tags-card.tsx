"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
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
import { Loader2, X } from "lucide-react";
import { api } from "~/trpc/react";

type GigTagAssignment = {
  id: string;
  gigTag: {
    id: string;
    name: string;
    color: string;
    description: string | null;
  };
};

type TagsCardProps = {
  gigId: string;
  gigTags: GigTagAssignment[];
  onSaved: () => Promise<unknown> | void;
};

export function TagsCard({ gigId, gigTags, onSaved }: TagsCardProps) {
  const [tagSearch, setTagSearch] = useState("");
  const tagSearchInputRef = useRef<HTMLInputElement>(null);
  const [tagToRemove, setTagToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [tagBeingAdded, setTagBeingAdded] = useState<string | null>(null);
  const [tagBeingRemoved, setTagBeingRemoved] = useState<string | null>(null);

  const { data: allTags, isLoading: isLoadingTags } =
    api.gigTags.getAll.useQuery(
      tagSearch.trim() ? { search: tagSearch } : undefined,
    );

  const assignTag = api.gigs.assignTag.useMutation({
    onSuccess: async (_data, variables) => {
      await onSaved();
      const justAdded = allTags?.find((t) => t.id === variables.tagId);
      toast.success(
        justAdded ? `Added "${justAdded.name}"` : "Tag added",
      );
      setTagBeingAdded(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add tag");
      setTagBeingAdded(null);
    },
  });

  const removeTag = api.gigs.removeTag.useMutation({
    onSuccess: async (_data, variables) => {
      await onSaved();
      const removed = gigTags.find((gt) => gt.gigTag.id === variables.tagId);
      toast.success(
        removed ? `Removed "${removed.gigTag.name}"` : "Tag removed",
      );
      setIsRemoveDialogOpen(false);
      setTagToRemove(null);
      setTagBeingRemoved(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to remove tag");
      setTagBeingRemoved(null);
    },
  });

  const assignedTagIds = new Set(gigTags.map((gt) => gt.gigTag.id));
  const availableTags =
    allTags?.filter((tag) => !assignedTagIds.has(tag.id)) ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Categorize this gig with one or more tags
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wide">
              Assigned
            </Label>
            <div className="flex flex-wrap gap-2">
              {gigTags.map((gt) => (
                <div
                  key={gt.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium"
                  style={{
                    backgroundColor: `${gt.gigTag.color}20`,
                    borderColor: gt.gigTag.color,
                    color: gt.gigTag.color,
                  }}
                >
                  <span>{gt.gigTag.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTagToRemove({
                        id: gt.gigTag.id,
                        name: gt.gigTag.name,
                      });
                      setIsRemoveDialogOpen(true);
                    }}
                    disabled={removeTag.isPending}
                    className="ml-1 hover:opacity-70 disabled:opacity-50"
                    aria-label={`Remove ${gt.gigTag.name} tag`}
                  >
                    {tagBeingRemoved === gt.gigTag.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                </div>
              ))}
              {gigTags.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No tags assigned yet.
                </p>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="mb-2 block text-xs uppercase tracking-wide">
              Add tags
            </Label>
            <div className="relative mb-3">
              <Input
                ref={tagSearchInputRef}
                placeholder="Search tags..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="w-full pr-8"
              />
              {isLoadingTags && (
                <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
              )}
            </div>
            {isLoadingTags ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            ) : availableTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Button
                    key={tag.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      setTagBeingAdded(tag.id);
                      assignTag.mutate({ gigId, tagId: tag.id });
                      setTimeout(() => {
                        tagSearchInputRef.current?.focus();
                      }, 0);
                    }}
                    disabled={
                      assignTag.isPending && tagBeingAdded === tag.id
                    }
                    className="flex items-center gap-2"
                  >
                    {assignTag.isPending && tagBeingAdded === tag.id ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <span
                          className="h-3 w-3 rounded border"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span>{tag.name}</span>
                      </>
                    )}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {tagSearch.trim()
                  ? "No tags match your search."
                  : "All tags are assigned. Create more in Gig Tags."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={isRemoveDialogOpen}
        onOpenChange={(open) => {
          setIsRemoveDialogOpen(open);
          if (!open) setTagToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove tag</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the tag &quot;{tagToRemove?.name}&quot; from this gig?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeTag.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (tagToRemove) {
                  setTagBeingRemoved(tagToRemove.id);
                  removeTag.mutate({ gigId, tagId: tagToRemove.id });
                }
              }}
              disabled={removeTag.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeTag.isPending ? (
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
