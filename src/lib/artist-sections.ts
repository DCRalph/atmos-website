import type { ArtistBlockTypeName } from "~/components/artist/block-types";

/**
 * An artist profile below its hero is a list of full-width sections, one per
 * stored `ArtistBlock`, in the order the artist set in the profile builder.
 * Blocks are stored with grid coordinates from the old free-form editor; only
 * their top-to-bottom order (`y`, then `x`) is used now.
 *
 * `toSections` turns stored blocks into this resolved, render-ready union:
 * media ids become URLs (through `ctx.mediaUrl`, normally `buildMediaUrl`),
 * embed links are validated, and anything with nothing to show is dropped, so
 * the public page never renders an empty state.
 */
export type ProfileSection = { id: string } & (
  | { type: "HEADING"; text: string; level: 1 | 2 | 3 | 4; align: Align }
  | { type: "RICH_TEXT"; lexical: unknown }
  | { type: "IMAGE"; src: string; alt: string }
  | { type: "GALLERY"; srcs: string[] }
  | { type: "SOUNDCLOUD_TRACK" | "SOUNDCLOUD_PLAYLIST"; url: string }
  | { type: "YOUTUBE_VIDEO"; videoId: string }
  | { type: "SPOTIFY_EMBED"; src: string; tall: boolean }
  | { type: "SOCIAL_LINKS" }
  | { type: "LINK_LIST"; links: { label: string; url: string }[] }
  | { type: "GIG_LIST"; title: string }
  | {
      type: "PAST_GIGS";
      title: string;
      showRole: boolean;
      includeUpcoming: boolean;
    }
  | { type: "DIVIDER" }
  | { type: "SPACER" }
  | { type: "CUSTOM_EMBED"; url: string }
);

export type ProfileSectionType = ProfileSection["type"];
type Align = "left" | "center" | "right";

export type StoredBlock = {
  id: string;
  type: ArtistBlockTypeName;
  x: number;
  y: number;
  data: unknown;
};

/** What a profile has outside its blocks, which decides if some sections show. */
export type SectionContext = {
  socials: number;
  upcoming: number;
  past: number;
  mediaUrl: (fileId: string) => string;
};

export const DEFAULT_GIGS_TITLE = "Sets";
export const DEFAULT_PAST_TITLE = "Past sets";

/** A profile nobody has arranged yet still shows its Atmos history. */
const DEFAULT_SECTIONS: StoredBlock[] = [
  { id: "default-gigs", type: "GIG_LIST", x: 0, y: 0, data: {} },
  { id: "default-past", type: "PAST_GIGS", x: 0, y: 1, data: {} },
];

/** Stored blocks in page order. */
export const orderBlocks = <B extends Pick<StoredBlock, "x" | "y">>(
  blocks: readonly B[],
) => [...blocks].sort((a, b) => a.y - b.y || a.x - b.x);

export function toSections(
  blocks: readonly StoredBlock[],
  ctx: SectionContext,
): ProfileSection[] {
  const source = blocks.length ? orderBlocks(blocks) : DEFAULT_SECTIONS;
  return source.flatMap((b) => {
    const section = toSection(b, ctx);
    return section ? [section] : [];
  });
}

function toSection(
  block: StoredBlock,
  ctx: SectionContext,
): ProfileSection | null {
  const d =
    block.data && typeof block.data === "object"
      ? (block.data as Record<string, unknown>)
      : {};
  const str = (key: string) => (typeof d[key] === "string" ? d[key] : "");
  const id = block.id;

  switch (block.type) {
    case "HEADING": {
      const text = str("text").trim();
      const level = Number(d.level);
      const align = str("align");
      return text
        ? {
            id,
            type: "HEADING",
            text,
            level: level === 1 || level === 3 || level === 4 ? level : 2,
            align: align === "center" || align === "right" ? align : "left",
          }
        : null;
    }
    case "RICH_TEXT":
      return isLexical(d.lexical)
        ? { id, type: "RICH_TEXT", lexical: d.lexical }
        : null;
    case "IMAGE": {
      const fileId = str("fileId");
      return fileId
        ? { id, type: "IMAGE", src: ctx.mediaUrl(fileId), alt: str("alt") }
        : null;
    }
    case "GALLERY": {
      const ids = Array.isArray(d.fileIds)
        ? d.fileIds.filter(
            (v): v is string => typeof v === "string" && v.length > 0,
          )
        : [];
      return ids.length
        ? { id, type: "GALLERY", srcs: ids.map((f) => ctx.mediaUrl(f)) }
        : null;
    }
    case "SOUNDCLOUD_TRACK":
    case "SOUNDCLOUD_PLAYLIST": {
      const url = str("url").trim();
      return /^https:\/\/(www\.|on\.|m\.)?soundcloud\.com\//.test(url)
        ? { id, type: block.type, url }
        : null;
    }
    case "YOUTUBE_VIDEO": {
      const videoId = getYouTubeId(str("url"));
      return videoId ? { id, type: "YOUTUBE_VIDEO", videoId } : null;
    }
    case "SPOTIFY_EMBED": {
      const src = toSpotifyEmbedSrc(str("url"));
      return src
        ? { id, type: "SPOTIFY_EMBED", src, tall: !src.includes("/track/") }
        : null;
    }
    case "SOCIAL_LINKS":
      return ctx.socials ? { id, type: "SOCIAL_LINKS" } : null;
    case "LINK_LIST": {
      const links = Array.isArray(d.links)
        ? d.links.flatMap((l: unknown) => {
            if (!l || typeof l !== "object") return [];
            const { label, url } = l as Record<string, unknown>;
            return typeof url === "string" && /^https?:\/\//.test(url)
              ? [{ label: typeof label === "string" ? label : "", url }]
              : [];
          })
        : [];
      return links.length ? { id, type: "LINK_LIST", links } : null;
    }
    case "GIG_LIST":
      return ctx.upcoming
        ? {
            id,
            type: "GIG_LIST",
            title: typeof d.title === "string" ? d.title : DEFAULT_GIGS_TITLE,
          }
        : null;
    case "PAST_GIGS": {
      const includeUpcoming =
        d.includeUpcoming === true || d.includeUpcoming === "true";
      return ctx.past || (includeUpcoming && ctx.upcoming)
        ? {
            id,
            type: "PAST_GIGS",
            title: typeof d.title === "string" ? d.title : DEFAULT_PAST_TITLE,
            showRole: d.showRole !== false,
            includeUpcoming,
          }
        : null;
    }
    case "DIVIDER":
    case "SPACER":
      return { id, type: block.type };
    case "CUSTOM_EMBED": {
      const url = str("url").trim();
      return url.startsWith("https://")
        ? { id, type: "CUSTOM_EMBED", url }
        : null;
    }
    default:
      // CONTENT_LIST and anything else the page doesn't render.
      return null;
  }
}

const isLexical = (v: unknown) =>
  typeof v === "object" && v !== null && "root" in v;

export function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts")
        return parts[1] ?? null;
    }
  } catch {
    // not a URL
  }
  return null;
}

export function toSpotifyEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("spotify.com")) return null;
    if (u.pathname.startsWith("/embed/")) return u.toString();
    return `https://open.spotify.com/embed${u.pathname}`;
  } catch {
    return null;
  }
}

/**
 * The sections that title a part of the page, for in-page navigation (the
 * Stage layout's tabs). Headings use their text, gig sections their title.
 */
export function sectionTitle(section: ProfileSection): string | null {
  if (section.type === "HEADING") return section.text;
  if (section.type === "GIG_LIST" || section.type === "PAST_GIGS")
    return section.title.trim() || null;
  return null;
}
