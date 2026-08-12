/**
 * How an event's wallet pass looks.
 *
 * Deliberately not `server-only`: the admin form renders its preview from the
 * very same `stripSvg` the pass builder rasterises, so what an organiser picks
 * is what lands in the wallet. Two implementations of this would drift within a
 * week.
 */

export const PASS_STRIP_STYLES = [
  "HATCH",
  "GRADIENT",
  "SOLID",
  "BARS",
  "NONE",
] as const;

export type PassStripStyle = (typeof PASS_STRIP_STYLES)[number];

export const PASS_STRIP_STYLE_LABELS: Record<
  PassStripStyle,
  { label: string; description: string }
> = {
  HATCH: {
    label: "Hatch",
    description: "Diagonal cut with the accent bleeding in. The Atmos default.",
  },
  GRADIENT: {
    label: "Gradient",
    description: "A clean wash from the background into the accent.",
  },
  SOLID: {
    label: "Solid",
    description: "A flat band of the accent colour.",
  },
  BARS: {
    label: "Bars",
    description: "Hard vertical bars stepping into the accent.",
  },
  NONE: {
    label: "None",
    description: "No band at all — the title sits on the background.",
  },
};

export type PassTheme = {
  stripStyle: PassStripStyle;
  /** The colour the band builds toward. */
  accentHex: string;
  /** The pass ground. */
  backgroundHex: string;
  /** Field values. */
  foregroundHex: string;
  /** Field labels — the small uppercase text above each value. */
  labelHex: string;
};

/** Atmos house style, used wherever an event has not overridden something. */
export const DEFAULT_PASS_THEME: PassTheme = {
  stripStyle: "HATCH",
  accentHex: "#470082",
  backgroundHex: "#0B0B0C",
  foregroundHex: "#FFFFFF",
  labelHex: "#A0A0AA",
};

/** `#abc` and `#aabbcc`, the two forms the colour inputs can produce. */
export const HEX_COLOUR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColour(value: string): boolean {
  return HEX_COLOUR_PATTERN.test(value);
}

export type PassThemeFields = {
  passStripStyle?: string | null;
  passAccentHex?: string | null;
  passBackgroundHex?: string | null;
  passForegroundHex?: string | null;
  passLabelHex?: string | null;
};

function colour(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  return isHexColour(value) ? value : fallback;
}

/**
 * An event's stored columns, resolved into a complete theme.
 *
 * Every field falls back independently, so an event that only sets an accent
 * still gets the house background and type colours — and a value that somehow
 * got into the database malformed degrades to the default rather than emitting
 * broken SVG.
 */
export function resolvePassTheme(event: PassThemeFields | null): PassTheme {
  if (!event) return DEFAULT_PASS_THEME;

  const style = PASS_STRIP_STYLES.includes(
    event.passStripStyle as PassStripStyle,
  )
    ? (event.passStripStyle as PassStripStyle)
    : DEFAULT_PASS_THEME.stripStyle;

  return {
    stripStyle: style,
    accentHex: colour(event.passAccentHex, DEFAULT_PASS_THEME.accentHex),
    backgroundHex: colour(
      event.passBackgroundHex,
      DEFAULT_PASS_THEME.backgroundHex,
    ),
    foregroundHex: colour(
      event.passForegroundHex,
      DEFAULT_PASS_THEME.foregroundHex,
    ),
    labelHex: colour(event.passLabelHex, DEFAULT_PASS_THEME.labelHex),
  };
}

/** `rgb(r, g, b)` — the only colour form Apple accepts in `pass.json`. */
export function toPassRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = Number.parseInt(full, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/**
 * The band behind the event name.
 *
 * Drawn at whatever size is asked for so the same source serves a 3x strip and
 * a small preview. Kept as a string rather than JSX because the server side
 * hands it to sharp, which wants markup.
 */
/**
 * The access-level chip drawn onto the band.
 *
 * Wallet has no per-field background, so a level that needs to stand out has to
 * be part of the artwork. Drawn here rather than added as another field, which
 * is also what keeps the level to exactly one place on the pass.
 */
export type StripBadge = {
  /** Short form — `AAA`, `VIP`. A label would crowd the band. */
  text: string;
  /** The chip fill. The level's own colour. */
  background: string;
  /** Text on the chip. */
  foreground: string;
};

export function stripSvg(
  theme: PassTheme,
  width: number,
  height: number,
  /**
   * How far the accent floods the band, 0 (the event's own balance) to 1 (all
   * colour). Driven by a ticket's access level, so a better ticket is a louder
   * pass without the organiser having to design one per tier.
   */
  intensity = 0,
  badge: StripBadge | null = null,
  /**
   * Draw the chip's text as SVG. True in the browser, where fonts exist. The
   * server passes false and composites the text as a raster instead, because a
   * serverless image has no fonts and `<text>` comes out as tofu.
   */
  withBadgeText = true,
): string {
  const { accentHex: accent, backgroundHex: ground } = theme;
  const clamped = Math.min(1, Math.max(0, intensity));
  // Rules top and bottom echo the site's 2px borders, scaled to the band.
  const rule = Math.max(2, Math.round(height * 0.02));
  const edges = `
    <rect x="0" y="0" width="${width}" height="${rule}" fill="#ffffff" fill-opacity="0.22"/>
    <rect x="0" y="${height - rule}" width="${width}" height="${rule}" fill="#ffffff" fill-opacity="0.22"/>`;

  const body = (() => {
    switch (theme.stripStyle) {
      case "SOLID":
        return `<rect width="${width}" height="${height}" fill="${accent}"/>`;

      case "GRADIENT": {
        // The ground holds until `start`, so more intensity means the accent
        // begins further left and the band reads as more saturated.
        const start = Math.round(30 * (1 - clamped));
        return `
          <defs>
            <linearGradient id="wash" x1="0" y1="0" x2="1" y2="0">
              <stop offset="${start}%" stop-color="${ground}"/>
              <stop offset="100%" stop-color="${accent}"/>
            </linearGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#wash)"/>`;
      }

      case "BARS": {
        // Six bars stepping from ground to accent, hard-edged.
        const count = 6;
        const barWidth = width / count;
        const bars = Array.from({ length: count }, (_, i) => {
          const t = i / (count - 1);
          return `<rect x="${(i * barWidth).toFixed(2)}" y="0" width="${(barWidth + 1).toFixed(2)}" height="${height}" fill="${accent}" fill-opacity="${t.toFixed(3)}"/>`;
        }).join("");
        return `<rect width="${width}" height="${height}" fill="${ground}"/>${bars}`;
      }

      case "NONE":
        return `<rect width="${width}" height="${height}" fill="${ground}"/>`;

      case "HATCH":
      default: {
        const pitch = Math.max(8, Math.round(height * 0.095));
        // 55% of ground at rest, down to 10% when the access level is maximal.
        const hold = Math.round(55 - 45 * clamped);
        return `
          <defs>
            <linearGradient id="wash" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="${ground}"/>
              <stop offset="${hold}%" stop-color="${ground}"/>
              <stop offset="100%" stop-color="${accent}"/>
            </linearGradient>
            <pattern id="hatch" width="${pitch}" height="${pitch}"
                     patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
              <rect width="${pitch}" height="${pitch}" fill="none"/>
              <line x1="0" y1="0" x2="0" y2="${pitch}" stroke="#ffffff"
                    stroke-opacity="0.07" stroke-width="${Math.round(pitch * 0.36)}"/>
            </pattern>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#wash)"/>
          <rect width="${width}" height="${height}" fill="url(#hatch)"/>`;
      }
    }
  })();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}${theme.stripStyle === "NONE" ? "" : edges}${badgeSvg(badge, width, height, withBadgeText)}</svg>`;
}

/**
 * Where the chip sits, so the server can drop rasterised text onto it.
 *
 * Width is estimated from the character count — there is no text metrics API
 * here, and 0.62em per character is close enough for bold sans at these sizes
 * that the padding absorbs the error.
 */
export function badgeBox(text: string, width: number, height: number) {
  const fontSize = Math.round(height * 0.2);
  const padX = Math.round(fontSize * 0.75);
  const boxHeight = Math.round(fontSize * 1.9);
  const boxWidth = Math.round(
    text.length * fontSize * 0.62 + padX * 2 + fontSize * 0.35,
  );
  const margin = Math.round(height * 0.14);
  return {
    x: width - boxWidth - margin,
    y: Math.round((height - boxHeight) / 2),
    width: boxWidth,
    height: boxHeight,
    fontSize,
  };
}

/**
 * The chip, right-aligned on the band.
 *
 * Wallet draws the event name over the left of the strip, so the right is the
 * only safe place for this. Width is estimated from the character count —
 * there is no text metrics API here, and 0.62em per character is close enough
 * for bold Helvetica at these sizes that the padding absorbs the error.
 */
function badgeSvg(
  badge: StripBadge | null,
  width: number,
  height: number,
  withText: boolean,
): string {
  if (!badge) return "";

  const box = badgeBox(badge.text, width, height);
  const chip = `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${badge.background}"/>`;
  if (!withText) return chip;

  return `
    <g>
      ${chip}
      <text x="${box.x + box.width / 2}" y="${box.y + box.height / 2}"
            font-family="Helvetica,Arial,sans-serif" font-size="${box.fontSize}"
            font-weight="700" letter-spacing="${(box.fontSize * 0.14).toFixed(2)}"
            fill="${badge.foreground}" text-anchor="middle"
            dominant-baseline="central">${badge.text}</text>
    </g>`;
}
