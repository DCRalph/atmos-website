/**
 * How an event's wallet pass looks.
 *
 * Deliberately not `server-only`: the admin form renders its preview from the
 * very same `stripSvg` the pass builder rasterises, so what an organiser picks
 * is what lands in the wallet. Two implementations of this would drift within a
 * week.
 */

/** Bands drawn from the theme's colours alone. */
export const PASS_STRIP_STYLES = [
  "HATCH",
  "GRADIENT",
  "SOLID",
  "BARS",
  "NONE",
] as const;

/**
 * Every band, including one cut from an uploaded photo. Kept apart from
 * {@link PASS_STRIP_STYLES} because a photo needs an image to go with it, which
 * only a pass design (see `./pass-design.ts`) carries.
 */
export const PASS_BAND_STYLES = [
  "HATCH",
  "GRADIENT",
  "SOLID",
  "BARS",
  "PHOTO",
  "NONE",
] as const;

export type PassStripStyle = (typeof PASS_BAND_STYLES)[number];

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
  PHOTO: {
    label: "Photo",
    description: "An uploaded photo, cropped to fill the band.",
  },
  NONE: {
    label: "None",
    description: "No band at all — the title sits on the background.",
  },
};

/**
 * The layouts a ticket can be built in.
 *
 * Adding one is an entry here, a branch in `getPassImages` for its artwork, a
 * branch in the pass builder for its keys and a branch in the admin preview.
 * Everything else, the colours, the logo, the back, the links, is shared.
 */
export const PASS_LAYOUTS = ["BAND", "BLUR", "POSTER"] as const;
export type PassLayout = (typeof PASS_LAYOUTS)[number];

export const PASS_LAYOUT_INFO: Record<
  PassLayout,
  {
    label: string;
    description: string;
    /** Built from the portrait artwork; without one it falls back to the band. */
    needsPoster: boolean;
  }
> = {
  BAND: {
    label: "Band",
    description: "A band across the top with the event name on it. Every iOS.",
    needsPoster: false,
  },
  BLUR: {
    label: "Blur",
    description:
      "The poster blurred behind the pass and sharp beside the title. Every iOS.",
    needsPoster: true,
  },
  POSTER: {
    label: "Poster",
    description:
      "Full artwork with the name over it, plus the event guide. iOS 18; older phones get the band.",
    needsPoster: true,
  },
};

/**
 * The event guide buttons Wallet draws from URLs on a poster pass, in the
 * order they are offered. On the other layouts the same links go on the back.
 */
export const PASS_GUIDE_LINKS = [
  { key: "parkingUrl", label: "Parking", passKey: "parkingInformationURL" },
  { key: "transitUrl", label: "Transit", passKey: "transitInformationURL" },
  { key: "foodUrl", label: "Food", passKey: "orderFoodURL" },
  { key: "bagPolicyUrl", label: "Bag policy", passKey: "bagPolicyURL" },
  {
    key: "accessibilityUrl",
    label: "Accessibility",
    passKey: "accessibilityURL",
  },
  { key: "addOnsUrl", label: "Add-ons", passKey: "addOnURL" },
  { key: "merchUrl", label: "Merch", passKey: "merchandiseURL" },
] as const;
export type PassGuideLinkKey = (typeof PASS_GUIDE_LINKS)[number]["key"];

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
  /**
   * How far a `PHOTO` band is darkened, 0–1, so the name and chip on it stay
   * readable. Ignored by every other style.
   */
  stripDim?: number;
};

/** Atmos house style, used wherever an event has not overridden something. */
export const DEFAULT_PASS_THEME: PassTheme = {
  stripStyle: "HATCH",
  accentHex: "#470082",
  backgroundHex: "#0B0B0C",
  foregroundHex: "#FFFFFF",
  labelHex: "#A0A0AA",
};

/**
 * The lifetime pass, which no event theme touches.
 *
 * Gold bars on black, so it reads as a different object from every event
 * ticket in the same wallet — those run the event's own theme, purple hatch by
 * default. The band carries the holder's name rather than an event, because
 * there is no event: this pass is for all of them.
 */
export const LIFETIME_PASS_THEME: PassTheme = {
  stripStyle: "BARS",
  accentHex: "#C9A227",
  backgroundHex: "#0B0B0C",
  foregroundHex: "#FFFFFF",
  labelHex: "#C9A227",
};

/** `#abc` and `#aabbcc`, the two forms the colour inputs can produce. */
export const HEX_COLOUR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColour(value: string): boolean {
  return HEX_COLOUR_PATTERN.test(value);
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

      // The photo itself is laid underneath by whoever draws this — an <img>
      // in the browser, a sharp composite on the server — so the band is only
      // the shade over it.
      case "PHOTO": {
        const dim = Math.min(1, Math.max(0, theme.stripDim ?? 0));
        return `<rect width="${width}" height="${height}" fill="#000000" fill-opacity="${dim.toFixed(3)}"/>`;
      }

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
 * The band's own margins, as fractions of its size.
 *
 * One set of numbers for the chip and the title, because the whole point is
 * that they cannot reach each other.
 */
const STRIP_PAD_X = 0.043;
const STRIP_PAD_Y = 0.11;
const STRIP_GAP = 0.032;

/**
 * The room left for the event name once the chip has taken its lane.
 *
 * Wallet draws a primary field across the whole width of the strip, which on a
 * pass that also carries a chip means the name runs straight under it — the
 * longer the event's name, the worse it reads. So on those passes the name is
 * typeset into the artwork here instead, inside this box, and the primary field
 * is left out. Two things sharing one band have to be laid out together or they
 * will not stay apart.
 */
export function stripTitleBox(
  width: number,
  height: number,
  badge: StripBadge | null,
) {
  const padX = Math.round(width * STRIP_PAD_X);
  const padY = Math.round(height * STRIP_PAD_Y);
  const right = badge
    ? badgeBox(badge.text, width, height).x - Math.round(width * STRIP_GAP)
    : width - padX;

  return {
    x: padX,
    y: padY,
    width: Math.max(0, right - padX),
    height: height - padY * 2,
  };
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
