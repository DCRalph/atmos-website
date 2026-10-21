"use client";

import Image from "next/image";
import { FileText } from "lucide-react";
import { useEffect, useRef } from "react";

/** A small preview shared by pending files and saved conversation attachments. */
export function AttachmentPreview({
  name,
  mimeType,
  file,
  id,
}: {
  name: string;
  mimeType: string;
  file?: File;
  id?: string;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const isImage = mimeType.startsWith("image/");
  useEffect(() => {
    if (!file || !isImage || !imageRef.current) return;
    const url = URL.createObjectURL(file);
    imageRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);
  const src = id
    ? `/api/media/${id}`
    : "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  return isImage ? (
    <Image
      ref={imageRef}
      src={src}
      alt={name}
      title={name}
      width={72}
      height={80}
      unoptimized
      className="h-20 w-18 rounded border object-cover"
    />
  ) : (
    <span
      title={name}
      className="bg-muted flex h-20 w-28 flex-col justify-between gap-2 rounded border p-2 text-xs"
    >
      <FileText className="text-muted-foreground size-5" />
      <span className="truncate">{name}</span>
    </span>
  );
}
