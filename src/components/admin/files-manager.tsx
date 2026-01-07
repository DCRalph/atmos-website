"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { FileUploadStatus } from "~Prisma/client";

const FILE_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
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
  linkedEntity: { type: string; id: string; title: string } | null;
};

export function FilesManager() {
  const [search, setSearch] = useState("");
  const [mimeFilter, setMimeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Info dialog state
  const [infoFile, setInfoFile] = useState<FileInfo | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const queryParams = {
    limit: 50,
    search: search || undefined,
    mimeTypePrefix: mimeFilter !== "all" ? mimeFilter : undefined,
    status: statusFilter === "active"
      ? undefined
      : statusFilter === "deleted"
        ? "SOFT_DELETED" as FileUploadStatus
        : undefined,
  };

  const {
    data: filesData,
    isLoading,
    refetch,
    isFetching,
  } = api.files.getAll.useQuery(queryParams, {
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const { data: stats } = api.files.getStats.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

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

  const uploadBase64 = api.files.uploadBase64.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  // Upload handlers
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    setUploadFiles(prev => [...prev, ...fileArray]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const removeUploadFile = useCallback((index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    if (uploadFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: uploadFiles.length });

    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        if (!file) continue;

        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await uploadBase64.mutateAsync({
          base64,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          for: uploadCategory,
          forId: crypto.randomUUID(),
          keyPrefix: `uploads/${uploadCategory}`,
        });

        setUploadProgress({ current: i + 1, total: uploadFiles.length });
      }

      // Reset and close dialog on success
      setUploadFiles([]);
      setUploadDialogOpen(false);
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  }, [uploadFiles, uploadCategory, uploadBase64]);

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const handleDelete = useCallback((fileId: string, permanent: boolean = false) => {
    setDeleteFileId(fileId);
    setDeletePermanently(permanent);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteFileId) return;
    if (deletePermanently) {
      permanentDelete.mutate({ id: deleteFileId });
    } else {
      softDelete.mutate({ id: deleteFileId });
    }
  }, [deleteFileId, deletePermanently, permanentDelete, softDelete]);

  const handleRestore = useCallback((fileId: string) => {
    restore.mutate({ id: fileId });
  }, [restore]);

  const files = filesData?.files ?? [];
  const isDeleting = softDelete.isPending || permanentDelete.isPending;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalFiles ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
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
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
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
            <FileText className="h-4 w-4 text-muted-foreground" />
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
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
          </div>

          {/* Files Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <div className="h-12 w-full animate-pulse rounded bg-muted" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : files.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No files found
                    </TableCell>
                  </TableRow>
                ) : (
                  files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                          {file.mimeType.startsWith("image/") ? (
                            <Image
                              src={file.url}
                              alt={file.name}
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            getFileIcon(file.mimeType)
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[200px]" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={file.key}>
                            {file.key}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {file.for}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatFileSize(file.size)}</TableCell>
                      <TableCell>
                        <Badge variant={FILE_STATUS_LABELS[file.status]?.variant ?? "outline"}>
                          {FILE_STATUS_LABELS[file.status]?.label ?? file.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {file.linkedEntity ? (
                          <a
                            href={`/admin/${file.linkedEntity.type}s/${file.linkedEntity.id}`}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {file.linkedEntity.title}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setInfoFile(file as FileInfo)}
                            title="View Info"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setPreviewFile({
                              url: file.url,
                              name: file.name,
                              mimeType: file.mimeType,
                            })}
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
                            <a href={file.url} target="_blank" rel="noopener noreferrer">
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
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(file.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
            <div className="flex items-center justify-center bg-muted rounded-lg p-4 min-h-[300px]">
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
                <div className="text-center text-muted-foreground">
                  <File className="mx-auto h-16 w-16 mb-2" />
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
      <AlertDialog open={!!deleteFileId} onOpenChange={(open) => !open && setDeleteFileId(null)}>
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
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        if (!isUploading) {
          setUploadDialogOpen(open);
          if (!open) {
            setUploadFiles([]);
          }
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Upload new files to the media library. Drag and drop or click to select files.
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

            {/* Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDragging
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
                accept="image/*,video/*,audio/*,application/pdf"
              />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Drag and drop files here, or click to select
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Images, videos, audio, and PDFs up to 100MB each
              </p>
            </div>

            {/* File List */}
            {uploadFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files ({uploadFiles.length})</Label>
                <div className="max-h-48 overflow-y-auto space-y-2 rounded-md border p-2">
                  {uploadFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted p-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getFileIcon(file.type)}
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0"
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
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress.current} / {uploadProgress.total}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

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
                    Upload {uploadFiles.length > 0 ? `(${uploadFiles.length})` : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* File Info Dialog */}
      <Dialog open={!!infoFile} onOpenChange={(open) => !open && setInfoFile(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>File Information</DialogTitle>
            <DialogDescription>
              Detailed information about this file
            </DialogDescription>
          </DialogHeader>

          {infoFile && (
            <div className="space-y-6">
              {/* Preview */}
              <div className="flex items-center justify-center bg-muted rounded-lg p-4 min-h-[200px]">
                {infoFile.mimeType.startsWith("image/") ? (
                  <Image
                    src={infoFile.url}
                    alt={infoFile.name}
                    width={400}
                    height={300}
                    className="max-h-[200px] w-auto rounded object-contain"
                  />
                ) : infoFile.mimeType.startsWith("video/") ? (
                  <video
                    src={infoFile.url}
                    controls
                    className="max-h-[200px] w-auto rounded"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <File className="mx-auto h-16 w-16 mb-2" />
                    <p>Preview not available</p>
                  </div>
                )}
              </div>

              {/* Info Grid */}
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
                <InfoRow
                  label="URL"
                  value={infoFile.url}
                  onCopy={() => copyToClipboard(infoFile.url, "url")}
                  copied={copiedField === "url"}
                  mono
                />
                <InfoRow label="MIME Type" value={infoFile.mimeType} />
                <InfoRow label="Size" value={formatFileSize(infoFile.size)} />
                {infoFile.width && infoFile.height && (
                  <InfoRow label="Dimensions" value={`${infoFile.width} × ${infoFile.height}`} />
                )}
                <InfoRow label="Category" value={infoFile.for} />
                <InfoRow
                  label="Status"
                  value={
                    <Badge variant={FILE_STATUS_LABELS[infoFile.status]?.variant ?? "outline"}>
                      {FILE_STATUS_LABELS[infoFile.status]?.label ?? infoFile.status}
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

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <a href={infoFile.url} target="_blank" rel="noopener noreferrer">
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
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for info rows
function InfoRow({
  label,
  value,
  onCopy,
  copied,
  mono,
  truncate,
}: {
  label: string;
  value: React.ReactNode;
  onCopy?: () => void;
  copied?: boolean;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm break-all ${mono ? "font-mono" : ""} ${truncate ? "truncate max-w-[200px]" : ""}`}
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </span>
        {onCopy && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
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

