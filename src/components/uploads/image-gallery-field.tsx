"use client";

import { useRef } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "~/components/ui/label";
import { buildMediaUrl } from "~/lib/media-url";
import { cn } from "~/lib/utils";
import { useUpload } from "~/hooks/use-upload";
import type { UploadContext, UploadPresetName } from "~/lib/uploads/presets";
import { describeConstraints } from "~/lib/uploads/validate";

type Props<K extends UploadPresetName> = {
  preset: K;
  context?: UploadContext<K>;
  /** The `file_upload.id`s currently in the gallery, in display order. */
  value: string[];
  onChange: (fileIds: string[]) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
};

/** A grid of images backed by one preset — add many, remove individually. */
export function ImageGalleryField<K extends UploadPresetName>({
  preset,
  context,
  value,
  onChange,
  label,
  helperText,
  disabled,
  className,
}: Props<K>) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { upload, items, isUploading, constraints, accept } = useUpload(preset, {
    context,
    onComplete: (files) => onChange([...value, ...files.map((f) => f.id)]),
    onError: (message) => toast.error(message),
  });

  const pending = isUploading || disabled;
  const inFlight = items.filter(
    (i) => i.status !== "done" && i.status !== "error" && i.status !== "cancelled",
  );

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <Label>{label}</Label> : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        disabled={pending}
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((id, index) => (
          <div
            key={`${id}-${index}`}
            className="group bg-muted relative aspect-square overflow-hidden rounded-md border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={buildMediaUrl(id)}
              alt=""
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="bg-background/80 hover:bg-background absolute top-1 right-1 rounded-sm p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-label="Remove image"
            >
              <Trash2 className="text-destructive h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {/* Placeholders for files still on their way up. */}
        {inFlight.map((item) => (
          <div
            key={item.id}
            className="bg-muted/50 relative grid aspect-square place-items-center overflow-hidden rounded-md border"
          >
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            <div className="bg-muted absolute inset-x-0 bottom-0 h-1">
              <div
                className="bg-primary h-full transition-all duration-200"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted flex aspect-square items-center justify-center rounded-md border border-dashed transition-colors disabled:opacity-60"
        >
          <div className="flex flex-col items-center gap-1">
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px]">Add</span>
          </div>
        </button>
      </div>

      <p className="text-muted-foreground text-[11px] leading-tight">
        {helperText ?? describeConstraints(constraints)}
      </p>
    </div>
  );
}
