"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
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
import { Loader2, Trash2, Upload } from "lucide-react";
import { api } from "~/trpc/react";

type PosterCardProps = {
  gig: {
    id: string;
    title: string;
    posterFileUpload: {
      name: string;
      url: string | null;
    } | null;
  };
  onSaved: () => Promise<unknown> | void;
};

export function PosterCard({ gig, onSaved }: PosterCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPosterUploading, setIsPosterUploading] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);

  const uploadPoster = api.gigs.uploadPoster.useMutation({
    onSuccess: async () => {
      await onSaved();
      toast.success("Poster uploaded");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to upload poster");
    },
    onSettled: () => {
      setIsPosterUploading(false);
    },
  });

  const clearPoster = api.gigs.clearPoster.useMutation({
    onSuccess: async () => {
      await onSaved();
      toast.success("Poster removed");
      setIsRemoveOpen(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to remove poster");
    },
  });

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
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
    } catch (err) {
      setIsPosterUploading(false);
      toast.error(
        err instanceof Error ? err.message : "Failed to read file",
      );
    }
  };

  const isUploading = isPosterUploading || uploadPoster.isPending;
  const hasPoster = Boolean(gig.posterFileUpload);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Poster</CardTitle>
              <CardDescription>
                A single image used as the gig poster
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {hasPoster ? "Replace" : "Upload"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!hasPoster || clearPoster.isPending}
                onClick={() => setIsRemoveOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {gig.posterFileUpload?.url ? (
              <div className="bg-muted relative aspect-3/4 w-full max-w-xs shrink-0 overflow-hidden rounded-lg border">
                <Image
                  src={gig.posterFileUpload.url}
                  alt={`${gig.title} poster`}
                  fill
                  sizes="(max-width: 768px) 100vw, 320px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="border-border bg-muted/40 text-muted-foreground flex aspect-3/4 w-full max-w-xs shrink-0 flex-col items-center justify-center rounded-lg border border-dashed text-sm">
                <Upload className="mb-2 h-5 w-5" />
                No poster uploaded
              </div>
            )}
            <div className="text-muted-foreground space-y-2 text-sm">
              {gig.posterFileUpload ? (
                <>
                  <p>
                    Current poster:{" "}
                    <span className="text-foreground font-medium">
                      {gig.posterFileUpload.name}
                    </span>
                  </p>
                  <p>
                    Uploading a new image will replace the current poster. The
                    previous file is soft-deleted.
                  </p>
                </>
              ) : (
                <p>
                  Upload a portrait-orientation image (ideally 3:4) to show on
                  the public gig page.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isRemoveOpen} onOpenChange={setIsRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove poster</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the poster from this gig and soft-delete the
              underlying file. You can always upload a new one later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearPoster.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearPoster.mutate({ gigId: gig.id, deleteFile: true });
              }}
              disabled={clearPoster.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearPoster.isPending ? (
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
