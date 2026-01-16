/**
 * Client-safe media URL helper functions.
 * These can be imported and used in both server and client components.
 */

/**
 * Get the app URL from environment.
 * Uses NEXT_PUBLIC_APP_URL for client compatibility.
 */
const getAppUrl = (): string => {
  // NEXT_PUBLIC_APP_URL is available on both client and server
  const url = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return url.replace(/\/$/, "");
};

/**
 * Build a media URL using the app's media API endpoint.
 * This route serves files from S3 with 1-year cache headers.
 *
 * @param fileUploadId - The file_upload record ID
 * @returns Full URL to the media endpoint (e.g., https://example.com/api/media/abc123)
 */
export const buildMediaUrl = (fileUploadId: string): string => {
  return `${getAppUrl()}/api/media/${fileUploadId}`;
};

/**
 * Build a gig image URL for displaying gig media.
 * Alias for buildMediaUrl - uses the same endpoint.
 *
 * @param fileUploadId - The file_upload record ID
 * @returns Full URL to the media endpoint
 */
export const buildGigImageUrl = (fileUploadId: string): string => {
  return buildMediaUrl(fileUploadId);
};

/**
 * Get the display URL for a media item.
 * Prefers the internal media API URL for caching, falls back to direct S3 URL.
 *
 * @param media - Object with optional fileUploadId and url fields
 * @returns URL to display the media
 */
export const getMediaDisplayUrl = (media: {
  fileUploadId?: string | null;
  url?: string | null;
  fileUpload?: { id: string; url: string } | null;
}): string => {
  // If we have a fileUpload with id, use the cached media endpoint
  if (media.fileUpload?.id) {
    return buildMediaUrl(media.fileUpload.id);
  }
  // If we have a fileUploadId directly, use the cached media endpoint
  if (media.fileUploadId) {
    return buildMediaUrl(media.fileUploadId);
  }
  // Fall back to the direct URL (legacy or external media)
  return media.fileUpload?.url ?? media.url ?? "";
};
