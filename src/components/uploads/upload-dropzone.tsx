"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { useUpload } from "~/hooks/use-upload";
import type { UploadContext, UploadPresetName } from "~/lib/uploads/presets";
import type { UploadedFile } from "~/lib/uploads/types";
import { describeConstraints } from "~/lib/uploads/validate";
import { UploadProgressList } from "./upload-progress-list";

type Props<K extends UploadPresetName> = {
  preset: K;
  context?: UploadContext<K>;
  tagIds?: string[];
  /** Called with everything that uploaded successfully. */
  onComplete?: (files: UploadedFile[]) => void | Promise<void>;
  /** Called as each individual file lands. */
  onFileComplete?: (file: UploadedFile) => void | Promise<void>;
  /** Defaults to the preset's own limit. */
  multiple?: boolean;
  /** Replaces the default "Drag files here" copy. */
  title?: string;
  /** Replaces the auto-generated constraint summary. */
  helperText?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Drag-and-drop upload surface. Constraints, accepted types and helper text
 * all come from the preset, so a new upload location only has to name one.
 */
export function UploadDropzone<K extends UploadPresetName>({
  preset,
  context,
  tagIds,
  onComplete,
  onFileComplete,
  multiple,
  title = "Drag files here, or click to browse",
  helperText,
  disabled,
  className,
}: Props<K>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    upload,
    items,
    isUploading,
    cancel,
    constraints,
    accept,
    multiple: presetAllowsMultiple,
  } = useUpload(preset, {
    context,
    tagIds,
    onComplete,
    onFileComplete,
    onError: (message) => toast.error(message),
  });

  const allowMultiple = multiple ?? presetAllowsMultiple;
  const isDisabled = disabled ?? isUploading;

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      void upload(files);
    },
    [upload],
  );

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={allowMultiple}
        className="sr-only"
        disabled={isDisabled}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={isDisabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDisabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!isDisabled) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "hover:border-muted-foreground/50 hover:bg-muted/40",
          isDisabled && "cursor-not-allowed opacity-60",
        )}
      >
        <Upload className="text-muted-foreground h-6 w-6" />
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">
          {helperText ?? describeConstraints(constraints)}
        </span>
      </button>

      <UploadProgressList items={items} onCancel={cancel} />
    </div>
  );
}
