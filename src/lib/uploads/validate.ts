/**
 * Validation shared by the browser and the server.
 *
 * The browser runs this to give instant feedback and to avoid starting an
 * upload that is going to be rejected. The server runs the exact same checks
 * again against the real bytes — the client-side pass is a convenience, never
 * the enforcement point.
 */
import type { PresetConstraints } from "./presets";

export const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  // Whole numbers for bytes/KB, one decimal above that.
  const rounded = i <= 1 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[i]}`;
};

/** Extensions we can fall back on when a browser hands us an empty `file.type`. */
const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  pdf: "application/pdf",
};

export const extensionOf = (fileName: string): string => {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) return "";
  return fileName.slice(dot + 1).toLowerCase();
};

/**
 * Best-effort MIME type for a file. Browsers leave `type` empty for formats
 * they do not recognise, which would otherwise fail every accept check.
 */
export const resolveMimeType = (fileName: string, declaredType?: string) => {
  if (declaredType) return declaredType.toLowerCase();
  return EXTENSION_MIME[extensionOf(fileName)] ?? "application/octet-stream";
};

/** Matches exact types (`application/pdf`) and wildcards (`image/*`). */
export const matchesAccept = (mimeType: string, accept: string[]): boolean => {
  const type = mimeType.toLowerCase();
  return accept.some((pattern) => {
    const p = pattern.toLowerCase();
    if (p === "*/*") return true;
    if (p.endsWith("/*")) return type.startsWith(p.slice(0, -1));
    return type === p;
  });
};

/** Value for an `<input type="file" accept>` attribute. */
export const acceptAttribute = (accept: string[]): string => accept.join(",");

/** Short, readable list of accepted formats: "JPEG, PNG, WebP, MP4". */
export const describeAcceptedTypes = (accept: string[]): string => {
  const labels = accept.map((pattern) => {
    if (pattern.endsWith("/*")) return `any ${pattern.slice(0, -2)}`;
    const sub = pattern.split("/")[1] ?? pattern;
    return sub.replace("svg+xml", "svg").replace("quicktime", "mov").toUpperCase();
  });
  return [...new Set(labels)].join(", ");
};

/** Helper text for an upload control, e.g. "JPEG, PNG, WebP · up to 25 MB". */
export const describeConstraints = (c: PresetConstraints): string => {
  const parts = [
    describeAcceptedTypes(c.accept),
    `up to ${formatBytes(c.maxFileSize)}`,
  ];
  if (c.maxFiles > 1) {
    parts.push(`${c.maxFiles} files max (${formatBytes(c.maxTotalSize)} total)`);
  }
  if (c.image?.maxDimension) {
    parts.push(`resized to ${c.image.maxDimension}px`);
  }
  if (c.image?.format && c.image.format !== "original") {
    parts.push(`converted to ${c.image.format.toUpperCase()}`);
  }
  return parts.join(" · ");
};

export type FileLike = { name: string; size: number; type: string };

/** Checks one file. Returns a human-readable reason, or null when it passes. */
export const validateFile = (
  file: FileLike,
  c: PresetConstraints,
): string | null => {
  if (file.size === 0) return "File is empty";
  const mimeType = resolveMimeType(file.name, file.type);
  if (!matchesAccept(mimeType, c.accept)) {
    return `${describeAcceptedTypes(c.accept)} only — "${file.name}" is ${mimeType}`;
  }
  if (file.size > c.maxFileSize) {
    return `"${file.name}" is ${formatBytes(file.size)}, over the ${formatBytes(c.maxFileSize)} limit`;
  }
  return null;
};

export type BatchValidation<T extends FileLike = FileLike> = {
  /** Files that passed, in input order. */
  accepted: T[];
  /** One entry per rejected file, with the reason. */
  rejected: { file: T; reason: string }[];
};

/**
 * Checks a whole batch: per-file rules first, then the count and total-size
 * ceilings. Files over the batch limits are rejected rather than silently
 * dropped, so the UI can say exactly what happened.
 */
export const validateBatch = <T extends FileLike>(
  files: T[],
  c: PresetConstraints,
  /** Files already queued or stored, counted against `maxFiles`/`maxTotalSize`. */
  existing: { count: number; size: number } = { count: 0, size: 0 },
): BatchValidation<T> => {
  const accepted: T[] = [];
  const rejected: { file: T; reason: string }[] = [];

  let count = existing.count;
  let total = existing.size;

  for (const file of files) {
    const reason = validateFile(file, c);
    if (reason) {
      rejected.push({ file, reason });
      continue;
    }
    if (count + 1 > c.maxFiles) {
      rejected.push({
        file,
        reason: `Only ${c.maxFiles} file${c.maxFiles === 1 ? "" : "s"} allowed`,
      });
      continue;
    }
    if (total + file.size > c.maxTotalSize) {
      rejected.push({
        file,
        reason: `Total upload would exceed ${formatBytes(c.maxTotalSize)}`,
      });
      continue;
    }
    accepted.push(file);
    count += 1;
    total += file.size;
  }

  return { accepted, rejected };
};
