"use client";

import { useEffect, useRef, useState } from "react";
import { FolderOpen, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { api } from "~/trpc/react";
import { MediaImagePicker } from "./media-image-picker";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { buildMediaUrl } from "~/lib/media-url";
import { cn } from "~/lib/utils";
import { useUpload } from "~/hooks/use-upload";
import type { UploadContext, UploadPresetName } from "~/lib/uploads/presets";
import type { UploadedFile } from "~/lib/uploads/types";
import { describeConstraints } from "~/lib/uploads/validate";

type Props<K extends UploadPresetName> = {
  preset: K;
  context?: UploadContext<K>;
  /** The stored `file_upload.id`, or null when nothing is set. */
  value: string | null;
  /** Receives the new file id, or null when the image is removed. */
  onChange: (fileId: string | null, file?: UploadedFile) => void;
  onUploadingChange?: (uploading: boolean) => void;
  label?: string;
  helperText?: string;
  /** Thumbnail shape. */
  aspect?: "square" | "wide" | "portrait";
  disabled?: boolean;
  className?: string;
};

/**
 * A single image with a live preview — the standard control for avatars,
 * banners, posters and any other one-image field.
 */
export function ImageUploadField<K extends UploadPresetName>({
  preset,
  context,
  value,
  onChange,
  onUploadingChange,
  label,
  helperText,
  aspect = "wide",
  disabled,
  className,
}: Props<K>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const me = api.user.me.useQuery();
  const canChooseExisting =
    me.data?.effectivePermissions.includes("ADMIN") ?? false;

  const { upload, items, isUploading, constraints, accept } = useUpload(
    preset,
    {
      context,
      onComplete: (files) => {
        const file = files[0];
        if (file) onChange(file.id, file);
      },
      onError: (message) => toast.error(message),
    },
  );

  const pending = isUploading || disabled;
  useEffect(() => {
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);
  const previewUrl = value ? buildMediaUrl(value) : null;
  const progress = items.at(-1)?.progress ?? 0;

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <Label>{label}</Label> : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={pending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload([file]);
        }}
      />

      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className={cn(
            "group bg-muted relative w-32 shrink-0 overflow-hidden rounded-md border disabled:opacity-60",
            {
              square: "aspect-square",
              wide: "aspect-video",
              portrait: "aspect-3/4",
            }[aspect],
          )}
          aria-label={value ? "Replace image" : "Upload image"}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-muted-foreground grid h-full w-full place-items-center">
              <ImagePlus className="h-5 w-5" />
            </div>
          )}
          <div
            className={cn(
              "bg-background/70 absolute inset-0 flex items-center justify-center transition-opacity",
              isUploading
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
            )}
          >
            {isUploading ? (
              <Loader2 className="text-foreground h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="text-foreground h-5 w-5" />
            )}
          </div>
          {isUploading ? (
            <div className="bg-muted absolute inset-x-0 bottom-0 h-1">
              <div
                className="bg-primary h-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
        </button>

        <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              <span className="ml-1.5">{value ? "Replace" : "Upload"}</span>
            </Button>
            {canChooseExisting ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setPickerOpen(true)}
              >
                <FolderOpen className="h-4 w-4" />
                <span className="ml-1.5">Choose existing</span>
              </Button>
            ) : null}
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() => onChange(null)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-1.5">Remove</span>
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground text-[11px] leading-tight">
            {helperText ?? describeConstraints(constraints)}
          </p>
        </div>
      </div>
      {pickerOpen && !pending ? (
        <MediaImagePicker
          preset={preset}
          value={value}
          onSelect={(file) => onChange(file.id, file)}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
