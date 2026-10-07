/**
 * A web page as Will GPT reads it: the readable text, and the images on it as
 * absolute URLs it can hand to `uploads.importFromUrl`.
 *
 * Regex rather than a DOM parser, on purpose. This is for skimming a page,
 * not rendering one, and a page that defeats it still yields its meta tags.
 */

/** Roughly 3k tokens of body text; the tool output has its own, larger cap. */
const MAX_TEXT_CHARS = 12_000;
const MAX_IMAGES = 40;

export type WebPage = {
  title: string | null;
  description: string | null;
  /** The page's share image (`og:image`), which is usually the one wanted. */
  image: string | null;
  images: string[];
  text: string;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity, code: string) => {
      if (code.startsWith("#x") || code.startsWith("#X")) {
        return String.fromCodePoint(parseInt(code.slice(2), 16));
      }
      if (code.startsWith("#")) {
        return String.fromCodePoint(parseInt(code.slice(1), 10));
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
    },
  );
}

/** The content of a `<meta>` tag by its `property` or `name`, either attribute order. */
function metaContent(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (name?.toLowerCase() !== key) continue;
    const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (content) return decodeEntities(content).trim();
  }
  return null;
}

function absolute(src: string, base: string): string | null {
  try {
    const url = new URL(decodeEntities(src.trim()), base);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function readHtml(html: string, url: string): WebPage {
  const image =
    metaContent(html, "og:image") ?? metaContent(html, "twitter:image");

  const sources = [
    image,
    ...[...html.matchAll(/<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi)].map(
      (match) => match[1] ?? null,
    ),
  ];
  const images = [
    ...new Set(
      sources.flatMap((src) => {
        const resolved = src ? absolute(src, url) : null;
        return resolved ? [resolved] : [];
      }),
    ),
  ].slice(0, MAX_IMAGES);

  const text = decodeEntities(
    html
      .replace(
        /<(script|style|noscript|svg|template|title)\b[\s\S]*?<\/\1>/gi,
        " ",
      )
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const titleTag =
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() || null; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing -- an empty string should become null too
  const title = metaContent(html, "og:title") ?? titleTag;

  return {
    title: title ? decodeEntities(title) : null,
    description:
      metaContent(html, "og:description") ?? metaContent(html, "description"),
    image: image ? absolute(image, url) : null,
    images,
    text:
      text.length > MAX_TEXT_CHARS
        ? `${text.slice(0, MAX_TEXT_CHARS)}… [page text cut at ${MAX_TEXT_CHARS} characters]`
        : text,
  };
}
