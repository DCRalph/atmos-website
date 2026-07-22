"use client";

import { useRef } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { api } from "~/trpc/react";
import { buildMediaUrl } from "~/lib/media-url";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";

type Props = {
  /** Array of `file_upload.id` strings currently in the gallery. */
  value: string[];
  /** Called with the new array whenever an image is added or removed. */
  onChange: (fileIds: string[]) => void;
  /**
   * Profile id the uploaded files are associated with. Omit to use the
   * current user's own profile (admin mode should pass a specific profileId).
   */
  profileId?: string;
  /** Optional label shown above the grid. */
  label?: string;
};

export function ImageGalleryUpload({
  value,
  onChange,
  profileId,
  label,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMut = api.creatorProfiles.uploadProfileImage.useMutation();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    const newIds: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
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
          kind: "block_image",
        });
        newIds.push(res.fileId);
      } catch {
        // Error surfaces via uploadMut.error below.
      }
    }
    if (newIds.length) onChange([...value, ...newIds]);
  }

  function removeAt(index: number) {
    const copy = [...value];
    copy.splice(index, 1);
    onChange(copy);
  }

  const pending = uploadMut.isPending;

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(ev) => void onFileChange(ev)}
      />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((id, i) => (
          <div
            key={`${id}-${i}`}
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
              onClick={() => removeAt(i)}
              className="bg-background/80 hover:bg-background absolute top-1 right-1 rounded-sm p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-label="Remove image"
            >
              <Trash2 className="text-destructive h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted flex aspect-square items-center justify-center rounded-md border border-dashed transition-colors disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px]">Add</span>
            </div>
          )}
        </button>
      </div>
      <p className="text-muted-foreground text-[11px] leading-tight">
        JPG, PNG, WebP or GIF. You can select multiple files at once.
      </p>
      {uploadMut.error ? (
        <p className="text-destructive text-xs">{uploadMut.error.message}</p>
      ) : null}
    </div>
  );
}
