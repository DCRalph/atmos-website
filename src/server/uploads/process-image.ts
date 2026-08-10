import "server-only";

import sharp from "sharp";
import type { ImageFormat, ImageProcessing } from "~/lib/uploads/types";

/**
 * The one image pipeline: resize to the preset's dimension bounds, convert to
 * the preset's format, and — when the preset sets `maxOutputSize` — step
 * quality (then dimensions) down until the encoded result actually fits.
 */

export type ProcessedImage = {
  buffer: Buffer;
  contentType: string;
  /** File extension for the output, without the dot. */
  extension: string;
  width: number | null;
  height: number | null;
  /** False when the source was passed through untouched. */
  processed: boolean;
};

const CONTENT_TYPES: Record<Exclude<ImageFormat, "original">, string> = {
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
};

const EXTENSIONS: Record<Exclude<ImageFormat, "original">, string> = {
  webp: "webp",
  jpeg: "jpg",
  png: "png",
  avif: "avif",
};

/** Formats sharp can decode. Anything else is stored as-is. */
const PROCESSABLE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/tiff",
  "image/heic",
  "image/heif",
]);

/** Quality ladder used when an output size ceiling has to be met. */
const QUALITY_STEPS = [-12, -12, -12, -10, -10];

export const canProcessImage = (mimeType: string): boolean =>
  PROCESSABLE.has(mimeType.toLowerCase());

/**
 * Reads the pixel dimensions of an image without re-encoding it. Used for
 * files that are stored untouched but still deserve width/height in the DB.
 */
export const readImageDimensions = async (
  buffer: Buffer,
): Promise<{ width: number | null; height: number | null }> => {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
};

export const processImage = async (
  input: Buffer,
  options: ImageProcessing,
  sourceMimeType: string,
  sourceExtension: string,
): Promise<ProcessedImage> => {
  const passThrough = async (reason?: string): Promise<ProcessedImage> => {
    void reason;
    const { width, height } = await readImageDimensions(input);
    return {
      buffer: input,
      contentType: sourceMimeType,
      extension: sourceExtension || "bin",
      width,
      height,
      processed: false,
    };
  };

  if (!canProcessImage(sourceMimeType)) return passThrough("unsupported format");

  const image = sharp(input, { failOn: "none" });
  const metadata = await image.metadata();

  // Animated sources would be flattened to their first frame by a resize, so
  // by default they are stored exactly as uploaded.
  const isAnimated = (metadata.pages ?? 1) > 1;
  if (isAnimated && options.passThroughAnimated !== false) {
    return passThrough("animated");
  }

  const format = options.format ?? "webp";
  const target = resolveTargetFormat(format, metadata.format);
  const contentType = CONTENT_TYPES[target];
  const extension = EXTENSIONS[target];

  const maxWidth = options.maxWidth ?? options.maxDimension;
  const maxHeight = options.maxHeight ?? options.maxDimension;
  const startQuality = clampQuality(options.quality ?? 82);
  const minQuality = clampQuality(options.minQuality ?? 40);

  const encode = async (scale: number, quality: number): Promise<Buffer> => {
    let pipeline = sharp(input, { failOn: "none" })
      // Apply EXIF orientation before the metadata is dropped.
      .rotate();

    const width = maxWidth ? Math.max(1, Math.round(maxWidth * scale)) : undefined;
    const height = maxHeight
      ? Math.max(1, Math.round(maxHeight * scale))
      : undefined;

    if (width ?? height) {
      pipeline = pipeline.resize({
        width,
        height,
        fit: options.fit ?? "inside",
        withoutEnlargement: true,
      });
    }

    // sharp strips EXIF/ICC unless asked to keep it, which is what we want by
    // default: uploaded photos routinely carry GPS coordinates.
    if (options.keepMetadata) pipeline = pipeline.withMetadata();

    switch (target) {
      case "webp":
        pipeline = pipeline.webp({ quality });
        break;
      case "jpeg":
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case "avif":
        pipeline = pipeline.avif({ quality });
        break;
      case "png":
        // PNG is lossless; `quality` only takes effect via palette quantisation.
        pipeline = pipeline.png({
          compressionLevel: 9,
          palette: quality < 100,
          quality,
        });
        break;
    }

    return pipeline.toBuffer();
  };

  let output = await encode(1, startQuality);

  const ceiling = options.maxOutputSize;
  if (ceiling && output.length > ceiling) {
    // First try to stay at full resolution and give up quality.
    let quality = startQuality;
    for (const step of QUALITY_STEPS) {
      if (output.length <= ceiling || quality <= minQuality) break;
      quality = clampQuality(Math.max(minQuality, quality + step));
      output = await encode(1, quality);
    }

    // Still too big: shrink the image itself rather than store something that
    // blows past the preset's ceiling.
    let scale = 1;
    while (output.length > ceiling && scale > 0.25) {
      scale *= 0.75;
      output = await encode(scale, quality);
    }
  }

  const outMeta = await sharp(output, { failOn: "none" }).metadata();

  return {
    buffer: output,
    contentType,
    extension,
    width: outMeta.width ?? null,
    height: outMeta.height ?? null,
    processed: true,
  };
};

const resolveTargetFormat = (
  format: ImageFormat,
  sourceFormat: string | undefined,
): Exclude<ImageFormat, "original"> => {
  if (format !== "original") return format;
  switch (sourceFormat) {
    case "jpeg":
    case "jpg":
      return "jpeg";
    case "png":
      return "png";
    case "avif":
      return "avif";
    default:
      return "webp";
  }
};

const clampQuality = (q: number) => Math.min(100, Math.max(1, Math.round(q)));
