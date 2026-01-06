"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
    </div>
  );
}

