"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { GigMediaManager } from "~/components/admin/gig-media-manager";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { utcDateToLocal } from "~/lib/date-utils";
import { Loader2, X } from "lucide-react";
import Image from "next/image";
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

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function GigManagementPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [gigStartTime, setGigStartTime] = useState<Date | undefined>(undefined);
  const [gigEndTime, setGigEndTime] = useState<Date | undefined>(undefined);
  const [ticketLink, setTicketLink] = useState("");

  // Tag management state
  const [tagSearch, setTagSearch] = useState("");
  const tagSearchInputRef = useRef<HTMLInputElement>(null);
  const [tagToRemove, setTagToRemove] = useState<{ id: string; name: string } | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [tagBeingAdded, setTagBeingAdded] = useState<string | null>(null);

  const { data: gig, refetch } = api.gigs.getById.useQuery({ id });
  const [isPosterUploading, setIsPosterUploading] = useState(false);
  // const refetch = async () => {
  //   //noop
  // }

  const updateGig = api.gigs.update.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });
  const deleteGig = api.gigs.delete.useMutation({
    onSuccess: () => {
      router.push("/admin/gigs");
    },
  });
  const assignTag = api.gigs.assignTag.useMutation({
    onSuccess: async () => {
      await refetch();
      setTagBeingAdded(null);
    },
    onError: () => {
      setTagBeingAdded(null);
    },
  });
  const removeTag = api.gigs.removeTag.useMutation({
    onSuccess: async () => {
      await refetch();
      setIsRemoveDialogOpen(false);
      setTagToRemove(null);
    },
  });

  const uploadPoster = api.gigs.uploadPoster.useMutation({
    onSuccess: async () => {
      await refetch();
    },
    onSettled: () => {
      setIsPosterUploading(false);
    },
  });

  const clearPoster = api.gigs.clearPoster.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });
  const { data: allTags, isLoading: isLoadingTags } = api.gigTags.getAll.useQuery(
    tagSearch.trim() ? { search: tagSearch } : undefined,
  );

  // Initialize form when gig data loads
  useEffect(() => {
    if (gig && !gigStartTime) {
      setTitle(gig.title);
      setSubtitle(gig.subtitle);
      setDescription(gig.description ?? "");
      setGigStartTime(gig.gigStartTime ? utcDateToLocal(gig.gigStartTime) : undefined);
      setGigEndTime(gig.gigEndTime ? utcDateToLocal(gig.gigEndTime) : undefined);
      setTicketLink(gig.ticketLink ?? "");
    }
  }, [gig, gigStartTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gigStartTime || !gig) return;

    const utcGigStartTime = new Date(gigStartTime.getTime());
    const utcGigEndTime = gigEndTime ? new Date(gigEndTime.getTime()) : undefined;

    updateGig.mutate({
      id: gig.id,
      title,
      subtitle,
      description: description.trim() || null,
      gigStartTime: utcGigStartTime,
      gigEndTime: utcGigEndTime ?? null,
      ticketLink: ticketLink.trim() || null,
    });
  };

  if (!gig) {
    return (
      <AdminSection
        title="Manage Gig"
        backLink={{ href: "/admin/gigs", label: "← Back to Gigs" }}
      >
        <p>Loading...</p>
      </AdminSection>
    );
  }

  const media = gig.media ?? [];
  const gigTags = (gig.gigTags as Array<{ id: string; gigTag: { id: string; name: string; color: string; description: string | null } }>) || [];
  const assignedTagIds = new Set(gigTags.map((gt) => gt.gigTag.id));

  // Filter out already assigned tags (client-side filtering only for assigned tags)
  const availableTags = allTags?.filter((tag) => !assignedTagIds.has(tag.id)) || [];

  return (
    <AdminSection
      title="Manage Gig"
      subtitle={gig.title}
      backLink={{ href: "/admin/gigs", label: "← Back to Gigs" }}
      actions={
        <>
          <Button variant="outline" asChild>
            <Link href={`/gigs/${gig.id}`}>View Gig</Link>
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Are you sure you want to delete this gig? This action cannot be undone.")) {
                deleteGig.mutate({ id: gig.id });
              }
            }}
          >
            Delete Gig
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Top Section: Core Details (left), Date/Time (top right), Tags (bottom right) */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Core Details - Left Column */}
          <Card className="lg:row-span-2">
            <CardHeader>
              <CardTitle>Core Details</CardTitle>
              <CardDescription>Edit the basic information for this gig</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Input
                    id="subtitle"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="description">Description (Markdown)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter a description using Markdown formatting..."
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports Markdown formatting (bold, italic, links, lists, etc.)
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ticketLink">Ticket Link (optional)</Label>
                  <Input
                    id="ticketLink"
                    type="url"
                    value={ticketLink}
                    onChange={(e) => setTicketLink(e.target.value)}
                    placeholder="https://example.com/tickets"
                  />
                </div>
                <Button type="submit" disabled={updateGig.isPending}>
                  {updateGig.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Date/Time Configuration - Top Right */}
          <Card>
            <CardHeader>
              <CardTitle>Date & Time</CardTitle>
              <CardDescription>Configure when this gig starts and ends</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="gigStartTime">Gig Start Time *</Label>
                  <DateTimePicker
                    date={gigStartTime}
                    onDateChange={setGigStartTime}
                    placeholder="Select start time"
                    showTime={true}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="gigEndTime">Gig End Time (optional)</Label>
                  <DateTimePicker
                    date={gigEndTime}
                    onDateChange={setGigEndTime}
                    placeholder="Select end time"
                    showTime={true}
                  />
                </div>
                <Button type="submit" disabled={updateGig.isPending}>
                  {updateGig.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Tag Management - Bottom Right */}
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>Assign tags to categorize this gig</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {gigTags.map((gt) => (
                  <div
                    key={gt.id}
                    className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium"
                    style={{
                      backgroundColor: `${gt.gigTag.color}20`,
                      borderColor: gt.gigTag.color,
                      borderWidth: "1px",
                      color: gt.gigTag.color,
                    }}
                  >
                    <span>{gt.gigTag.name}</span>
                    <button
                      onClick={() => {
                        setTagToRemove({ id: gt.gigTag.id, name: gt.gigTag.name });
                        setIsRemoveDialogOpen(true);
                      }}
                      disabled={removeTag.isPending}
                      className="ml-1 hover:opacity-70 disabled:opacity-50"
                      aria-label={`Remove ${gt.gigTag.name} tag`}
                    >
                      {removeTag.isPending && tagToRemove?.id === gt.gigTag.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                ))}
                {gigTags.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tags assigned</p>
                )}
              </div>

              <div className="border-t pt-4">
                <Label className="mb-2 block">Add Tags</Label>
                <p className="mb-3 text-xs text-muted-foreground">
                  Search and click tags to assign them to this gig. You can assign multiple tags.
                </p>
                {availableTags.length > 0 || isLoadingTags ? (
                  <>
                    <div className="mb-3 relative">
                      <Input
                        ref={tagSearchInputRef}
                        placeholder="Search tags by name or description..."
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        className="w-full pr-8"
                      />
                      {isLoadingTags && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    {isLoadingTags ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
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
                              assignTag.mutate({
                                gigId: gig.id,
                                tagId: tag.id,
                              });
                              // Keep focus on input after clicking
                              setTimeout(() => {
                                tagSearchInputRef.current?.focus();
                              }, 0);
                            }}
                            disabled={assignTag.isPending && tagBeingAdded === tag.id}
                            className="flex items-center gap-2"
                          >
                            {assignTag.isPending && tagBeingAdded === tag.id ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Adding...</span>
                              </>
                            ) : (
                              <>
                                <div
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
                      <p className="text-sm text-muted-foreground">
                        No tags match your search.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    All tags are assigned. Create more tags in the Gig Tags section.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Poster */}
        <Card>
          <CardHeader>
            <CardTitle>Poster</CardTitle>
            <CardDescription>Upload a single poster image for this gig</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {gig.posterFileUpload ? (
                  <span>
                    Current poster:{" "}
                    <span className="font-medium text-foreground">{gig.posterFileUpload.name}</span>
                  </span>
                ) : (
                  <span>No poster uploaded yet.</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  id="gig-poster-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setIsPosterUploading(true);
                      const arrayBuffer = await file.arrayBuffer();
                      const base64 = Buffer.from(arrayBuffer).toString("base64");
                      const dataUrl = `data:${file.type};base64,${base64}`;
                      uploadPoster.mutate({
                        gigId: gig.id,
                        base64: dataUrl,
                        name: file.name,
                        mimeType: file.type,
                      });
                    } finally {
                      e.target.value = "";
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    (document.getElementById("gig-poster-upload") as HTMLInputElement | null)?.click();
                  }}
                  disabled={isPosterUploading || uploadPoster.isPending}
                >
                  {isPosterUploading || uploadPoster.isPending
                    ? "Uploading..."
                    : gig.posterFileUpload
                      ? "Replace Poster"
                      : "Upload Poster"}
                </Button>
                <Button
                  variant="destructive"
                  disabled={!gig.posterFileUpload || clearPoster.isPending}
                  onClick={() => {
                    if (!gig.posterFileUpload) return;
                    if (confirm("Remove the poster? This will also soft-delete the file.")) {
                      clearPoster.mutate({ gigId: gig.id, deleteFile: true });
                    }
                  }}
                >
                  {clearPoster.isPending ? "Removing..." : "Remove Poster"}
                </Button>
              </div>
            </div>

            {gig.posterFileUpload?.url && (
              <div className="relative aspect-3/4 w-full max-w-md overflow-hidden rounded-lg border bg-muted">
                <Image
                  src={gig.posterFileUpload.url}
                  alt={`${gig.title} poster`}
                  fill
                  sizes="(max-width: 768px) 100vw, 512px"
                  className="object-cover"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Media Management */}
        <Card>
          <CardHeader>
            <CardTitle>Media Management</CardTitle>
            <CardDescription>Upload and organize photos and videos for this gig. Drag and drop to reorder.</CardDescription>
          </CardHeader>
          <CardContent>
            <GigMediaManager
              gigId={gig.id}
              media={media.map((m) => ({
                id: m.id,
                type: m.type,
                url: m.url,
                section: m.section,
                sortOrder: m.sortOrder,
                fileUpload: m.fileUpload,
              }))}
              onRefetch={() => void refetch()}
            />
          </CardContent>
        </Card>
      </div>

      {/* Remove Tag Confirmation Dialog */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the tag "{tagToRemove?.name}" from this gig? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeTag.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (tagToRemove && gig) {
                  removeTag.mutate({
                    gigId: gig.id,
                    tagId: tagToRemove.id,
                  });
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

    </AdminSection>
  );
}

