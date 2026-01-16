"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
  MeasuringStrategy,
  closestCenter,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { api } from "~/trpc/react";
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
import {
  Loader2,
  Upload,
  Trash2,
  GripVertical,
  X,
  ImageIcon,
  Film,
  Info,
  Copy,
  Check,
  ExternalLink,
  Save,
  RotateCcw,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
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

type SectionItems = {
  featured: string[];
  gallery: string[];
};

// Sortable media item component
function SortableMediaItem({
  item,
  onDelete,
  onInfo,
  isDeleting,
  isDragOverlay = false,
}: {
  item: MediaItem;
  onDelete: (id: string) => void;
  onInfo: (item: MediaItem) => void;
  isDeleting: boolean;
  isDragOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: {
      type: "media",
      item,
      section: item.section,
    },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const url = getMediaDisplayUrl(item);
  const isVideo = item.type === "video";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  // For drag overlay, use simpler styling
  if (isDragOverlay) {
    return (
      <div className="border-primary bg-muted relative aspect-video w-64 overflow-hidden rounded-lg border-2 shadow-2xl">
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
            sizes="256px"
            className="object-cover"
          />
        )}
        {item.fileUpload?.name && (
          <div className="absolute right-0 bottom-0 left-0 bg-linear-to-t from-black/80 to-transparent p-2">
            <p className="truncate text-xs text-white">
              {item.fileUpload.name}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-muted relative aspect-video overflow-hidden rounded-lg border transition-all ${
        isDragging
          ? "ring-primary scale-95 opacity-50 ring-2"
          : "hover:ring-primary/50 hover:ring-1"
      }`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 cursor-grab rounded bg-black/60 p-2 transition-opacity active:cursor-grabbing sm:p-1"
      >
        <GripVertical className="h-6 w-6 text-white sm:h-4 sm:w-4" />
      </div>

      {/* Placeholder - shown while loading or on error */}
      {(isLoading || hasError) && (
        <div className="bg-muted/50 absolute inset-0 z-0 flex items-center justify-center">
          <div className="text-muted-foreground flex flex-col items-center gap-2">
            <ImageIcon className="h-12 w-12" />
            <p className="text-xs">
              {hasError ? "Failed to load" : "Loading..."}
            </p>
          </div>
        </div>
      )}

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
              onLoadedData={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
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
            sizes="30vw"
            className={`object-cover transition-opacity ${
              isLoading || hasError ? "opacity-0" : "opacity-100"
            }`}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
        )}
      </button>

      {/* Actions */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
        <div className="absolute right-0 bottom-0 left-0 bg-linear-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
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
  items,
  mediaMap,
  hasChanges,
  onDelete,
  onInfo,
  deleteMediaId,
  isDeleting,
}: {
  section: "featured" | "gallery";
  title: string;
  description: string;
  items: string[];
  mediaMap: Map<string, MediaItem>;
  hasChanges: boolean;
  onDelete: (id: string) => void;
  onInfo: (item: MediaItem) => void;
  deleteMediaId: string | null;
  isDeleting: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: section,
    data: {
      type: "section",
      section,
      accepts: ["media"],
    },
  });

  return (
    <Card
      ref={setNodeRef}
      className={`transition-all ${
        isOver ? "ring-primary ring-2 ring-offset-2" : ""
      } ${hasChanges ? "ring-2 ring-orange-500" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {section === "featured" ? (
            <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-600">
              ★ Featured
            </span>
          ) : (
            <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs font-medium">
              Gallery
            </span>
          )}
          <CardTitle className="text-lg">{title}</CardTitle>
          {hasChanges && (
            <span className="rounded bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-500">
              Unsaved
            </span>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <SortableContext items={items} strategy={rectSortingStrategy}>
          {items.length === 0 ? (
            <div
              className={`flex h-32 items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                isOver ? "border-primary bg-primary/5" : "border-muted"
              }`}
            >
              <p className="text-muted-foreground text-sm">
                {isOver ? "Drop here" : "Drag items here"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((id) => {
                const item = mediaMap.get(id);
                if (!item) return null;
                return (
                  <SortableMediaItem
                    key={id}
                    item={item}
                    onDelete={onDelete}
                    onInfo={onInfo}
                    isDeleting={isDeleting && deleteMediaId === id}
                  />
                );
              })}
            </div>
          )}
        </SortableContext>
      </CardContent>
    </Card>
  );
}

export function GigMediaManager({
  gigId,
  media,
  onRefetch,
}: GigMediaManagerProps) {
  // Build initial state from props
  const getInitialItems = (): SectionItems => ({
    featured: media
      .filter((m) => m.section === "featured")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => m.id),
    gallery: media
      .filter((m) => m.section === "gallery")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => m.id),
  });

  const [items, setItems] = useState<SectionItems>(getInitialItems);
  const [savedItems, setSavedItems] = useState<SectionItems>(getInitialItems);
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);

  // Build media map
  const mediaMap = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);

  // Reset items when media prop changes (after server sync)
  useEffect(() => {
    const newItems = getInitialItems();
    setItems(newItems);
    setSavedItems(newItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    return (
      JSON.stringify(items.featured) !== JSON.stringify(savedItems.featured) ||
      JSON.stringify(items.gallery) !== JSON.stringify(savedItems.gallery)
    );
  }, [items, savedItems]);

  const hasFeaturedChanges = useMemo(() => {
    return (
      JSON.stringify(items.featured) !== JSON.stringify(savedItems.featured)
    );
  }, [items.featured, savedItems.featured]);

  const hasGalleryChanges = useMemo(() => {
    return JSON.stringify(items.gallery) !== JSON.stringify(savedItems.gallery);
  }, [items.gallery, savedItems.gallery]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [deleteMediaId, setDeleteMediaId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadSection, setUploadSection] = useState<"featured" | "gallery">(
    "gallery",
  );
  const [infoMedia, setInfoMedia] = useState<MediaItem | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSelectDialogOpen, setIsSelectDialogOpen] = useState(false);
  const [selectedUploads, setSelectedUploads] = useState<Set<string>>(
    new Set(),
  );
  const [selectSection, setSelectSection] = useState<"featured" | "gallery">(
    "gallery",
  );
  const [isAddingSelected, setIsAddingSelected] = useState(false);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = api.useUtils();

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

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

  // Query for available uploads (only fetch when dialog is open)
  const {
    data: availableUploads,
    isLoading: isLoadingUploads,
    refetch: refetchUploads,
  } = api.gigs.getAvailableUploads.useQuery(
    { gigId },
    { enabled: isSelectDialogOpen },
  );

  const addExistingMedia = api.gigs.addExistingMedia.useMutation({
    onSuccess: () => {
      onRefetch();
    },
  });

  // Find which section an item is in
  const findSection = (id: string): "featured" | "gallery" | null => {
    if (items.featured.includes(id)) return "featured";
    if (items.gallery.includes(id)) return "gallery";
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = mediaMap.get(active.id as string);
    if (item) {
      setActiveItem(item);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeSection = findSection(activeId);
    let overSection: "featured" | "gallery" | null = null;

    // Check if dropping on a section directly
    if (overId === "featured" || overId === "gallery") {
      overSection = overId;
    } else {
      overSection = findSection(overId);
    }

    if (!activeSection || !overSection) return;

    // Moving between sections
    if (activeSection !== overSection) {
      setItems((prev) => {
        const activeItems = [...prev[activeSection]];
        const overItems = [...prev[overSection ?? "gallery"]];

        const activeIndex = activeItems.indexOf(activeId);
        activeItems.splice(activeIndex, 1);

        // Find insert position
        let insertIndex = overItems.length;
        if (overId !== overSection) {
          const overIndex = overItems.indexOf(overId);
          if (overIndex !== -1) {
            insertIndex = overIndex;
          }
        }

        overItems.splice(insertIndex, 0, activeId);

        return {
          ...prev,
          [activeSection]: activeItems,
          [overSection ?? "gallery"]: overItems,
        };
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeSection = findSection(activeId);
    let overSection: "featured" | "gallery" | null = null;

    if (overId === "featured" || overId === "gallery") {
      overSection = overId;
    } else {
      overSection = findSection(overId);
    }

    if (!activeSection || !overSection) return;

    // Reorder within same section
    if (activeSection === overSection && overId !== overSection) {
      setItems((prev) => {
        const sectionItems = [...prev[activeSection]];
        const oldIndex = sectionItems.indexOf(activeId);
        const newIndex = sectionItems.indexOf(overId);

        if (oldIndex !== -1 && newIndex !== -1) {
          return {
            ...prev,
            [activeSection]: arrayMove(sectionItems, oldIndex, newIndex),
          };
        }
        return prev;
      });
    }
  };

  const handleDragCancel = () => {
    setActiveItem(null);
  };

  // Save changes to server
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const promises: Promise<unknown>[] = [];

      // Check for items that moved between sections
      for (const id of items.featured) {
        if (savedItems.gallery.includes(id)) {
          // Item moved from gallery to featured
          promises.push(
            moveToSection.mutateAsync({
              mediaId: id,
              targetSection: "featured",
              targetIndex: items.featured.indexOf(id),
            }),
          );
        }
      }

      for (const id of items.gallery) {
        if (savedItems.featured.includes(id)) {
          // Item moved from featured to gallery
          promises.push(
            moveToSection.mutateAsync({
              mediaId: id,
              targetSection: "gallery",
              targetIndex: items.gallery.indexOf(id),
            }),
          );
        }
      }

      // Wait for section moves first
      await Promise.all(promises);

      // Then update order for each section
      const reorderPromises: Promise<unknown>[] = [];

      if (hasFeaturedChanges && items.featured.length > 0) {
        reorderPromises.push(
          reorderMedia.mutateAsync({
            gigId,
            section: "featured",
            mediaIds: items.featured,
          }),
        );
      }

      if (hasGalleryChanges && items.gallery.length > 0) {
        reorderPromises.push(
          reorderMedia.mutateAsync({
            gigId,
            section: "gallery",
            mediaIds: items.gallery,
          }),
        );
      }

      await Promise.all(reorderPromises);

      // Update saved state
      setSavedItems({ ...items });
      onRefetch();
    } catch (error) {
      console.error("Failed to save changes:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Discard changes
  const handleDiscardChanges = () => {
    setItems({ ...savedItems });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setPendingFiles(files);
      setIsUploadDialogOpen(true);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    const warnings: string[] = [];

    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        if (!file) continue;

        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const dataUrl = `data:${file.type};base64,${base64}`;

        const result = await uploadMedia.mutateAsync({
          gigId,
          base64: dataUrl,
          name: file.name,
          mimeType: file.type,
          section: uploadSection,
        });

        // Check if this was a duplicate
        if (result.isDuplicate && result.warning) {
          warnings.push(result.warning);
        }

        setUploadProgress(((i + 1) / pendingFiles.length) * 100);
      }

      setPendingFiles([]);
      setIsUploadDialogOpen(false);

      // Show warnings if any duplicates were found
      if (warnings.length > 0) {
        setUploadWarnings(warnings);
      }

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

  const handleInfo = (item: MediaItem) => {
    setInfoMedia(item);
    setCopiedUrl(false);
  };

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleOpenSelectDialog = () => {
    setSelectedUploads(new Set());
    setIsSelectDialogOpen(true);
    void refetchUploads();
  };

  const handleToggleUploadSelection = (id: string) => {
    setSelectedUploads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddSelectedUploads = async () => {
    if (selectedUploads.size === 0) return;

    setIsAddingSelected(true);
    try {
      for (const fileUploadId of selectedUploads) {
        await addExistingMedia.mutateAsync({
          gigId,
          fileUploadId,
          section: selectSection,
        });
      }
      setSelectedUploads(new Set());
      setIsSelectDialogOpen(false);
      await utils.gigs.getById.invalidate({ id: gigId });
    } catch (error) {
      console.error("Failed to add selected media:", error);
    } finally {
      setIsAddingSelected(false);
    }
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
      {/* Upload Button & Save Controls */}
      <div className="flex flex-wrap items-center gap-4">
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
        <Button variant="outline" onClick={handleOpenSelectDialog}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Select from Uploaded
        </Button>

        {hasChanges && (
          <>
            <div className="bg-border h-6 w-px" />
            <Button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={handleDiscardChanges}
              disabled={isSaving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Discard
            </Button>
          </>
        )}

        <p className="text-muted-foreground text-sm">
          {hasChanges
            ? "You have unsaved changes. Drag items to reorder, then save."
            : "Drag and drop to reorder. Move items between Featured and Gallery sections."}
        </p>
      </div>

      {/* Unsaved Changes Banner */}
      {hasChanges && (
        <div className="flex items-center gap-3 rounded-lg border-2 border-orange-500 bg-orange-500/10 p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20">
            <Save className="h-4 w-4 text-orange-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-orange-500">Unsaved Changes</p>
            <p className="text-muted-foreground text-sm">
              You have rearranged media items. Click "Save Changes" to persist
              your changes.
            </p>
          </div>
        </div>
      )}

      {/* DnD Sections */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        modifiers={[restrictToWindowEdges]}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
      >
        <div className="grid gap-6 lg:grid-cols-1">
          <MediaSection
            section="featured"
            title="Featured Media"
            description="Highlighted media shown prominently on the gig page"
            items={items.featured}
            mediaMap={mediaMap}
            hasChanges={hasFeaturedChanges}
            onDelete={handleDelete}
            onInfo={handleInfo}
            deleteMediaId={deleteMediaId}
            isDeleting={deleteMedia.isPending}
          />

          <MediaSection
            section="gallery"
            title="Gallery"
            description="Additional media shown in the gallery section"
            items={items.gallery}
            mediaMap={mediaMap}
            hasChanges={hasGalleryChanges}
            onDelete={handleDelete}
            onInfo={handleInfo}
            deleteMediaId={deleteMediaId}
            isDeleting={deleteMedia.isPending}
          />
        </div>

        <DragOverlay modifiers={[restrictToWindowEdges]}>
          {activeItem && (
            <SortableMediaItem
              item={activeItem}
              onDelete={handleDelete}
              onInfo={handleInfo}
              isDeleting={false}
              isDragOverlay
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Media</DialogTitle>
            <DialogDescription>
              Upload {pendingFiles.length} file
              {pendingFiles.length !== 1 ? "s" : ""} to the gig
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File Preview */}
            <div className="grid max-h-60 gap-2 overflow-y-auto rounded-lg border p-2">
              {pendingFiles.map((file, i) => (
                <div
                  key={i}
                  className="bg-muted/50 flex items-center gap-3 rounded p-2"
                >
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="text-muted-foreground h-5 w-5" />
                  ) : (
                    <Film className="text-muted-foreground h-5 w-5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() =>
                      setPendingFiles((files) =>
                        files.filter((_, idx) => idx !== i),
                      )
                    }
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
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-center text-sm">
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
              <Button
                onClick={handleUpload}
                disabled={isUploading || pendingFiles.length === 0}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {pendingFiles.length} file
                    {pendingFiles.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteMediaId}
        onOpenChange={(open) => !open && setDeleteMediaId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this media? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMedia.isPending}>
              Cancel
            </AlertDialogCancel>
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
      <Dialog
        open={!!infoMedia}
        onOpenChange={(open) => !open && setInfoMedia(null)}
      >
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
            <div className="max-h-[80vh] space-y-3 overflow-x-hidden overflow-y-auto pr-1">
              {/* Preview */}
              <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-lg border">
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
                    sizes="30vw"
                    className="object-contain"
                  />
                )}
              </div>

              {/* Info Grid */}
              <div className="grid gap-2 text-sm">
                {/* File Name */}
                <div className="bg-muted/50 rounded-lg p-2.5">
                  <p className="text-muted-foreground text-xs font-medium uppercase">
                    Name
                  </p>
                  <p className="text-sm font-medium break-all">
                    {infoMedia.fileUpload?.name ?? "Unknown"}
                  </p>
                </div>

                {/* Dimensions, Size & Type */}
                <div className="grid grid-cols-2 gap-2">
                  {infoMedia.fileUpload?.width &&
                    infoMedia.fileUpload?.height && (
                      <div className="bg-muted/50 rounded-lg p-2.5">
                        <p className="text-muted-foreground text-xs font-medium uppercase">
                          Dimensions
                        </p>
                        <p className="text-sm font-medium">
                          {infoMedia.fileUpload.width} ×{" "}
                          {infoMedia.fileUpload.height}
                        </p>
                      </div>
                    )}
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-xs font-medium uppercase">
                      Size
                    </p>
                    <p className="text-sm font-medium">
                      {infoMedia.fileUpload?.size
                        ? formatFileSize(infoMedia.fileUpload.size)
                        : "Unknown"}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-xs font-medium uppercase">
                      Type
                    </p>
                    <p className="text-sm font-medium">
                      {infoMedia.fileUpload?.mimeType ?? infoMedia.type}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-xs font-medium uppercase">
                      Uploaded
                    </p>
                    <p className="text-sm font-medium">
                      {infoMedia.fileUpload?.createdAt
                        ? formatDate(infoMedia.fileUpload.createdAt)
                        : "Unknown"}
                    </p>
                  </div>
                </div>

                {/* Uploaded By */}
                {infoMedia.fileUpload?.uploadedBy && (
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-xs font-medium uppercase">
                      Uploaded By
                    </p>
                    <p className="text-sm font-medium">
                      {infoMedia.fileUpload.uploadedBy.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {infoMedia.fileUpload.uploadedBy.email}
                    </p>
                  </div>
                )}

                {/* URL */}
                <div className="bg-muted/50 rounded-lg p-2.5">
                  <p className="text-muted-foreground text-xs font-medium uppercase">
                    URL
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="bg-background min-w-0 flex-1 rounded px-2 py-1 text-xs break-all">
                      {getMediaDisplayUrl(infoMedia)}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0"
                      onClick={() =>
                        handleCopyUrl(getMediaDisplayUrl(infoMedia))
                      }
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
                      <a
                        href={getMediaDisplayUrl(infoMedia)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>

                {/* Section & Sort Order */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-xs font-medium uppercase">
                      Section
                    </p>
                    <p className="text-sm font-medium capitalize">
                      {infoMedia.section}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-xs font-medium uppercase">
                      Sort Order
                    </p>
                    <p className="text-sm font-medium">{infoMedia.sortOrder}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Select from Uploaded Dialog */}
      <Dialog open={isSelectDialogOpen} onOpenChange={setIsSelectDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Select from Uploaded Media
            </DialogTitle>
            <DialogDescription>
              Choose media files that have already been uploaded to S3 to add to
              this gig
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Section Selection */}
            <div className="flex flex-col gap-2">
              <Label>Add to section</Label>
              <div className="flex gap-2">
                <Button
                  variant={selectSection === "featured" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectSection("featured")}
                >
                  ★ Featured
                </Button>
                <Button
                  variant={selectSection === "gallery" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectSection("gallery")}
                >
                  Gallery
                </Button>
              </div>
            </div>

            {/* Media Grid */}
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border p-2">
              {isLoadingUploads ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
              ) : !availableUploads || availableUploads.length === 0 ? (
                <div className="text-muted-foreground flex h-32 flex-col items-center justify-center gap-2">
                  <ImageIcon className="h-8 w-8" />
                  <p className="text-sm">No available media files found</p>
                  <p className="text-xs">
                    All uploaded media is already added to this gig
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {availableUploads.map((upload) => {
                    const isSelected = selectedUploads.has(upload.id);
                    const isVideo = upload.mimeType.startsWith("video/");
                    return (
                      <button
                        key={upload.id}
                        type="button"
                        onClick={() => handleToggleUploadSelection(upload.id)}
                        className={`group bg-muted relative aspect-video overflow-hidden rounded-lg border-2 transition-all ${
                          isSelected
                            ? "border-primary ring-primary/20 ring-2"
                            : "hover:border-muted-foreground/30 border-transparent"
                        }`}
                      >
                        {/* Selection indicator */}
                        <div
                          className={`absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-black/50 text-white opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          {isSelected ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <div className="h-3 w-3 rounded-full border-2 border-white" />
                          )}
                        </div>

                        {/* Video indicator */}
                        {isVideo && (
                          <div className="absolute bottom-2 left-2 z-10 rounded bg-black/60 px-2 py-1">
                            <Film className="h-3 w-3 text-white" />
                          </div>
                        )}

                        {/* Preview */}
                        {isVideo ? (
                          <video
                            src={upload.url}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <Image
                            src={upload.url}
                            alt={upload.name}
                            fill
                            sizes="200px"
                            className="object-cover"
                          />
                        )}

                        {/* File name tooltip */}
                        <div className="absolute right-0 bottom-0 left-0 bg-linear-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <p className="truncate text-xs text-white">
                            {upload.name}
                          </p>
                          <p className="text-xs text-white/70">
                            {formatFileSize(upload.size)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected count */}
            {selectedUploads.size > 0 && (
              <div className="bg-primary/10 flex items-center gap-2 rounded-lg p-3">
                <CheckCircle2 className="text-primary h-4 w-4" />
                <span className="text-sm font-medium">
                  {selectedUploads.size} file
                  {selectedUploads.size !== 1 ? "s" : ""} selected
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedUploads(new Set());
                  setIsSelectDialogOpen(false);
                }}
                disabled={isAddingSelected}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddSelectedUploads}
                disabled={isAddingSelected || selectedUploads.size === 0}
              >
                {isAddingSelected ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Add {selectedUploads.size > 0
                      ? selectedUploads.size
                      : ""}{" "}
                    Selected
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Warnings Dialog */}
      <AlertDialog
        open={uploadWarnings.length > 0}
        onOpenChange={(open) => !open && setUploadWarnings([])}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Duplicate Files Detected
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {uploadWarnings.length === 1
                    ? "The following file was already uploaded and was skipped:"
                    : `The following ${uploadWarnings.length} files were already uploaded and were skipped:`}
                </p>
                <ul className="bg-muted max-h-40 space-y-1 overflow-y-auto rounded-lg p-3">
                  {uploadWarnings.map((warning, index) => (
                    <li key={index} className="text-sm">
                      • {warning}
                    </li>
                  ))}
                </ul>
                <p className="text-sm">
                  You can use the "Select from Uploaded" button to add existing
                  files to this gig.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setUploadWarnings([])}>
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
