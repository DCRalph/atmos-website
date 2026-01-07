"use client";

import { useState, useRef, useCallback } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { useDroppable } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import { CollisionPriority } from "@dnd-kit/abstract";
import Image from "next/image";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
import { Loader2, Upload, Trash2, GripVertical, X, ImageIcon, Film, Info, Copy, Check, ExternalLink } from "lucide-react";
import { getMediaDisplayUrl } from "~/lib/media-url";

type MediaItem = {
  id: string;
  type: string;
  url: string | null;
  section: string;
  sortOrder: number;
  fileUploadId?: string | null;
  fileUpload: {
    id: string;
    url: string;
    name: string;
    mimeType: string;
    size: number;
    width: number | null;
    height: number | null;
    createdAt: Date | string;
    uploadedBy: { id: string; name: string; email: string } | null;
  } | null;
};

type GigMediaManagerProps = {
  gigId: string;
  media: MediaItem[];
  onRefetch: () => void;
};

// Sortable media item component
function SortableMediaItem({
  item,
  index,
  section,
  onDelete,
  onMove,
  onInfo,
  isDeleting,
}: {
  item: MediaItem;
  index: number;
  section: "featured" | "gallery";
  onDelete: (id: string) => void;
  onMove: (id: string, targetSection: "featured" | "gallery") => void;
  onInfo: (item: MediaItem) => void;
  isDeleting: boolean;
}) {
  const { ref, isDragging } = useSortable({
    id: item.id,
    index,
    type: "item",
    accept: ["item"],
    group: section,
    data: { section, item },
  });

  const url = getMediaDisplayUrl(item);
  const isVideo = item.type === "video";

  return (
    <div
      ref={ref}
      className={`group relative aspect-video overflow-hidden rounded-lg border bg-muted transition-all ${isDragging ? "opacity-50 scale-95 ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/50"
        }`}
    >
      {/* Drag Handle */}
      <div className="absolute left-2 top-2 z-10 cursor-grab rounded bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-white" />
      </div>

      {/* Media Preview - Clickable to open info */}
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-pointer"
        onClick={() => onInfo(item)}
        aria-label="View media details"
      >
        {isVideo ? (
          <div className="relative h-full w-full">
            <video
              src={url}
              className="h-full w-full object-cover"
              muted
              playsInline
            />
            <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1">
              <Film className="h-3 w-3 text-white" />
            </div>
          </div>
        ) : (
          <Image
            src={url}
            alt="Media preview"
            fill
            className="object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
            }}
          />
        )}
      </button>

      {/* Actions */}
      <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="secondary"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onInfo(item)}
          title="View info"
        >
          <Info className="h-3 w-3" />
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onDelete(item.id)}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* File name tooltip */}
      {item.fileUpload?.name && (
        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <p className="truncate text-xs text-white">{item.fileUpload.name}</p>
        </div>
      )}
    </div>
  );
}

// Droppable section column
function MediaSection({
  section,
  title,
  description,
  children,
  isEmpty,
}: {
  section: "featured" | "gallery";
  title: string;
  description: string;
  children: React.ReactNode;
  isEmpty: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: section,
    type: "column",
    accept: ["item"],
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <Card
      ref={ref}
      className={`transition-all ${isDropTarget ? "ring-2 ring-primary ring-offset-2" : ""
        }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {section === "featured" ? (
            <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-600">
              ★ Featured
            </span>
          ) : (
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Gallery
            </span>
          )}
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className={`flex h-32 items-center justify-center rounded-lg border-2 border-dashed transition-colors ${isDropTarget ? "border-primary bg-primary/5" : "border-muted"
            }`}>
            <p className="text-sm text-muted-foreground">
              {isDropTarget ? "Drop here" : "Drag items here"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GigMediaManager({ gigId, media, onRefetch }: GigMediaManagerProps) {
  const [items, setItems] = useState<Record<"featured" | "gallery", string[]>>(() => ({
    featured: media.filter((m) => m.section === "featured").sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.id),
    gallery: media.filter((m) => m.section === "gallery").sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.id),
  }));

  const previousItems = useRef(items);
  const mediaMap = useRef(new Map(media.map((m) => [m.id, m])));

  // Update media map when props change
  if (media.length !== mediaMap.current.size || media.some((m) => !mediaMap.current.has(m.id))) {
    mediaMap.current = new Map(media.map((m) => [m.id, m]));
    setItems({
      featured: media.filter((m) => m.section === "featured").sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.id),
      gallery: media.filter((m) => m.section === "gallery").sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.id),
    });
  }

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [deleteMediaId, setDeleteMediaId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadSection, setUploadSection] = useState<"featured" | "gallery">("gallery");
  const [infoMedia, setInfoMedia] = useState<MediaItem | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = api.useUtils();

  const uploadMedia = api.gigs.uploadMedia.useMutation({
    onSuccess: () => {
      onRefetch();
    },
  });

  const deleteMedia = api.gigs.deleteMedia.useMutation({
    onSuccess: () => {
      setDeleteMediaId(null);
      onRefetch();
    },
  });

  const reorderMedia = api.gigs.reorderMedia.useMutation();
  const moveToSection = api.gigs.moveMediaToSection.useMutation();

  const handleDragStart = useCallback(() => {
    previousItems.current = items;
  }, [items]);

  const handleDragOver = useCallback((event: any) => {
    const { source } = event.operation;
    if (source?.type === "column") return;
    setItems((items) => move(items, event));
    console.log("drag over", event, items);
  }, []);

  const handleDragEnd = useCallback(async (event: any) => {
    const { source } = event.operation;

    if (event.canceled) {
      if (source?.type === "item") {
        // setItems(previousItems.current);
        console.log("drag end", event, items);
      }
      return;
    }

    // Save the new order to the database
    const featured = items.featured;
    const gallery = items.gallery;

    // Check if the item moved between sections
    const sourceSection = previousItems.current.featured.includes(source.id) ? "featured" : "gallery";
    const targetSection = items.featured.includes(source.id) ? "featured" : "gallery";

    if (sourceSection !== targetSection) {
      // Item moved between sections
      await moveToSection.mutateAsync({
        mediaId: source.id,
        targetSection,
        targetIndex: items[targetSection].indexOf(source.id),
      });
    } else {
      // Item reordered within same section
      await reorderMedia.mutateAsync({
        gigId,
        section: targetSection,
        mediaIds: items[targetSection],
      });
    }
  }, [items, gigId, moveToSection, reorderMedia]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setPendingFiles(files);
      setIsUploadDialogOpen(true);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        if (!file) continue;

        // Convert to base64
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const dataUrl = `data:${file.type};base64,${base64}`;

        await uploadMedia.mutateAsync({
          gigId,
          base64: dataUrl,
          name: file.name,
          mimeType: file.type,
          section: uploadSection,
        });

        setUploadProgress(((i + 1) / pendingFiles.length) * 100);
      }

      setPendingFiles([]);
      setIsUploadDialogOpen(false);
      await utils.gigs.getById.invalidate({ id: gigId });
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = (mediaId: string) => {
    setDeleteMediaId(mediaId);
  };

  const confirmDelete = () => {
    if (deleteMediaId) {
      deleteMedia.mutate({ id: deleteMediaId, deleteFile: true });
    }
  };

  const handleMove = (mediaId: string, targetSection: "featured" | "gallery") => {
    moveToSection.mutate({
      mediaId,
      targetSection,
    });
  };

  const handleInfo = (item: MediaItem) => {
    setInfoMedia(item);
    setCopiedUrl(false);
  };

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload Button */}
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Media
        </Button>
        <p className="text-sm text-muted-foreground">
          Drag and drop to reorder. Move items between Featured and Gallery sections.
        </p>
      </div>

      {/* DnD Sections */}
      <DragDropProvider
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-6 lg:grid-cols-1">
          <MediaSection
            section="featured"
            title="Featured Media"
            description="Highlighted media shown prominently on the gig page"
            isEmpty={items.featured.length === 0}
          >
            {items.featured.map((id, index) => {
              const item = mediaMap.current.get(id);
              if (!item) return null;
              return (
                <SortableMediaItem
                  key={id}
                  item={item}
                  index={index}
                  section="featured"
                  onDelete={handleDelete}
                  onMove={handleMove}
                  onInfo={handleInfo}
                  isDeleting={deleteMedia.isPending && deleteMediaId === id}
                />
              );
            })}
          </MediaSection>

          <MediaSection
            section="gallery"
            title="Gallery"
            description="Additional media shown in the gallery section"
            isEmpty={items.gallery.length === 0}
          >
            {items.gallery.map((id, index) => {
              const item = mediaMap.current.get(id);
              if (!item) return null;
              return (
                <SortableMediaItem
                  key={id}
                  item={item}
                  index={index}
                  section="gallery"
                  onDelete={handleDelete}
                  onMove={handleMove}
                  onInfo={handleInfo}
                  isDeleting={deleteMedia.isPending && deleteMediaId === id}
                />
              );
            })}
          </MediaSection>
        </div>
      </DragDropProvider>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Media</DialogTitle>
            <DialogDescription>
              Upload {pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""} to the gig
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File Preview */}
            <div className="grid max-h-60 gap-2 overflow-y-auto rounded-lg border p-2">
              {pendingFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-3 rounded bg-muted/50 p-2">
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Film className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setPendingFiles((files) => files.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Section Selection */}
            <div className="flex flex-col gap-2">
              <Label>Upload to section</Label>
              <div className="flex gap-2">
                <Button
                  variant={uploadSection === "featured" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUploadSection("featured")}
                >
                  ★ Featured
                </Button>
                <Button
                  variant={uploadSection === "gallery" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUploadSection("gallery")}
                >
                  Gallery
                </Button>
              </div>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Uploading... {Math.round(uploadProgress)}%
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPendingFiles([]);
                  setIsUploadDialogOpen(false);
                }}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={isUploading || pendingFiles.length === 0}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteMediaId} onOpenChange={(open) => !open && setDeleteMediaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this media? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMedia.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMedia.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMedia.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Media Info Dialog */}
      <Dialog open={!!infoMedia} onOpenChange={(open) => !open && setInfoMedia(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {infoMedia?.type === "video" ? (
                <Film className="h-5 w-5" />
              ) : (
                <ImageIcon className="h-5 w-5" />
              )}
              Media Details
            </DialogTitle>
            <DialogDescription>
              Information about this media file
            </DialogDescription>
          </DialogHeader>

          {infoMedia && (
            <div className="max-h-[80vh] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
              {/* Preview */}
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                {infoMedia.type === "video" ? (
                  <video
                    src={getMediaDisplayUrl(infoMedia)}
                    className="h-full w-full object-contain"
                    controls
                  />
                ) : (
                  <Image
                    src={getMediaDisplayUrl(infoMedia)}
                    alt={infoMedia.fileUpload?.name ?? "Media preview"}
                    fill
                    className="object-contain"
                  />
                )}
              </div>

              {/* Info Grid */}
              <div className="grid gap-2 text-sm">
                {/* File Name */}
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Name</p>
                  <p className="font-medium text-sm break-all">{infoMedia.fileUpload?.name ?? "Unknown"}</p>
                </div>

                {/* Dimensions, Size & Type */}
                <div className="grid grid-cols-2 gap-2">
                  {infoMedia.fileUpload?.width && infoMedia.fileUpload?.height && (
                    <div className="rounded-lg bg-muted/50 p-2.5">
                      <p className="text-xs font-medium uppercase text-muted-foreground">Dimensions</p>
                      <p className="font-medium text-sm">
                        {infoMedia.fileUpload.width} × {infoMedia.fileUpload.height}
                      </p>
                    </div>
                  )}
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Size</p>
                    <p className="font-medium text-sm">
                      {infoMedia.fileUpload?.size
                        ? formatFileSize(infoMedia.fileUpload.size)
                        : "Unknown"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Type</p>
                    <p className="font-medium text-sm">{infoMedia.fileUpload?.mimeType ?? infoMedia.type}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Uploaded</p>
                    <p className="font-medium text-sm">
                      {infoMedia.fileUpload?.createdAt
                        ? formatDate(infoMedia.fileUpload.createdAt)
                        : "Unknown"}
                    </p>
                  </div>
                </div>

                {/* Uploaded By */}
                {infoMedia.fileUpload?.uploadedBy && (
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Uploaded By</p>
                    <p className="font-medium text-sm">{infoMedia.fileUpload.uploadedBy.name}</p>
                    <p className="text-xs text-muted-foreground">{infoMedia.fileUpload.uploadedBy.email}</p>
                  </div>
                )}

                {/* URL */}
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-xs font-medium uppercase text-muted-foreground">URL</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1 text-xs">
                      {getMediaDisplayUrl(infoMedia)}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0"
                      onClick={() => handleCopyUrl(getMediaDisplayUrl(infoMedia))}
                    >
                      {copiedUrl ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0"
                      asChild
                    >
                      <a href={getMediaDisplayUrl(infoMedia)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>

                {/* Section & Sort Order */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Section</p>
                    <p className="font-medium text-sm capitalize">{infoMedia.section}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Sort Order</p>
                    <p className="font-medium text-sm">{infoMedia.sortOrder}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

