"use client";

import { useRef } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { api } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";

type Kind = "theme_bg" | "block_image";

type Props = {
  /** The currently stored `file_upload.id`, or null if no image set. */
  value: string | null;
  /** Called with the new `file_upload.id` on successful upload, or `null` when removed. */
  onChange: (fileId: string | null) => void;
  /**
   * Profile id the uploaded file is associated with. Omit to use the current
   * user's own profile (admin mode should pass a specific profileId).
   */
  profileId?: string;
  /** Determines the `for` tag on the `file_upload` row. */
  kind: Kind;
  /** Optional label shown above the control. */
  label?: string;
  /** Optional helper text shown under the control. */
  helperText?: string;
  /**
   * Thumbnail aspect ratio. Defaults to "wide" for background images, "square"
   * looks nicer for smaller thumbnails.
   */
  aspect?: "square" | "wide";
};

export function ImageUploadField({
  value,
  onChange,
  profileId,
  kind,
  label,
  helperText,
  aspect = "wide",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMut = api.creatorProfiles.uploadProfileImage.useMutation();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await uploadMut.mutateAsync({
        profileId,
        base64,
        name: file.name,
        mimeType: file.type,
        kind,
      });
      onChange(res.fileId);
    } catch {
      // Error surfaces via uploadMut.error below.
    }
  }

  const previewUrl = value ? buildMediaUrl(value) : null;
  const pending = uploadMut.isPending;
  const aspectClass = aspect === "square" ? "aspect-square" : "aspect-video";

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(ev) => void onFileChange(ev)}
      />
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className={`group relative w-32 shrink-0 overflow-hidden rounded-md border ${aspectClass} bg-muted disabled:opacity-60`}
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
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {pending ? (
              <Loader2 className="text-foreground h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="text-foreground h-5 w-5" />
            )}
          </div>
        </button>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              <span className="ml-1.5">{value ? "Replace" : "Upload"}</span>
            </Button>
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
            {helperText ?? "JPG, PNG, WebP or GIF. Auto-resized."}
          </p>
        </div>
      </div>
      {uploadMut.error ? (
        <p className="text-destructive text-xs">{uploadMut.error.message}</p>
      ) : null}
    </div>
  );
}
