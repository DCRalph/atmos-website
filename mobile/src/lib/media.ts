import { API_URL } from "@/lib/env";

/**
 * URLs for uploaded media, matching the web's `buildMediaUrl`.
 *
 * Everything goes through `/api/media/[id]` rather than straight to S3: that
 * endpoint sets long cache headers and survives the bucket moving, and it is
 * what the web already uses, so both surfaces hit the same cache.
 */
export function mediaUrl(fileUploadId: string): string {
  return `${API_URL}/api/media/${fileUploadId}`;
}

/** A gig media row's display URL, preferring the cached endpoint. */
export function gigMediaUrl(item: {
  fileUploadId?: string | null;
  url?: string | null;
  fileUpload?: { id: string; url: string } | null;
}): string | null {
  if (item.fileUpload?.id) return mediaUrl(item.fileUpload.id);
  if (item.fileUploadId) return mediaUrl(item.fileUploadId);
  return item.fileUpload?.url ?? item.url ?? null;
}
