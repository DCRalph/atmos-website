"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AlignLeft,
  ArrowRight,
  ArrowUpRight,
  Code,
  Disc3,
  Image as ImageIcon,
  Images,
  Link as LinkIcon,
  Share2,
  type LucideIcon,
} from "lucide-react";
import type { IconType } from "react-icons";
import {
  FaApple,
  FaBandcamp,
  FaSoundcloud,
  FaSpotify,
  FaYoutube,
} from "react-icons/fa6";
import { cn } from "~/lib/utils";
import { LexicalContent } from "~/components/lexical";
import { SoundCloudPlayer } from "~/components/soundcloud-player";
import { YouTubePlayer } from "~/components/youtube-player";
import { Lightbox, useLightbox } from "~/components/site/overlays";
import {
  defaultTileLabel,
  getBlockDef,
  type ArtistBlockTypeName,
} from "~/lib/artist-blocks";
import { GRID, rowsToPx, toTree, type GridNode } from "~/lib/artist-grid";
import type { ProfileSection } from "~/lib/artist-sections";
import { useProfileEditor } from "./editor/context";
import { Photo, Pill, Poster, pill, socialMeta } from "./parts";
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
  const banner = props.profile.banner ?? props.profile.portrait;
  const ambient = (
    <div
      aria-hidden
      className="cp-ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1400px] overflow-hidden"
      style={
        banner ? ({ "--cp-banner": `url("${banner}")` } as CSSProperties) : {}
      }
    />
  );
  if (editor?.editing)
    return (
      <div className={cn("relative isolate", className)}>
        {ambient}
        {editor.renderGrid(props)}
      </div>
    );
  if (!props.profile.sections.length) return null;
  return (
    <div className={cn("relative isolate flex flex-col", className)}>
      {ambient}
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

// The grid's gap: 24 on wider screens (`GRID.gap`, which the editor draws
// with), 20 on phones.
const gap = "gap-5 md:gap-6";

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
        <div className={cn("flex flex-col", gap, fills(node) && "grow")}>
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
            gap,
            fills(node) && "grow",
          )}
          style={{ "--n": node.cols } as CSSProperties}
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
            gap,
            fills(node) && "grow",
          )}
          style={
            {
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
  );
}

const LABEL_ICONS: Partial<Record<ArtistBlockTypeName, LucideIcon | IconType>> =
  {
    RICH_TEXT: AlignLeft,
    IMAGE: ImageIcon,
    GALLERY: Images,
    SOUNDCLOUD_TRACK: FaSoundcloud,
    SOUNDCLOUD_PLAYLIST: FaSoundcloud,
    SPOTIFY_EMBED: FaSpotify,
    YOUTUBE_VIDEO: FaYoutube,
    RELEASE: Disc3,
    SOCIAL_LINKS: Share2,
    LINK_LIST: LinkIcon,
    CUSTOM_EMBED: Code,
  };

/**
 * A block's tile (see `cp-tile`): its label (the artist's own, or the type's
 * default) and an optional action on one line, then the content.
 */
function Tile({
  section,
  url,
  action,
  className,
  children,
}: {
  section: ProfileSection;
  /** For the default label of an embed (its site's name). */
  url?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const label = section.label ?? defaultTileLabel(section.type, url);
  const Icon = LABEL_ICONS[section.type];
  return (
    <div className={cn("cp-tile flex flex-col", className)}>
      {label || action ? (
        <div className="mb-4 flex min-h-4 items-center justify-between gap-4">
          {label ? (
            <span className="t-label cp-tag text-[11px]">
              {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
              <span className="truncate">{label}</span>
            </span>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** "Open" and friends: a quiet link out, in a tile's label row. */
function OpenLink({
  href,
  children = "Open",
}: {
  href: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="t-label inline-flex shrink-0 items-center gap-1.5 text-[10px] text-[var(--cp-faint)] transition-colors hover:text-[var(--cp-ink)]"
    >
      {children}
      <ArrowUpRight className="size-3.5" />
    </a>
  );
}

const media = "cp-media overflow-hidden rounded-[var(--cp-r-media)]";

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
        <Tile section={section}>
          <FoldText>
            <div className="cp-prose max-w-[65ch]">
              <LexicalContent
                value={section.lexical}
                namespace={`artist-section-${section.id}`}
                contentClassName="break-words !whitespace-normal"
              />
            </div>
          </FoldText>
        </Tile>
      );
    case "IMAGE":
      return (
        <Tile section={section} className="flex-1">
          <Photo
            src={section.src}
            alt={section.alt}
            sizes={sizes}
            className={cn(media, "min-h-24 flex-1")}
          />
        </Tile>
      );
    case "GALLERY":
      return (
        <Tile
          section={section}
          action={
            <span className="t-label text-[10px] text-[var(--cp-faint)] tabular-nums">
              {section.srcs.length}
            </span>
          }
        >
          <Gallery srcs={section.srcs} name={profile.name} />
        </Tile>
      );
    case "SOUNDCLOUD_TRACK":
      return (
        <Tile section={section} action={<OpenLink href={section.url} />}>
          <div className={media}>
            <SoundCloudPlayer
              url={section.url}
              params={{ color: accent.replace("#", ""), visual: true }}
            />
          </div>
        </Tile>
      );
    case "SOUNDCLOUD_PLAYLIST":
      return (
        <Tile
          section={section}
          className="flex-1"
          action={<OpenLink href={section.url} />}
        >
          <Frame
            title={`${profile.name} on SoundCloud`}
            src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(section.url)}&color=${accent.replace("#", "")}&visual=true`}
          />
        </Tile>
      );
    case "YOUTUBE_VIDEO":
      return (
        <Tile
          section={section}
          action={
            <OpenLink href={`https://youtu.be/${section.videoId}`}>
              YouTube
            </OpenLink>
          }
        >
          <div className={media}>
            <YouTubePlayer
              videoId={section.videoId}
              title={`${profile.name} video`}
            />
          </div>
        </Tile>
      );
    case "SPOTIFY_EMBED":
      return (
        <Tile
          section={section}
          action={<OpenLink href={section.src.replace("/embed/", "/")} />}
        >
          <iframe
            title={`${profile.name} on Spotify`}
            src={
              tone === "dark"
                ? withParam(section.src, "theme", "0")
                : section.src
            }
            height={section.tall ? 352 : 152}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="cp-media block w-full rounded-[12px]"
          />
        </Tile>
      );
    case "RELEASE":
      return (
        <Tile section={section}>
          <Release section={section} />
        </Tile>
      );
    case "SOCIAL_LINKS":
      return (
        <Tile section={section}>
          <SocialChips socials={profile.socials} name={profile.name} />
        </Tile>
      );
    case "LINK_LIST":
      return (
        <Tile section={section}>
          <LinkPills links={section.links} />
        </Tile>
      );
    case "GIG_LIST":
      // The sets blocks title their own tile (see `SectionHeading`).
      return (
        <div className="cp-tile">{gigs.upcoming({ section, profile })}</div>
      );
    case "PAST_GIGS":
      return <div className="cp-tile">{gigs.past({ section, profile })}</div>;
    case "DIVIDER":
      return (
        <div className="flex h-4 items-center">
          <hr className="w-full border-[var(--cp-line)]" />
        </div>
      );
    case "SPACER":
      return <div aria-hidden className="flex-1" />;
    case "CUSTOM_EMBED":
      return (
        <Tile
          section={section}
          url={section.url}
          className="flex-1"
          action={<OpenLink href={section.url} />}
        >
          <Frame title="Embedded content" src={section.url} />
        </Tile>
      );
  }
}

/** An embed that fills its tile. */
function Frame({ title, src }: { title: string; src: string }) {
  return (
    <div
      className={cn(media, "relative min-h-40 flex-1 bg-[var(--cp-raised)]")}
    >
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

/**
 * Long text, cut short with Read more. It fades out by itself (`cp-fold`),
 * so it looks right on glass as well as solid tiles.
 */
function FoldText({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);

  // Measure after every render (the text can change in the editor) and
  // whenever the width changes.
  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const check = () => setLong(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  });

  return (
    <>
      <div
        ref={ref}
        className={cn(
          !open && "max-h-[22rem] overflow-hidden",
          !open && long && "cp-fold",
        )}
      >
        {children}
      </div>
      {long || open ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            pill({ variant: "outline", size: "sm" }),
            "mt-4 self-start",
          )}
        >
          {open ? "Show less" : "Read more"}
        </button>
      ) : null}
    </>
  );
}

/** Store and streaming links get their service's mark. */
function linkIcon(url: string): IconType | null {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  if (host.endsWith("spotify.com")) return FaSpotify;
  if (host.endsWith("apple.com")) return FaApple;
  if (host.endsWith("bandcamp.com")) return FaBandcamp;
  if (host.endsWith("soundcloud.com")) return FaSoundcloud;
  if (host.endsWith("youtube.com") || host === "youtu.be") return FaYoutube;
  return null;
}

/** A record: cover, title, who it's by, and where to get it. */
function Release({ section }: { section: Of<"RELEASE"> }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-4 @md:grid-cols-[11rem_minmax(0,1fr)] @md:gap-6">
      <Poster
        title={section.title}
        src={section.cover}
        sizes="176px"
        className={cn(media, "aspect-square")}
      />
      <div className="min-w-0">
        <p className="cp-display text-[clamp(1.75rem,9cqw,2.75rem)] [overflow-wrap:anywhere]">
          {section.title}
        </p>
        {section.artist ? (
          <p className="mt-2 text-[14px] text-[var(--cp-muted)]">
            {section.artist}
          </p>
        ) : null}
        {section.links.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {section.links.map((l, i) => {
              const Icon = linkIcon(l.url);
              return (
                <Pill
                  key={`${l.url}-${i}`}
                  href={l.url}
                  variant={i === 0 ? "accent" : "outline"}
                  size="sm"
                >
                  {Icon ? <Icon className="size-3.5" /> : null}
                  {l.label || hostOf(l.url)}
                </Pill>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const hostOf = (url: string) =>
  url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];

/** The artist's socials as chips: the platform's mark, its name and the handle. */
function SocialChips({
  socials,
  name,
}: {
  socials: PublicProfile["socials"];
  name: string;
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">
      {socials.map((social, i) => {
        const { name: platform, handle, Icon } = socialMeta(social);
        return (
          <li key={`${social.url}-${i}`}>
            <a
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name} on ${platform}`}
              className="cp-chip group flex items-center gap-4 rounded-full py-2 pr-4 pl-2 transition-[filter] hover:brightness-110"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--chip-icon-bg)] text-[var(--chip-icon-ink)]">
                <Icon className="size-[19px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="t-label block truncate text-[11px]">
                  {platform}
                </span>
                {handle ? (
                  <span className="mt-1 block truncate text-[13px] text-[var(--cp-muted)]">
                    @{handle}
                  </span>
                ) : null}
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-[var(--cp-faint)] transition-colors group-hover:text-[var(--cp-accent-text)]" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Links as big pills; the first is the accent. */
function LinkPills({ links }: { links: { label: string; url: string }[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {links.map((l, i) => (
        <li key={`${l.url}-${i}`}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "t-label group flex h-14 items-center justify-between gap-4 rounded-full px-6 text-[12px] transition-[filter] hover:brightness-110",
              i === 0
                ? "bg-[var(--cp-accent)] text-[var(--cp-accent-ink)] shadow-[var(--accent-ring)]"
                : "cp-chip text-[var(--cp-ink)]",
            )}
          >
            <span className="truncate">{l.label || hostOf(l.url)}</span>
            <ArrowRight className="size-[18px] shrink-0 transition-transform group-hover:translate-x-0.5" />
          </a>
        </li>
      ))}
    </ul>
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
  const align = cn(
    section.align === "center" && "text-center",
    section.align === "right" && "text-right",
  );
  return (
    <div className="py-2">
      {section.label ? (
        <p
          className={cn(
            "t-label mb-4 text-[11px] text-[var(--cp-accent-text)]",
            align,
          )}
        >
          {section.label}
        </p>
      ) : null}
      <Tag
        className={cn(
          "cp-display [overflow-wrap:anywhere]",
          headingSizes[section.level],
          align,
        )}
      >
        {section.text}
      </Tag>
    </div>
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
              "group cp-media relative overflow-hidden rounded-[var(--cp-r-media)]",
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
