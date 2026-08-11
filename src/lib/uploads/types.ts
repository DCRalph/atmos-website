/**
 * Shared types for the unified upload system.
 *
 * This module is client-safe: it must never import `sharp`, the AWS SDK, the
 * database, or anything from `~/server`. Both the browser (pre-flight
 * validation, UI copy) and the server (authoritative validation) rely on it.
 */

/** Bytes in a kilobyte / megabyte, for readable preset definitions. */
export const kb = (n: number) => n * 1024;
export const mb = (n: number) => n * 1024 * 1024;

/** Who is allowed to upload through a preset. */
export type UploadAccess =
  /** Any signed-in user. */
  | "user"
  /** Users with the CREATOR permission or full ADMIN access. */
  | "creator"
  /** Users with the ADMIN permission. */
  | "admin";

/** Output container for a processed image. `original` keeps the source format. */
export type ImageFormat = "webp" | "jpeg" | "png" | "avif" | "original";

export type ImageProcessing = {
  /**
   * Longest side, in pixels. The image is scaled down to fit, never up.
   * Set `maxWidth`/`maxHeight` instead when you need a non-square bound.
   */
  maxDimension?: number;
  maxWidth?: number;
  maxHeight?: number;
  /**
   * `inside` (default) fits within the bounds and preserves the whole image.
   * `cover` fills the bounds exactly and crops the overflow — only meaningful
   * when both width and height are given.
   */
  fit?: "inside" | "cover";
  /** Output format. Defaults to `webp`. */
  format?: ImageFormat;
  /** Starting quality, 1-100. Defaults to 82. */
  quality?: number;
  /**
   * Hard ceiling on the *encoded output* size. When set, quality is stepped
   * down (and, as a last resort, dimensions are halved) until the encoded
   * image fits. Without it, `quality` is used as-is.
   */
  maxOutputSize?: number;
  /** Floor for the quality back-off. Defaults to 40. */
  minQuality?: number;
  /**
   * Keep EXIF/ICC metadata. Off by default — EXIF carries GPS coordinates and
   * camera serials that have no business being on a public bucket.
   */
  keepMetadata?: boolean;
  /**
   * Skip processing for animated sources (GIF/animated WebP). On by default,
   * since a resize would flatten them to a single frame.
   */
  passThroughAnimated?: boolean;
};

/**
 * A named upload target. Every place in the app that accepts a file names one
 * of these; the preset — not the call site — decides the constraints, where
 * the object lands, and how images are processed.
 */
export type UploadPreset<TContext = Record<string, string>> = {
  /** Registry key, echoed back for logging and admin filtering. */
  name: string;
  /** Human label for the admin UI. */
  label: string;
  /** One-line explanation of where this preset is used. */
  description: string;
  /** Required permission level. Ownership checks live in `~/server/uploads/authorize`. */
  access: UploadAccess;
  /**
   * Accepted MIME types. Supports exact types (`application/pdf`) and wildcard
   * prefixes (`image/*`). Also drives the file input's `accept` attribute.
   */
  accept: string[];
  /** Largest single *source* file, in bytes. */
  maxFileSize: number;
  /** Most files in a single batch. */
  maxFiles: number;
  /** Largest combined *source* size for a single batch, in bytes. */
  maxTotalSize: number;
  /** Value written to `file_upload.for`. */
  for: string;
  /** Value written to `file_upload.forId`, derived from the upload context. */
  forId: (context: TContext) => string;
  /** S3 key prefix (no leading or trailing slash), derived from the context. */
  keyPrefix: (context: TContext) => string;
  /** Object ACL. Files served through `/api/media/[id]` can stay private. */
  acl: "private" | "public-read";
  /** Image processing rules. Omit to store images byte-for-byte. */
  image?: ImageProcessing;
};

/** The shape returned to the client once a file is stored. */
export type UploadedFile = {
  id: string;
  url: string;
  key: string;
  name: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  /** True when an identical source file already existed and was reused. */
  isDuplicate: boolean;
};
