"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageOff, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { buildMediaUrl } from "~/lib/media-url";
import { presetConstraints } from "~/lib/uploads/presets";
import { describeConstraints, validateFile } from "~/lib/uploads/validate";
import { cn } from "~/lib/utils";
import type { PosterDraft } from "./types";

const CONSTRAINTS = presetConstraints("gigPoster");
const ACCEPT = CONSTRAINTS.accept.join(",");

type PosterFieldProps = {
  gigTitle: string;
  /** The poster stored on the gig right now, if any. */
  current: { fileUploadId: string; name: string } | null;
  draft: PosterDraft;
  onChange: (draft: PosterDraft) => void;
  /** 0-100 while Save is transferring the poster, null otherwise. */
  uploadProgress: number | null;
  disabled?: boolean;
};

/**
 * The poster picker. Deliberately does not upload anything itself — the file is
 * handed to the page's Save so the poster commits with everything else, and so
 * a poster can be chosen before the gig it belongs to exists.
 */
export function PosterField({
  gigTitle,
  current,
  draft,
  onChange,
  uploadProgress,
  disabled = false,
}: PosterFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);

  const pendingFile = draft.kind === "replace" ? draft.file : null;
  const previewUrl = usePreviewUrl(pendingFile);

  const shown = useMemo(() => {
    if (previewUrl) return { url: previewUrl, isPending: true };
    if (draft.kind === "remove" || !current) return null;
    return { url: buildMediaUrl(current.fileUploadId), isPending: false };
  }, [previewUrl, draft.kind, current]);

  const accept = (file: File) => {
    const reason = validateFile(file, CONSTRAINTS);
    if (reason) {
      setRejection(reason);
      return;
    }
    setRejection(null);
    onChange({ kind: "replace", file });
  };

  const isBusy = uploadProgress !== null;
  const isDisabled = disabled || isBusy;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Poster</CardTitle>
            <CardDescription>
              The single portrait image (ideally 3:4) shown on the public gig
              page.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={isDisabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) accept(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isDisabled}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {shown ? "Replace" : "Choose image"}
            </Button>
            {draft.kind === "keep" && current ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={isDisabled}
                onClick={() => onChange({ kind: "remove" })}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            ) : null}
            {draft.kind !== "keep" ? (
              <Button
                type="button"
                variant="ghost"
                disabled={isDisabled}
                onClick={() => {
                  setRejection(null);
                  onChange({ kind: "keep" });
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Undo
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!isDisabled) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (isDisabled) return;
              const file = e.dataTransfer.files?.[0];
              if (file) accept(file);
            }}
            className={cn(
              "bg-muted relative aspect-3/4 w-full max-w-xs shrink-0 overflow-hidden rounded-lg border transition-colors",
              !shown && "border-dashed",
              isDragging && "border-primary bg-primary/5",
            )}
          >
            {shown ? (
              // Deliberately a plain img: this is either a local object URL or
              // an already-cached /api/media response, so next/image buys
              // nothing and its remote-host allowlist is one more thing to
              // break when the bucket or CDN changes.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shown.url}
                alt={`${gigTitle || "Gig"} poster`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-sm">
                {draft.kind === "remove" ? (
                  <>
                    <ImageOff className="h-5 w-5" />
                    <span>Poster will be removed when you save</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    <span>Drop an image here, or use Choose image</span>
                  </>
                )}
              </div>
            )}

            {isBusy ? (
              <div className="bg-background/70 absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs font-medium">
                  Uploading {uploadProgress}%
                </span>
              </div>
            ) : null}
            {isBusy ? (
              <div className="bg-muted absolute inset-x-0 bottom-0 h-1">
                <div
                  className="bg-primary h-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            ) : null}
          </div>

          <div className="text-muted-foreground space-y-2 text-sm">
            {draft.kind === "replace" ? (
              <p>
                <span className="text-foreground font-medium">
                  {pendingFile?.name}
                </span>{" "}
                is ready — it uploads when you save.
              </p>
            ) : draft.kind === "remove" ? (
              <p>
                The current poster will be detached and its file retired when
                you save.
              </p>
            ) : current ? (
              <p>
                Current poster:{" "}
                <span className="text-foreground font-medium">
                  {current.name}
                </span>
              </p>
            ) : (
              <p>No poster yet.</p>
            )}
            <p className="text-xs">{describeConstraints(CONSTRAINTS)}</p>
            {rejection ? (
              <p className="text-destructive text-sm">{rejection}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Object URL for a locally picked file, revoked when it changes or unmounts. */
function usePreviewUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return url;
}
