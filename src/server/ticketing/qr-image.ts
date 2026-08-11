import "server-only";

import QRCode from "qrcode";

/**
 * QR rendering.
 *
 * Error correction is deliberately "M" rather than the maximum: the payload is
 * short, and a lower correction level means fewer modules, which means bigger
 * squares on a cracked phone screen at the door. Margin stays at the spec
 * minimum of 4 modules — scanners need the quiet zone.
 */

const BASE_OPTIONS = {
  errorCorrectionLevel: "M",
  margin: 4,
  color: { dark: "#000000", light: "#FFFFFF" },
} as const;

/** PNG bytes, for email attachments and wallet passes. */
export async function renderQrPng(
  token: string,
  { width = 600 }: { width?: number } = {},
): Promise<Buffer> {
  return QRCode.toBuffer(token, { ...BASE_OPTIONS, type: "png", width });
}

/** `data:image/png;base64,...` for rendering straight into a page. */
export async function renderQrDataUrl(
  token: string,
  { width = 600 }: { width?: number } = {},
): Promise<string> {
  return QRCode.toDataURL(token, { ...BASE_OPTIONS, width });
}

/**
 * SVG string. Used on the web ticket page so the code stays razor sharp when
 * someone zooms in, and scales with the viewport without a blurry upscale.
 */
export async function renderQrSvg(token: string): Promise<string> {
  return QRCode.toString(token, { ...BASE_OPTIONS, type: "svg" });
}
