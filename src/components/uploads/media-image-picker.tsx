"use client";

import { useState } from "react";
import { Check, Search } from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import type { UploadPresetName } from "~/lib/uploads/presets";
import type { UploadedFile } from "~/lib/uploads/types";
import { cn } from "~/lib/utils";

type LibraryImage = RouterOutputs["files"]["images"]["files"][number];

/** Mount when opened so cancelling never changes the field's current image. */
export function MediaImagePicker({
  preset,
  value,
  onSelect,
  onClose,
}: {
  preset: UploadPresetName;
  value: string | null;
  onSelect: (file: UploadedFile) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LibraryImage | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);
  const images = api.files.images.useQuery({
    preset,
    search: debouncedSearch,
    page,
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose an image</DialogTitle>
          <DialogDescription>
            Use an image already in your media library.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4" />
          <Input
            aria-label="Search images"
            placeholder="Search images by filename"
            value={search}
            maxLength={200}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
              setSelected(null);
            }}
            className="pl-9"
          />
        </div>
        <DialogBody aria-busy={images.isFetching}>
          {images.isPending ? (
            <p
              role="status"
              className="text-muted-foreground py-12 text-center text-sm"
            >
              Loading images…
            </p>
          ) : images.isError ? (
            <div role="alert" className="space-y-3 py-8 text-center text-sm">
              <p>Images could not be loaded.</p>
              <Button variant="outline" onClick={() => void images.refetch()}>
                Try again
              </Button>
            </div>
          ) : images.data.files.length === 0 ? (
            <p
              role="status"
              className="text-muted-foreground py-12 text-center text-sm"
            >
              {debouncedSearch
                ? "No images match your search."
                : "No compatible images yet. Close this window and upload one."}
            </p>
          ) : (
            <div
              role="group"
              aria-label="Media library images"
              className="grid grid-cols-3 gap-3 sm:grid-cols-4"
            >
              {images.data.files.map((file) => {
                const checked = selected
                  ? selected.id === file.id
                  : value === file.id;
                return (
                  <button
                    type="button"
                    key={file.id}
                    aria-label={file.name}
                    aria-pressed={checked}
                    onClick={() => setSelected(file)}
                    className={cn(
                      "focus-visible:ring-ring min-w-0 rounded-md p-1 text-left outline-none focus-visible:ring-2",
                      checked
                        ? "bg-accent ring-primary ring-2"
                        : "hover:bg-accent",
                    )}
                  >
                    <span className="bg-muted relative block aspect-square overflow-hidden rounded-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={file.url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {checked ? (
                        <span className="bg-primary text-primary-foreground absolute right-1 bottom-1 rounded-full p-1">
                          <Check className="size-3" />
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="mt-1.5 block truncate text-xs"
                      title={file.name}
                    >
                      {file.name}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-[11px]">
                      {file.width && file.height
                        ? `${file.width} × ${file.height}`
                        : file.mimeType.replace("image/", "").toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </DialogBody>
        {images.data && images.data.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1 || images.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-muted-foreground tabular-nums">
              Page {page} of {images.data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= images.data.totalPages || images.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
        <DialogFooter className="grid grid-cols-2 items-center sm:flex">
          <span
            className="text-muted-foreground col-span-2 mr-auto max-w-full min-w-0 truncate text-xs"
            aria-live="polite"
          >
            {selected?.name ?? "Select an image to continue"}
          </span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!selected || images.isError}
            onClick={() => {
              if (!selected) return;
              onSelect({ ...selected, isDuplicate: true });
              onClose();
            }}
          >
            Use image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
