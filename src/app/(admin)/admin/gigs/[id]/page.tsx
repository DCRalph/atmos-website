"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { utcDateToLocal } from "~/lib/date-utils";
import Link from "next/link";
import Image from "next/image";

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

  // Media management state
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"photo" | "video">("photo");
  const [mediaFeatured, setMediaFeatured] = useState(false);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);

  const { data: gig, refetch } = api.gigs.getById.useQuery({ id });
  const updateGig = api.gigs.update.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });
  const deleteGig = api.gigs.delete.useMutation({
    onSuccess: () => {
      router.push("/admin");
    },
  });
  const addMedia = api.gigs.addMedia.useMutation({
    onSuccess: async () => {
      await refetch();
      resetMediaForm();
    },
  });
  const updateMedia = api.gigs.updateMedia.useMutation({
    onSuccess: async () => {
      await refetch();
      resetMediaForm();
    },
  });
  const deleteMedia = api.gigs.deleteMedia.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

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

  const resetMediaForm = () => {
    setMediaUrl("");
    setMediaType("photo");
    setMediaFeatured(false);
    setEditingMediaId(null);
  };

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

  const handleSubmitMedia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gig || !mediaUrl) return;

    if (editingMediaId) {
      updateMedia.mutate({
        id: editingMediaId,
        type: mediaType,
        url: mediaUrl,
        featured: mediaFeatured,
      });
    } else {
      addMedia.mutate({
        gigId: gig.id,
        type: mediaType,
        url: mediaUrl,
        featured: mediaFeatured,
      });
    }
  };

  const handleEditMedia = (media: { id: string; type: "photo" | "video"; url: string; featured: boolean }) => {
    setEditingMediaId(media.id);
    setMediaUrl(media.url);
    setMediaType(media.type);
    setMediaFeatured(media.featured);
  };

  if (!gig) {
    return (
      <div className="min-h-dvh bg-background p-8">
        <div className="mx-auto max-w-7xl">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const media = (gig.media as Array<{ id: string; type: "photo" | "video"; url: string; featured: boolean }>) || [];

  return (
    <div className="min-h-dvh bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Button variant="outline" asChild>
              <Link href="/admin" className="text-muted-foreground hover:text-foreground mb-2 inline-block">
                ← Back to Admin
              </Link>
            </Button>
            <h1 className="text-4xl font-bold text-foreground">Manage Gig</h1>
            <p className="text-muted-foreground mt-1">{gig.title}</p>
          </div>
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
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Core Details */}
          <Card>
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

          {/* Media Management */}
          <Card>
            <CardHeader>
              <CardTitle>Media Management</CardTitle>
              <CardDescription>Add photos and videos for this gig</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Media Form */}
              <form onSubmit={handleSubmitMedia} className="space-y-4 border-b pb-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="mediaType">Media Type</Label>
                  <Select value={mediaType} onValueChange={(value: "photo" | "video") => setMediaType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="photo">Photo</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="mediaUrl">Media URL</Label>
                  <Input
                    id="mediaUrl"
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload your media to a hosting service and paste the URL here
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mediaFeatured"
                    checked={mediaFeatured}
                    onChange={(e) => setMediaFeatured(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="mediaFeatured">Featured</Label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={addMedia.isPending || updateMedia.isPending}>
                    {editingMediaId ? "Update Media" : "Add Media"}
                  </Button>
                  {editingMediaId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetMediaForm}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>

              {/* Media List */}
              <div className="space-y-4">
                <h3 className="font-semibold">Existing Media ({media.length})</h3>
                {media.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {media.map((mediaItem) => (
                      <div
                        key={mediaItem.id}
                        className="group relative overflow-hidden rounded-lg border"
                      >
                        <div className="aspect-video relative bg-muted">
                          {mediaItem.type === "photo" ? (
                            <Image
                              src={mediaItem.url}
                              alt="Media preview"
                              fill
                              className="object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                              }}
                            />
                          ) : (
                            <video
                              src={mediaItem.url}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                            />
                          )}
                        </div>
                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium capitalize">{mediaItem.type}</span>
                              {mediaItem.featured && (
                                <span className="rounded bg-yellow-500 px-2 py-0.5 text-xs text-black">
                                  Featured
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditMedia(mediaItem)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this media?")) {
                                    deleteMedia.mutate({ id: mediaItem.id });
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                          <a
                            href={mediaItem.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline truncate block"
                          >
                            {mediaItem.url}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No media added yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

