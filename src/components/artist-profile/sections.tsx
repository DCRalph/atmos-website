"use client";

import {
  createContext,
  useContext,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "~/lib/utils";
import { LexicalContent } from "~/components/lexical";
import { SoundCloudPlayer } from "~/components/soundcloud-player";
import { YouTubePlayer } from "~/components/youtube-player";
import { Lightbox, useLightbox } from "~/components/site/overlays";
import { getBlockDef, type ArtistBlockTypeName } from "~/lib/artist-blocks";
import { GRID, rowsToPx, toTree, type GridNode } from "~/lib/artist-grid";
import type { ProfileSection } from "~/lib/artist-sections";
import { useProfileEditor } from "./editor/context";
import { LinkRows, Photo, socialMeta } from "./parts";
import type { PublicProfile } from "./types";

type Of<T extends ProfileSection["type"]> = Extract<
  ProfileSection,
  { type: T }
>;

/**
 * How a layout draws the two sections built from the artist's lineups. The
 * rest of the section types look the same in every layout.
 */
export type GigSectionRenderers = {
  upcoming: (props: {
    section: Of<"GIG_LIST">;
    profile: PublicProfile;
  }) => ReactNode;
  past: (props: {
    section: Of<"PAST_GIGS">;
    profile: PublicProfile;
  }) => ReactNode;
};

/** The DOM id of a section, for in-page links and the Stage tabs. */
export const sectionAnchor = (section: Pick<ProfileSection, "id">) =>
  `s-${section.id}`;

/**
 * Where a block sits. `full` blocks span the whole grid, so sections that
 * bleed to the page edge (carousels, sticky filters) may.
 */
const CellContext = createContext({ full: true });
export const useCell = () => useContext(CellContext);

/** Everything a section needs to draw itself. */
export type SectionProps = {
  profile: PublicProfile;
  gigs: GigSectionRenderers;
  accent: string;
  tone: "dark" | "light";
};

/**
 * The artist's grid, below a layout's hero. Public pages draw it as nested
 * stacks and rows (see `toTree`); in the page editor it's the editable grid.
 * `className` sets the layout's padding around it.
 */
export function ProfileSections({
  className,
  ...props
}: SectionProps & { className?: string }) {
  const editor = useProfileEditor();
  if (editor?.editing)
    return <div className={className}>{editor.renderGrid(props)}</div>;
  if (!props.profile.sections.length) return null;
  return (
    <div className={cn("flex flex-col", className)}>
      <Node node={toTree(props.profile.sections)} {...props} />
    </div>
  );
}

const nodeKey = (node: GridNode<ProfileSection>): string => {
  switch (node.kind) {
    case "block":
      return node.block.id;
    case "stack":
      return nodeKey(node.children[0]!);
    case "row":
      return nodeKey(node.children[0]!.node);
    case "free":
      return node.blocks[0]!.id;
  }
};

const gap = { gap: GRID.gap } satisfies CSSProperties;

/**
 * Whether a part holds a photo or embed. Only those grow to fill spare height
 * (beside a taller column), so text never gets a gap opened under it.
 */
const fills = (node: GridNode<ProfileSection>): boolean => {
  switch (node.kind) {
    case "block":
      return getBlockDef(node.block.type).sizing === "fill";
    case "stack":
      return node.children.some(fills);
    case "row":
      return node.children.some((c) => fills(c.node));
    case "free":
      return node.blocks.some((b) => getBlockDef(b.type).sizing === "fill");
  }
};

function Node({
  node,
  ...props
}: SectionProps & { node: GridNode<ProfileSection> }) {
  switch (node.kind) {
    case "block":
      return (
        <BlockCell section={node.block}>
          <Section section={node.block} {...props} />
        </BlockCell>
      );
    case "stack":
      return (
        <div className={cn("flex flex-col", fills(node) && "grow")} style={gap}>
          {node.children.map((child) => (
            <Node key={nodeKey(child)} node={child} {...props} />
          ))}
        </div>
      );
    case "row":
      return (
        <div
          className={cn(
            "flex flex-col md:grid md:grid-cols-[repeat(var(--n),minmax(0,1fr))]",
            fills(node) && "grow",
          )}
          style={{ ...gap, "--n": node.cols } as CSSProperties}
        >
          {node.children.map((child) => (
            <div
              key={nodeKey(child.node)}
              className="flex min-w-0 flex-col md:[grid-column:var(--x)/span_var(--w)]"
              style={{ "--x": child.x + 1, "--w": child.w } as CSSProperties}
            >
              <Node node={child.node} {...props} />
            </div>
          ))}
        </div>
      );
    case "free": {
      // Rows only where a block starts or ends, each as tall as its content
      // needs, so blocks keep their order without the editor's exact heights.
      // Rows have no gap of their own: each block carries one below it.
      const edges = [
        ...new Set(node.blocks.flatMap((b) => [b.y, b.y + b.h])),
      ].sort((a, b) => a - b);
      return (
        <div
          className={cn(
            "flex flex-col md:-mb-6 md:grid md:grid-cols-[repeat(var(--n),minmax(0,1fr))] md:grid-rows-[repeat(var(--rows),auto)] md:!gap-y-0",
            fills(node) && "grow",
          )}
          style={
            {
              ...gap,
              "--n": node.cols,
              "--rows": edges.length - 1,
            } as CSSProperties
          }
        >
          {node.blocks.map((block) => (
            <div
              key={block.id}
              className="flex min-w-0 flex-col md:mb-6 md:[grid-area:var(--r0)/var(--x)/var(--r1)/span_var(--w)]"
              style={
                {
                  "--x": block.x - node.x + 1,
                  "--w": block.w,
                  "--r0": edges.indexOf(block.y) + 1,
                  "--r1": edges.indexOf(block.y + block.h) + 1,
                } as CSSProperties
              }
            >
              <BlockCell section={block}>
                <Section section={block} {...props} />
              </BlockCell>
            </div>
          ))}
        </div>
      );
    }
  }
}

/**
 * One block's box: a size container (sections size their type to it), the
 * anchor for in-page links, and for photos and embeds the height the artist
 * gave it. Shared with the editor so a block looks the same in both.
 */
export function BlockCell({
  section,
  className,
  style,
  children,
}: {
  section: { id: string; type: ArtistBlockTypeName; w: number; h: number };
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const fill = getBlockDef(section.type).sizing === "fill";
  return (
    <CellContext.Provider value={{ full: section.w === GRID.cols }}>
      <div
        id={sectionAnchor(section)}
        className={cn(
          "@container relative min-w-0 scroll-mt-36",
          fill ? "flex min-h-[var(--fill)] grow flex-col" : "shrink-0",
          className,
        )}
        style={
          fill
            ? ({
                "--fill": `${rowsToPx(section.h)}px`,
                ...style,
              } as CSSProperties)
            : style
        }
      >
        {children}
      </div>
    </CellContext.Provider>
  );
}

/** One section's content. Photos and embeds fill their cell. */
export function Section({
  section,
  profile,
  gigs,
  accent,
  tone,
}: SectionProps & { section: ProfileSection }) {
  const sizes = `(min-width: 768px) ${Math.round((section.w / GRID.cols) * 100)}vw, 100vw`;
  switch (section.type) {
    case "HEADING":
      return <Heading section={section} />;
    case "RICH_TEXT":
      return (
        <div className="cp-prose max-w-[65ch]">
          <LexicalContent
            value={section.lexical}
            namespace={`artist-section-${section.id}`}
            contentClassName="break-words !whitespace-normal"
          />
        </div>
      );
    case "IMAGE":
      return (
        <Photo
          src={section.src}
          alt={section.alt}
          sizes={sizes}
          className="flex-1 rounded-[var(--cp-r-media)]"
        />
      );
    case "GALLERY":
      return <Gallery srcs={section.srcs} name={profile.name} />;
    case "SOUNDCLOUD_TRACK":
      return (
        <div className="overflow-hidden rounded-[var(--cp-r-media)]">
          <SoundCloudPlayer
            url={section.url}
            params={{ color: accent.replace("#", ""), visual: true }}
          />
        </div>
      );
    case "SOUNDCLOUD_PLAYLIST":
      return (
        <Frame
          title={`${profile.name} on SoundCloud`}
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(section.url)}&color=${accent.replace("#", "")}&visual=true`}
        />
      );
    case "YOUTUBE_VIDEO":
      return (
        <div className="overflow-hidden rounded-[var(--cp-r-media)]">
          <YouTubePlayer
            videoId={section.videoId}
            title={`${profile.name} video`}
          />
        </div>
      );
    case "SPOTIFY_EMBED":
      return (
        <iframe
          title={`${profile.name} on Spotify`}
          src={
            tone === "dark" ? withParam(section.src, "theme", "0") : section.src
          }
          height={section.tall ? 352 : 152}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="block w-full rounded-[12px]"
        />
      );
    case "SOCIAL_LINKS":
      return (
        <LinkRows
          links={profile.socials.map((s) => {
            const { name, handle } = socialMeta(s);
            return {
              label: name,
              detail: handle ? `@${handle}` : null,
              url: s.url,
            };
          })}
        />
      );
    case "LINK_LIST":
      return <LinkRows links={section.links} />;
    case "GIG_LIST":
      return gigs.upcoming({ section, profile });
    case "PAST_GIGS":
      return gigs.past({ section, profile });
    case "DIVIDER":
      return (
        <div className="flex h-4 items-center">
          <hr className="w-full border-[var(--cp-line)]" />
        </div>
      );
    case "SPACER":
      return <div aria-hidden className="flex-1" />;
    case "CUSTOM_EMBED":
      return <Frame title="Embedded content" src={section.url} />;
  }
}

/** An embed that fills its cell. */
function Frame({ title, src }: { title: string; src: string }) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-[var(--cp-r-media)] bg-[var(--cp-raised)]">
      <iframe
        title={title}
        src={src}
        allow="autoplay; encrypted-media; picture-in-picture"
        loading="lazy"
        className="absolute inset-0 block size-full"
      />
    </div>
  );
}

// Sized to the block, not the window, so a heading in a narrow column fits it.
const headingSizes = {
  1: "text-[clamp(2.25rem,12cqw,6rem)]",
  2: "text-[clamp(2rem,8cqw,4.75rem)]",
  3: "text-[clamp(1.6rem,5.5cqw,3rem)]",
  4: "text-[clamp(1.25rem,3.6cqw,2rem)]",
} as const;

function Heading({ section }: { section: Of<"HEADING"> }) {
  // The artist's level 1 is still a section heading: the page's h1 is their name.
  const Tag = section.level <= 2 ? "h2" : section.level === 3 ? "h3" : "h4";
  return (
    <Tag
      className={cn(
        "cp-display [overflow-wrap:anywhere]",
        headingSizes[section.level],
        section.align === "center" && "text-center",
        section.align === "right" && "text-right",
      )}
    >
      {section.text}
    </Tag>
  );
}

/** First photo large, the rest beside it; any photo opens the lightbox. */
function Gallery({ srcs, name }: { srcs: string[]; name: string }) {
  const lightbox = useLightbox();
  const images = srcs.map((src, i) => ({
    src,
    alt: `${name}, photo ${i + 1} of ${srcs.length}`,
  }));
  return (
    <>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4 @2xl:gap-3">
        {images.map((img, i) => (
          <button
            key={`${img.src}-${i}`}
            type="button"
            onClick={() => lightbox.open(i)}
            aria-label={`Open ${img.alt}`}
            className={cn(
              "group relative overflow-hidden rounded-[var(--cp-r-media)]",
              i === 0 && srcs.length > 2
                ? "col-span-2 aspect-[3/2] @2xl:row-span-2 @2xl:aspect-auto"
                : "aspect-[3/2]",
            )}
          >
            <Photo
              src={img.src}
              alt=""
              sizes={i === 0 ? "50vw" : "25vw"}
              className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>
      <Lightbox images={images} {...lightbox.props} />
    </>
  );
}

function withParam(src: string, key: string, value: string) {
  const url = new URL(src);
  url.searchParams.set(key, value);
  return url.toString();
}
