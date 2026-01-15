/**
 * Convert a hex color to HSV.
 *
 * - Accepts `#RRGGBB`, `RRGGBB`, `#RGB`, or `RGB`
 * - Returns: `h` in degrees [0, 360), `s` and `v` as fractions [0, 1]
 */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const cleaned = hex.trim().replace(/^#/, "");

  const normalized =
    cleaned.length === 3
      ? cleaned
        .split("")
        .map((c) => c + c)
        .join("")
      : cleaned;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return { h: 0, s: 0, v: 0 };
  }

  const r255 = parseInt(normalized.slice(0, 2), 16);
  const g255 = parseInt(normalized.slice(2, 4), 16);
  const b255 = parseInt(normalized.slice(4, 6), 16);

  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
}