import sharp from "sharp";

export type WebPCompressionOptions = {
  maxSizePx?: number;
  quality?: number; // 1-100
};

// Resize so that the larger side <= maxSizePx, preserve aspect ratio, then convert to WebP
export const toWebPMax = async (
  input: Buffer,
  opts: WebPCompressionOptions = {},
) => {
  const maxSize = opts.maxSizePx ?? 1024;
  const quality = opts.quality ?? 80;

  const image = sharp(input, { failOnError: false });
  const metadata = await image.metadata();

  let width = metadata.width || maxSize;
  let height = metadata.height || maxSize;

  // Compute target size so that longer side = maxSize, aspect preserved
  if (width >= height) {
    if (width > maxSize) {
      const ratio = maxSize / width;
      width = maxSize;
      height = Math.round(height * ratio);
    }
  } else {
    if (height > maxSize) {
      const ratio = maxSize / height;
      height = maxSize;
      width = Math.round(width * ratio);
    }
  }

  // Use sharp to resize and convert to webp
  const output = await image
    .resize({ width, height, fit: "cover", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  return {
    buffer: output,
    contentType: "image/webp",
    width,
    height,
  };
};
