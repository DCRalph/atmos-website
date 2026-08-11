"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { useUpload } from "~/hooks/use-upload";
import { UploadProgressList } from "~/components/uploads/upload-progress-list";
import { describeConstraints } from "~/lib/uploads/validate";
import { buildMediaUrl } from "~/lib/media-url";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { PaginationControls } from "~/components/ui/pagination-controls";
import {
  Loader2,
  Search,
  Trash2,
  RefreshCw,
  ExternalLink,
  ImageIcon,
  Film,
  FileText,
  File,
  Eye,
  RotateCcw,
  HardDrive,
  FileCheck,
  FolderOpen,
  Upload,
  Info,
  Copy,
  Check,
  X,
  Tag,
  Plus,
  Save,
  Pencil,
  Tags,
  Minus,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { FileUploadStatus } from "~Prisma/client";

const FILE_STATUS_LABELS: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  OK: { label: "Active", variant: "default" },
  SOFT_DELETED: { label: "Soft Deleted", variant: "secondary" },
  DELETED: { label: "Deleted", variant: "destructive" },
  UPLOADING: { label: "Uploading", variant: "outline" },
  ERRORED: { label: "Error", variant: "destructive" },
  NO_FILE: { label: "No File", variant: "outline" },
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (mimeType.startsWith("video/")) return <Film className="h-4 w-4" />;
  if (mimeType.includes("pdf")) return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
};

type FileTag = { id: string; name: string; description: string | null };

type FileInfo = {
  id: string;
  url: string;
  key: string;
  name: string;
  mimeType: string;
  size: number;
  status: string;
  category: string;
  for: string;
  forId: string;
  width: number | null;
  height: number | null;
  createdAt: Date | string;
  acl: string;
  /** Upload preset this file came from; null for pre-unified-upload rows. */
  preset: string | null;
  /** Size before image processing, when it differs from `size`. */
  originalSize: number | null;
  fileTags: FileTag[];
  linkedEntity: { type: string; id: string; title: string } | null;
};

export function FilesManager() {
  const [search, setSearch] = useState("");
  const [mimeFilter, setMimeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    name: string;
    mimeType: string;
  } | null>(null);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [deletePermanently, setDeletePermanently] = useState(false);

  // Upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState<string>("general");
  const [uploadTagIds, setUploadTagIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Info/Edit dialog state
  const [infoFile, setInfoFile] = useState<FileInfo | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editFor, setEditFor] = useState("");
  const [editForId, setEditForId] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [isSavingFile, setIsSavingFile] = useState(false);

  // Tag management state
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagDescription, setNewTagDescription] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);

  // Bulk selection state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);
  const [bulkTagMode, setBulkTagMode] = useState<"add" | "remove">("add");
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [isBulkTagging, setIsBulkTagging] = useState(false);

  const queryParams = {
    limit: PAGE_SIZE,
    page: currentPage,
    search: search || undefined,
    mimeTypePrefix: mimeFilter !== "all" ? mimeFilter : undefined,
    status:
      statusFilter === "active"
        ? undefined
        : statusFilter === "deleted"
          ? ("SOFT_DELETED" as FileUploadStatus)
          : undefined,
    tagIds: tagFilter !== "all" ? [tagFilter] : undefined,
  };

  const {
    data: filesData,
    isLoading,
    refetch,
    isFetching,
  } = api.files.getAll.useQuery(queryParams, {
    staleTime: 5 * 60 * 1000,
  });

  const { data: stats } = api.files.getStats.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const { data: tags, refetch: refetchTags } = api.files.getAllTags.useQuery(
    undefined,
    {
      staleTime: 5 * 60 * 1000,
    },
  );

  const softDelete = api.files.softDelete.useMutation({
    onSuccess: () => {
      setDeleteFileId(null);
      void refetch();
    },
  });

  const permanentDelete = api.files.delete.useMutation({
    onSuccess: () => {
      setDeleteFileId(null);
      setDeletePermanently(false);
      void refetch();
    },
  });

  const restore = api.files.restore.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  // One uploader for the whole media library. Constraints, accepted types and
  // image processing all come from the `mediaLibrary` preset.
  const {
    upload,
    retry: retryUpload,
    items: uploadItems,
    isUploading,
    cancel: cancelUpload,
    reset: resetUploads,
    constraints: uploadConstraints,
    accept: uploadAccept,
  } = useUpload("mediaLibrary", {
    context: { category: uploadCategory },
    tagIds: uploadTagIds,
    onError: (message) => toast.error(message),
  });

  const updateFile = api.files.updateFile.useMutation({
    onSuccess: () => {
      void refetch();
      setIsEditing(false);
      setInfoFile(null);
    },
  });

  const createTag = api.files.createTag.useMutation({
    onSuccess: () => {
      void refetchTags();
      setNewTagName("");
      setNewTagDescription("");
      setIsCreatingTag(false);
    },
  });

  const deleteTag = api.files.deleteTag.useMutation({
    onSuccess: () => {
      void refetchTags();
      setDeleteTagId(null);
    },
  });

  const bulkAddTags = api.files.bulkAddTags.useMutation({
    onSuccess: () => {
      void refetch();
      void refetchTags();
      setBulkTagDialogOpen(false);
      setBulkTagIds([]);
      setSelectedFileIds(new Set());
    },
  });

  const bulkRemoveTags = api.files.bulkRemoveTags.useMutation({
    onSuccess: () => {
      void refetch();
      void refetchTags();
      setBulkTagDialogOpen(false);
      setBulkTagIds([]);
      setSelectedFileIds(new Set());
    },
  });

  // Initialize edit state when opening file info
  useEffect(() => {
    if (infoFile && isEditing) {
      setEditName(infoFile.name);
      setEditFor(infoFile.for);
      setEditForId(infoFile.forId);
      setEditStatus(infoFile.status);
      setEditCategory(infoFile.category);
      setEditTagIds(infoFile.fileTags.map((t) => t.id));
    }
  }, [infoFile, isEditing]);

  // Reset to page 1 and clear selection when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedFileIds(new Set());
  }, [search, mimeFilter, statusFilter, tagFilter]);

  // Clear selection when page changes
  useEffect(() => {
    setSelectedFileIds(new Set());
  }, [currentPage]);

  // Upload handlers
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    setUploadFiles((prev) => [...prev, ...fileArray]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect],
  );

  const removeUploadFile = useCallback((index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const announceUploaded = useCallback(
    (count: number) => {
      if (count === 0) return;
      void refetch();
      toast.success(`Uploaded ${count} file${count === 1 ? "" : "s"}`);
    },
    [refetch],
  );

  const handleUpload = useCallback(async () => {
    if (uploadFiles.length === 0) return;

    resetUploads();
    const attempted = uploadFiles.length;
    const uploaded = await upload(uploadFiles);

    setUploadFiles([]);
    announceUploaded(uploaded.length);

    // Stay open when anything failed, so the failed rows keep their Retry
    // button instead of the dialog closing out from under them.
    if (uploaded.length === attempted) {
      setUploadDialogOpen(false);
      setUploadTagIds([]);
    }
  }, [uploadFiles, upload, resetUploads, announceUploaded]);

  const handleRetryUpload = useCallback(
    async (itemId: string) => {
      const uploaded = await retryUpload(itemId);
      announceUploaded(uploaded.length);
    },
    [retryUpload, announceUploaded],
  );

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const handleDelete = useCallback(
    (fileId: string, permanent: boolean = false) => {
      setDeleteFileId(fileId);
      setDeletePermanently(permanent);
    },
    [],
  );

  const confirmDelete = useCallback(() => {
    if (!deleteFileId) return;
    if (deletePermanently) {
      permanentDelete.mutate({ id: deleteFileId });
    } else {
      softDelete.mutate({ id: deleteFileId });
    }
  }, [deleteFileId, deletePermanently, permanentDelete, softDelete]);

  const handleRestore = useCallback(
    (fileId: string) => {
      restore.mutate({ id: fileId });
    },
    [restore],
  );

  const handleSaveFile = useCallback(async () => {
    if (!infoFile) return;
    setIsSavingFile(true);
    try {
      await updateFile.mutateAsync({
        id: infoFile.id,
        name: editName,
        for: editFor,
        forId: editForId,
        status: editStatus as
          | "NO_FILE"
          | "UPLOADING"
          | "OK"
          | "SOFT_DELETED"
          | "DELETED"
          | "ERRORED",
        category: editCategory as
          "IMAGE" | "VIDEO" | "AUDIO" | "PDF" | "DOCUMENT" | "FILE",
        tagIds: editTagIds,
      });
    } finally {
      setIsSavingFile(false);
    }
  }, [
    infoFile,
    editName,
    editFor,
    editForId,
    editStatus,
    editCategory,
    editTagIds,
    updateFile,
  ]);

  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return;
    setIsCreatingTag(true);
    try {
      await createTag.mutateAsync({
        name: newTagName.trim(),
        description: newTagDescription.trim() || undefined,
      });
    } finally {
      setIsCreatingTag(false);
    }
  }, [newTagName, newTagDescription, createTag]);

  const toggleTag = useCallback(
    (
      tagId: string,
      tagList: string[],
      setTagList: (tags: string[]) => void,
    ) => {
      if (tagList.includes(tagId)) {
        setTagList(tagList.filter((id) => id !== tagId));
      } else {
        setTagList([...tagList, tagId]);
      }
    },
    [],
  );

  const files = filesData?.files ?? [];
  const isDeleting = softDelete.isPending || permanentDelete.isPending;
  const hasSelection = selectedFileIds.size > 0;
  const allSelected = files.length > 0 && selectedFileIds.size === files.length;

  // Selection handlers
  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const currentFiles = filesData?.files ?? [];
    if (
      selectedFileIds.size === currentFiles.length &&
      currentFiles.length > 0
    ) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(currentFiles.map((f) => f.id)));
    }
  }, [filesData?.files, selectedFileIds.size]);

  const clearSelection = useCallback(() => {
    setSelectedFileIds(new Set());
  }, []);

  const openBulkTagDialog = useCallback((mode: "add" | "remove") => {
    setBulkTagMode(mode);
    setBulkTagIds([]);
    setBulkTagDialogOpen(true);
  }, []);

  const handleBulkTagAction = useCallback(async () => {
    if (bulkTagIds.length === 0 || selectedFileIds.size === 0) return;

    setIsBulkTagging(true);
    try {
      const fileIds = Array.from(selectedFileIds);
      if (bulkTagMode === "add") {
        await bulkAddTags.mutateAsync({ fileIds, tagIds: bulkTagIds });
      } else {
        await bulkRemoveTags.mutateAsync({ fileIds, tagIds: bulkTagIds });
      }
    } finally {
      setIsBulkTagging(false);
    }
  }, [bulkTagIds, selectedFileIds, bulkTagMode, bulkAddTags, bulkRemoveTags]);
  type FileRow = (typeof files)[number];
  const columns: DataTableColumn<FileRow>[] = [
    {
      id: "select",
      header: "Select",
      hideable: false,
      cell: (file) => (
        <Checkbox
          checked={selectedFileIds.has(file.id)}
          onCheckedChange={() => toggleFileSelection(file.id)}
          aria-label={`Select ${file.name}`}
        />
      ),
    },
    {
      id: "preview",
      header: "Preview",
      cell: (file) => (
        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded">
          {file.mimeType.startsWith("image/") ? (
            <Image
              src={buildMediaUrl(file.id)}
              alt={file.name}
              width={40}
              height={40}
              className="h-10 w-10 rounded object-cover"
            />
          ) : (
            getFileIcon(file.mimeType)
          )}
        </div>
      ),
    },
    {
      id: "name",
      header: "Name",
      cell: (file) => (
        <div className="flex flex-col">
          <span
            className="max-w-[200px] truncate font-medium"
            title={file.name}
          >
            {file.name}
          </span>
          <span
            className="text-muted-foreground max-w-[200px] truncate text-xs"
            title={file.key}
          >
            {file.key}
          </span>
        </div>
      ),
    },
    {
      id: "tags",
      header: "Tags",
      cell: (file) => (
        <div className="flex flex-wrap gap-1">
          {file.fileTags.length > 0 ? (
            file.fileTags.slice(0, 2).map((tag) => (
              <Badge key={tag.id} variant="outline" className="text-xs">
                {tag.name}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
          {file.fileTags.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{file.fileTags.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      cell: (file) => (
        <Badge variant="outline" className="capitalize">
          {file.for}
        </Badge>
      ),
    },
    { id: "size", header: "Size", cell: (file) => formatFileSize(file.size) },
    {
      id: "status",
      header: "Status",
      cell: (file) => (
        <Badge variant={FILE_STATUS_LABELS[file.status]?.variant ?? "outline"}>
          {FILE_STATUS_LABELS[file.status]?.label ?? file.status}
        </Badge>
      ),
    },
    {
      id: "uploaded",
      header: "Uploaded",
      className: "text-muted-foreground text-sm",
      cell: (file) =>
        formatDistanceToNow(new Date(file.createdAt), { addSuffix: true }),
    },
    {
      id: "actions",
      header: "Actions",
      hideable: false,
      cell: (file) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              setInfoFile(file);
              setIsEditing(false);
            }}
            title="View/Edit Info"
          >
            <Info className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() =>
              setPreviewFile({
                url: buildMediaUrl(file.id),
                name: file.name,
                mimeType: file.mimeType,
              })
            }
            title="Preview"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            asChild
            title="Open in new tab"
          >
            <a
              href={buildMediaUrl(file.id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          {file.status === "SOFT_DELETED" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleRestore(file.id)}
              disabled={restore.isPending}
              title="Restore"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-8 w-8 p-0"
              onClick={() => handleDelete(file.id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <FileCheck className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalFiles ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <HardDrive className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(stats?.totalSize ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <FolderOpen className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {stats?.byFor.slice(0, 3).map((cat) => (
                <Badge key={cat.for} variant="secondary" className="text-xs">
                  {cat.for}: {cat.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">By Status</CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {stats?.byStatus.map((s) => (
                <Badge
                  key={s.status}
                  variant={FILE_STATUS_LABELS[s.status]?.variant ?? "outline"}
                  className="text-xs"
                >
                  {FILE_STATUS_LABELS[s.status]?.label ?? s.status}: {s.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Files</CardTitle>
              <CardDescription>
                Manage all uploaded files across the site
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTagDialogOpen(true)}
              >
                <Tag className="mr-2 h-4 w-4" />
                Manage Tags
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-4">
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by name or key..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={mimeFilter} onValueChange={setMimeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="File type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image/">Images</SelectItem>
                <SelectItem value="video/">Videos</SelectItem>
                <SelectItem value="audio/">Audio</SelectItem>
                <SelectItem value="application/pdf">PDFs</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="deleted">Soft Deleted</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>

            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {tags?.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <Tag className="h-3 w-3" />
                      {tag.name}
                      <span className="text-muted-foreground text-xs">
                        ({tag._count.fileUploads})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions Bar */}
          {hasSelection && (
            <div className="bg-muted/50 mb-4 flex items-center gap-4 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Tags className="text-muted-foreground h-4 w-4" />
                <span className="text-sm font-medium">
                  {selectedFileIds.size} file
                  {selectedFileIds.size !== 1 ? "s" : ""} selected
                </span>
              </div>
              <div className="bg-border h-4 w-px" />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkTagDialog("add")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Tags
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkTagDialog("remove")}
                >
                  <Minus className="mr-2 h-4 w-4" />
                  Remove Tags
                </Button>
              </div>
              <div className="ml-auto">
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X className="mr-2 h-4 w-4" />
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          <DataTable
            columns={columns}
            data={files}
            getRowId={(file) => file.id}
            isLoading={isLoading}
            isFetching={isFetching}
            storageKey="admin-files"
            emptyMessage="No files found"
            rowClassName={(file) =>
              selectedFileIds.has(file.id) ? "bg-muted/50" : undefined
            }
            toolbarActions={
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all files on this page"
                />
                Select page
              </label>
            }
          />
          {/* Pagination Controls */}
          {filesData?.pagination && (
            <PaginationControls
              pagination={filesData.pagination}
              onPageChange={setCurrentPage}
              isLoading={isFetching}
              className="mt-4"
            />
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
            <DialogDescription>File preview</DialogDescription>
          </DialogHeader>
          {previewFile && (
            <div className="bg-muted flex min-h-[300px] items-center justify-center rounded-lg p-4">
              {previewFile.mimeType.startsWith("image/") ? (
                <Image
                  src={previewFile.url}
                  alt={previewFile.name}
                  width={800}
                  height={600}
                  className="max-h-[60vh] w-auto rounded object-contain"
                />
              ) : previewFile.mimeType.startsWith("video/") ? (
                <video
                  src={previewFile.url}
                  controls
                  className="max-h-[60vh] w-auto rounded"
                />
              ) : (
                <div className="text-muted-foreground text-center">
                  <File className="mx-auto mb-2 h-16 w-16" />
                  <p>Preview not available</p>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Open file
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteFileId}
        onOpenChange={(open) => !open && setDeleteFileId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletePermanently ? "Permanently Delete File" : "Delete File"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletePermanently
                ? "This will permanently delete the file from S3 and the database. This action cannot be undone."
                : "This will mark the file as deleted. You can restore it later or permanently delete it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
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

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          if (!isUploading) {
            setUploadDialogOpen(open);
            if (!open) {
              setUploadFiles([]);
              setUploadTagIds([]);
            }
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Upload new files to the media library. Drag and drop or click to
              select files.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Category Select */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="gig">Gig</SelectItem>
                  <SelectItem value="gig_media">Gig Media</SelectItem>
                  <SelectItem value="crew">Crew</SelectItem>
                  <SelectItem value="merch">Merch</SelectItem>
                  <SelectItem value="content">Content</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags Select */}
            <div className="space-y-2">
              <Label>Tags (applied to all files)</Label>
              <div className="flex min-h-[42px] flex-wrap gap-2 rounded-md border p-3">
                {tags?.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={
                      uploadTagIds.includes(tag.id) ? "default" : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() =>
                      toggleTag(tag.id, uploadTagIds, setUploadTagIds)
                    }
                  >
                    <Tag className="mr-1 h-3 w-3" />
                    {tag.name}
                    {uploadTagIds.includes(tag.id) && (
                      <X className="ml-1 h-3 w-3" />
                    )}
                  </Badge>
                ))}
                {(!tags || tags.length === 0) && (
                  <span className="text-muted-foreground text-sm">
                    No tags available
                  </span>
                )}
              </div>
            </div>

            {/* Drop Zone */}
            <div
              className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
                accept={uploadAccept}
              />
              <Upload className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground text-sm">
                Drag and drop files here, or click to select
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {describeConstraints(uploadConstraints)}
              </p>
            </div>

            {/* File List */}
            {uploadFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files ({uploadFiles.length})</Label>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
                  {uploadFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="bg-muted flex items-center justify-between gap-2 rounded-md p-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {getFileIcon(file.type)}
                        <span className="truncate text-sm">{file.name}</span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 shrink-0 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeUploadFile(index);
                        }}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            <UploadProgressList
              items={uploadItems}
              onCancel={cancelUpload}
              onRetry={(id) => void handleRetryUpload(id)}
              className="max-h-48 overflow-y-auto"
            />

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setUploadDialogOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploadFiles.length === 0 || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload{" "}
                    {uploadFiles.length > 0 ? `(${uploadFiles.length})` : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* File Info/Edit Dialog */}
      <Dialog
        open={!!infoFile}
        onOpenChange={(open) => {
          if (!open) {
            setInfoFile(null);
            setIsEditing(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>
                  {isEditing ? "Edit File" : "File Information"}
                </DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? "Update file attributes"
                    : "Detailed information about this file"}
                </DialogDescription>
              </div>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>

          {infoFile && (
            <div className="space-y-6">
              {/* Preview */}
              <div className="bg-muted flex min-h-[200px] items-center justify-center rounded-lg p-4">
                {infoFile.mimeType.startsWith("image/") ? (
                  <Image
                    src={buildMediaUrl(infoFile.id)}
                    alt={infoFile.name}
                    width={400}
                    height={300}
                    className="max-h-[200px] w-auto rounded object-contain"
                  />
                ) : infoFile.mimeType.startsWith("video/") ? (
                  <video
                    src={buildMediaUrl(infoFile.id)}
                    controls
                    className="max-h-[200px] w-auto rounded"
                  />
                ) : (
                  <div className="text-muted-foreground text-center">
                    <File className="mx-auto mb-2 h-16 w-16" />
                    <p>Preview not available</p>
                  </div>
                )}
              </div>

              {isEditing ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>For</Label>
                      <Select value={editFor} onValueChange={setEditFor}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="gig">Gig</SelectItem>
                          <SelectItem value="gig_media">Gig Media</SelectItem>
                          <SelectItem value="gig_poster">Gig Poster</SelectItem>
                          <SelectItem value="crew">Crew</SelectItem>
                          <SelectItem value="merch">Merch</SelectItem>
                          <SelectItem value="content">Content</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>For ID</Label>
                      <Input
                        value={editForId}
                        onChange={(e) => setEditForId(e.target.value)}
                        placeholder="Entity ID"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={editCategory}
                        onValueChange={setEditCategory}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IMAGE">Image</SelectItem>
                          <SelectItem value="VIDEO">Video</SelectItem>
                          <SelectItem value="AUDIO">Audio</SelectItem>
                          <SelectItem value="PDF">PDF</SelectItem>
                          <SelectItem value="DOCUMENT">Document</SelectItem>
                          <SelectItem value="FILE">File</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OK">OK</SelectItem>
                          <SelectItem value="UPLOADING">Uploading</SelectItem>
                          <SelectItem value="SOFT_DELETED">
                            Soft Deleted
                          </SelectItem>
                          <SelectItem value="DELETED">Deleted</SelectItem>
                          <SelectItem value="ERRORED">Errored</SelectItem>
                          <SelectItem value="NO_FILE">No File</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex min-h-[42px] flex-wrap gap-2 rounded-md border p-3">
                      {tags?.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant={
                            editTagIds.includes(tag.id) ? "default" : "outline"
                          }
                          className="cursor-pointer"
                          onClick={() =>
                            toggleTag(tag.id, editTagIds, setEditTagIds)
                          }
                        >
                          <Tag className="mr-1 h-3 w-3" />
                          {tag.name}
                          {editTagIds.includes(tag.id) && (
                            <X className="ml-1 h-3 w-3" />
                          )}
                        </Badge>
                      ))}
                      {(!tags || tags.length === 0) && (
                        <span className="text-muted-foreground text-sm">
                          No tags available
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow
                    label="Name"
                    value={infoFile.name}
                    onCopy={() => copyToClipboard(infoFile.name, "name")}
                    copied={copiedField === "name"}
                  />
                  <InfoRow
                    label="ID"
                    value={infoFile.id}
                    onCopy={() => copyToClipboard(infoFile.id, "id")}
                    copied={copiedField === "id"}
                    mono
                  />
                  <InfoRow
                    label="S3 Key"
                    value={infoFile.key}
                    onCopy={() => copyToClipboard(infoFile.key, "key")}
                    copied={copiedField === "key"}
                    mono
                  />
                  <LinkRow
                    label="Website URL"
                    url={buildMediaUrl(infoFile.id)}
                    hint="Served through the app with long-lived cache headers. Works regardless of the object's ACL — use this one in the site."
                    onCopy={() =>
                      copyToClipboard(buildMediaUrl(infoFile.id), "mediaUrl")
                    }
                    copied={copiedField === "mediaUrl"}
                  />
                  <LinkRow
                    label="Direct S3 URL"
                    url={infoFile.url}
                    hint={
                      infoFile.acl === "private"
                        ? "This object is private, so the direct link will return Access Denied to anyone without S3 credentials."
                        : "Straight from the bucket, bypassing the app."
                    }
                    onCopy={() => copyToClipboard(infoFile.url, "url")}
                    copied={copiedField === "url"}
                  />
                  <InfoRow label="MIME Type" value={infoFile.mimeType} />
                  <InfoRow label="Size" value={formatFileSize(infoFile.size)} />
                  {infoFile.width && infoFile.height ? (
                    <InfoRow
                      label="Dimensions"
                      value={`${infoFile.width} × ${infoFile.height} px`}
                    />
                  ) : null}
                  {infoFile.width && infoFile.height ? (
                    <InfoRow
                      label="Aspect ratio"
                      value={aspectRatioLabel(infoFile.width, infoFile.height)}
                    />
                  ) : null}
                  <InfoRow label="For" value={infoFile.for} />
                  <InfoRow
                    label="For ID"
                    value={infoFile.forId}
                    onCopy={() => copyToClipboard(infoFile.forId, "forId")}
                    copied={copiedField === "forId"}
                    mono
                  />
                  <InfoRow label="Category" value={infoFile.category} />
                  <InfoRow
                    label="Upload target"
                    value={infoFile.preset ?? "— (pre-dates the upload system)"}
                  />
                  {infoFile.originalSize &&
                  infoFile.originalSize > infoFile.size ? (
                    <InfoRow
                      label="Original size"
                      value={`${formatFileSize(infoFile.originalSize)} → saved ${formatFileSize(
                        infoFile.originalSize - infoFile.size,
                      )}`}
                    />
                  ) : null}
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">
                      Tags
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {infoFile.fileTags.length > 0 ? (
                        infoFile.fileTags.map((tag) => (
                          <Badge key={tag.id} variant="outline">
                            <Tag className="mr-1 h-3 w-3" />
                            {tag.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          No tags
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">ACL</Label>
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant={
                          infoFile.acl === "public-read" ||
                          infoFile.acl === "public-read-write"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {infoFile.acl === "public-read"
                          ? "Public Read"
                          : infoFile.acl === "public-read-write"
                            ? "Public Read/Write"
                            : infoFile.acl === "authenticated-read"
                              ? "Authenticated Read"
                              : "Private"}
                      </Badge>
                      <p className="text-muted-foreground text-xs">
                        {infoFile.acl === "private" &&
                          "Only accessible with credentials"}
                        {infoFile.acl === "public-read" &&
                          "Anyone can read, only owner can write"}
                        {infoFile.acl === "public-read-write" &&
                          "Anyone can read and write"}
                        {infoFile.acl === "authenticated-read" &&
                          "Only authenticated AWS users can read"}
                      </p>
                    </div>
                  </div>
                  <InfoRow
                    label="Status"
                    value={
                      <Badge
                        variant={
                          FILE_STATUS_LABELS[infoFile.status]?.variant ??
                          "outline"
                        }
                      >
                        {FILE_STATUS_LABELS[infoFile.status]?.label ??
                          infoFile.status}
                      </Badge>
                    }
                  />
                  <InfoRow
                    label="Uploaded"
                    value={format(new Date(infoFile.createdAt), "PPpp")}
                  />
                  {infoFile.linkedEntity && (
                    <InfoRow
                      label="Linked To"
                      value={
                        <a
                          href={`/admin/${infoFile.linkedEntity.type}s/${infoFile.linkedEntity.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {infoFile.linkedEntity.title}
                        </a>
                      }
                    />
                  )}
                </div>
              )}

              {/* Actions */}
              <DialogFooter>
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      disabled={isSavingFile}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveFile} disabled={isSavingFile}>
                      {isSavingFile ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" asChild>
                      <a
                        href={buildMediaUrl(infoFile.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open in New Tab
                      </a>
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setInfoFile(null);
                        handleDelete(infoFile.id);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tag Management Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Create and manage file tags for organizing your uploads
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Create New Tag */}
            <div className="bg-muted/50 space-y-3 rounded-lg border p-4">
              <Label className="font-medium">Create New Tag</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || isCreatingTag}
                  size="sm"
                >
                  {isCreatingTag ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Input
                placeholder="Description (optional)"
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
              />
            </div>

            {/* Existing Tags */}
            <div className="space-y-2">
              <Label className="font-medium">Existing Tags</Label>
              <div className="max-h-[300px] space-y-2 overflow-y-auto">
                {tags?.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="text-muted-foreground h-4 w-4" />
                      <div>
                        <p className="font-medium">{tag.name}</p>
                        {tag.description && (
                          <p className="text-muted-foreground text-xs">
                            {tag.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {tag._count.fileUploads} files
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-8 w-8 p-0"
                      onClick={() => setDeleteTagId(tag.id)}
                      disabled={tag._count.fileUploads > 0}
                      title={
                        tag._count.fileUploads > 0
                          ? "Cannot delete tag with files"
                          : "Delete tag"
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {(!tags || tags.length === 0) && (
                  <p className="text-muted-foreground py-4 text-center">
                    No tags created yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Tag Confirmation */}
      <AlertDialog
        open={!!deleteTagId}
        onOpenChange={(open) => !open && setDeleteTagId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tag? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTag.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTagId && deleteTag.mutate({ id: deleteTagId })
              }
              disabled={deleteTag.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTag.isPending ? (
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

      {/* Bulk Tag Dialog */}
      <Dialog
        open={bulkTagDialogOpen}
        onOpenChange={(open) => {
          if (!isBulkTagging) {
            setBulkTagDialogOpen(open);
            if (!open) {
              setBulkTagIds([]);
            }
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkTagMode === "add" ? (
                <>
                  <Plus className="h-5 w-5" />
                  Add Tags to {selectedFileIds.size} File
                  {selectedFileIds.size !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  <Minus className="h-5 w-5" />
                  Remove Tags from {selectedFileIds.size} File
                  {selectedFileIds.size !== 1 ? "s" : ""}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {bulkTagMode === "add"
                ? "Select tags to add to all selected files"
                : "Select tags to remove from all selected files"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Tags</Label>
              <div className="flex max-h-[200px] min-h-[100px] flex-wrap gap-2 overflow-y-auto rounded-md border p-3">
                {tags?.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={
                      bulkTagIds.includes(tag.id) ? "default" : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag.id, bulkTagIds, setBulkTagIds)}
                  >
                    <Tag className="mr-1 h-3 w-3" />
                    {tag.name}
                    {bulkTagIds.includes(tag.id) && (
                      <X className="ml-1 h-3 w-3" />
                    )}
                  </Badge>
                ))}
                {(!tags || tags.length === 0) && (
                  <span className="text-muted-foreground text-sm">
                    No tags available
                  </span>
                )}
              </div>
            </div>

            {bulkTagIds.length > 0 && (
              <div className="bg-muted/50 flex items-center gap-2 rounded-lg p-3">
                <Tags className="text-muted-foreground h-4 w-4" />
                <span className="text-sm">
                  {bulkTagIds.length} tag{bulkTagIds.length !== 1 ? "s" : ""}{" "}
                  selected
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkTagDialogOpen(false)}
              disabled={isBulkTagging}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkTagAction}
              disabled={bulkTagIds.length === 0 || isBulkTagging}
              variant={bulkTagMode === "remove" ? "destructive" : "default"}
            >
              {isBulkTagging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {bulkTagMode === "add" ? "Adding..." : "Removing..."}
                </>
              ) : (
                <>
                  {bulkTagMode === "add" ? (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Tags
                    </>
                  ) : (
                    <>
                      <Minus className="mr-2 h-4 w-4" />
                      Remove Tags
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for info rows
/**
 * A full-width URL row: clickable, copyable, and openable in a new tab.
 * Spans both columns because URLs are long and truncating them mid-path makes
 * them useless at a glance.
 */
function LinkRow({
  label,
  url,
  hint,
  onCopy,
  copied,
}: {
  label: string;
  url: string;
  hint?: string;
  onCopy: () => void;
  copied?: boolean;
}) {
  return (
    <div className="col-span-2 space-y-1">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={url}
          className="text-primary min-w-0 flex-1 truncate font-mono text-sm hover:underline"
        >
          {url}
        </a>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 shrink-0 p-0"
          onClick={onCopy}
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 shrink-0 p-0"
          asChild
        >
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${label} in a new tab`}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>
      {hint ? (
        <p className="text-muted-foreground text-[11px] leading-tight">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Reduces pixel dimensions to a readable ratio, e.g. "16:9 (1.78)". */
function aspectRatioLabel(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height) || 1;
  const w = width / divisor;
  const h = height / divisor;
  const decimal = (width / height).toFixed(2);
  // Ratios like 1907:1073 tell you nothing; fall back to the decimal.
  return w <= 32 && h <= 32 ? `${w}:${h} (${decimal})` : decimal;
}

function InfoRow({
  label,
  value,
  onCopy,
  copied,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  onCopy?: () => void;
  copied?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm break-all ${mono ? "font-mono" : ""}`}
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </span>
        {onCopy && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 shrink-0 p-0"
            onClick={onCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
