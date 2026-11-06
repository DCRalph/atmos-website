"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { LexicalRichTextEditor } from "~/components/lexical";
import { SiteCheckbox } from "~/components/site/inputs";
import { ImageUploadField } from "~/components/uploads/image-upload-field";
import { ImageGalleryField } from "~/components/uploads/image-gallery-field";
import {
  BLOCK_TYPES,
  getBlockDef,
  type BlockGroup,
  type ClientBlock,
} from "~/lib/artist-blocks";
import { GRID, nudgeBlock, rowsToPx } from "~/lib/artist-grid";
import { getYouTubeId, toSpotifyEmbedSrc } from "~/lib/artist-sections";
import { BLOCK_ICONS } from "./block-meta";
import {
  addBlock,
  duplicate,
  nudge,
  remove,
  setHeight,
  setWidth,
  shift,
  updateData,
} from "./actions";
import {
  Field,
  IconAction,
  PanelButton,
  PanelSection,
  Segmented,
  TextInput,
} from "./fields";
import type { EditorStore } from "./store";

const GROUPS: BlockGroup[] = [
  "Words",
  "Music",
  "Pictures",
  "Atmos",
  "Links",
  "Layout",
];

/** The block library. A block lands at the bottom, selected. */
export function AddPanel({ store }: { store: EditorStore }) {
  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <section key={group}>
          <h3 className="t-label mb-3 text-[10px] text-white/50">{group}</h3>
          <ul className="grid grid-cols-2 gap-2">
            {BLOCK_TYPES.filter((d) => d.group === group).map((def) => {
              const Icon = BLOCK_ICONS[def.type];
              return (
                <li key={def.type}>
                  <button
                    type="button"
                    onClick={() => addBlock(store, def.type)}
                    className="group/add flex h-full w-full flex-col items-start gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.03] p-3.5 text-left transition-colors hover:border-white/35 hover:bg-white/[0.07]"
                  >
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors group-hover/add:bg-[var(--ed)] group-hover/add:text-black">
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="t-label block text-[10px] text-white">
                        {def.label}
                      </span>
                      <span className="mt-1.5 block text-[12px] leading-snug text-white/55">
                        {def.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Width presets. Fractions read better in the body face than in caps. */
const fraction = (text: string) => (
  <span className="[font-family:var(--font-site-body)] text-[15px] tracking-normal normal-case">
    {text}
  </span>
);
const WIDTHS = [
  { value: 3, label: fraction("¼") },
  { value: 4, label: fraction("⅓") },
  { value: 6, label: fraction("½") },
  { value: 8, label: fraction("⅔") },
  { value: 9, label: fraction("¾") },
  { value: 12, label: "Full" },
];

/** One block's settings, size and place. */
export function BlockPanel({
  store,
  block,
  blocks,
  profileId,
}: {
  store: EditorStore;
  block: ClientBlock;
  blocks: ClientBlock[];
  profileId: string;
}) {
  const def = getBlockDef(block.type);
  const canUp = nudgeBlock(blocks, block.id, -1).some(
    (b, i) => b.id !== blocks[i]?.id || b.y !== blocks[i]?.y,
  );
  const canDown = nudgeBlock(blocks, block.id, 1).some(
    (b, i) => b.id !== blocks[i]?.id || b.y !== blocks[i]?.y,
  );

  return (
    <div className="space-y-6">
      <BlockContent store={store} block={block} profileId={profileId} />

      <PanelSection title="Size">
        <Field
          label="Width"
          hint={`${block.w} of ${GRID.cols} columns. On phones every block is full width.`}
        >
          {() => (
            <Segmented
              label="Width"
              value={block.w}
              options={WIDTHS.filter((w) => w.value >= def.minW)}
              onChange={(w) => setWidth(store, block.id, w)}
            />
          )}
        </Field>
        {def.sizing === "fill" ? (
          <Field label="Height">
            {() => (
              <div className="flex items-center gap-2">
                <IconAction
                  label="Shorter"
                  disabled={block.h <= def.minH}
                  onClick={() => setHeight(store, block.id, block.h - 2)}
                >
                  <Minus className="size-4" />
                </IconAction>
                <span className="t-label w-20 text-center text-[11px] tabular-nums">
                  {rowsToPx(block.h)}px
                </span>
                <IconAction
                  label="Taller"
                  onClick={() => setHeight(store, block.id, block.h + 2)}
                >
                  <Plus className="size-4" />
                </IconAction>
              </div>
            )}
          </Field>
        ) : (
          <p className="text-[13px] leading-snug text-white/50">
            Its height follows what&apos;s in it.
          </p>
        )}
      </PanelSection>

      <PanelSection title="Move">
        <div className="flex items-center gap-2">
          <IconAction
            label="Move up"
            disabled={!canUp}
            onClick={() => nudge(store, block.id, -1)}
          >
            <ArrowUp className="size-4" />
          </IconAction>
          <IconAction
            label="Move down"
            disabled={!canDown}
            onClick={() => nudge(store, block.id, 1)}
          >
            <ArrowDown className="size-4" />
          </IconAction>
          <IconAction
            label="Move left"
            disabled={block.x === 0}
            onClick={() => shift(store, block.id, -1)}
          >
            <ArrowLeft className="size-4" />
          </IconAction>
          <IconAction
            label="Move right"
            disabled={block.x + block.w >= GRID.cols}
            onClick={() => shift(store, block.id, 1)}
          >
            <ArrowRight className="size-4" />
          </IconAction>
        </div>
        <p className="text-[13px] leading-snug text-white/50">
          On a laptop you can also drag it, or use the arrow keys.
        </p>
      </PanelSection>

      <div className="flex gap-2 border-t border-white/10 pt-5">
        <PanelButton onClick={() => duplicate(store, block.id)}>
          <Copy className="size-3.5" /> Duplicate
        </PanelButton>
        <PanelButton tone="danger" onClick={() => remove(store, block.id)}>
          <Trash2 className="size-3.5" /> Remove
        </PanelButton>
      </div>
    </div>
  );
}

const str = (block: ClientBlock, key: string) =>
  typeof block.data[key] === "string" ? block.data[key] : "";

function BlockContent({
  store,
  block,
  profileId,
}: {
  store: EditorStore;
  block: ClientBlock;
  profileId: string;
}) {
  const set = (patch: Record<string, unknown>) =>
    updateData(store, block.id, patch);

  switch (block.type) {
    case "HEADING":
      return (
        <div className="space-y-5">
          <Field
            label="Heading"
            hint="Headings also become the tabs in the Stage layout."
          >
            {(id) => (
              <TextInput
                id={id}
                autoFocus={!str(block, "text")}
                value={str(block, "text")}
                placeholder="Listen"
                maxLength={120}
                onChange={(e) => set({ text: e.target.value })}
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-x-6 gap-y-5">
            <Field label="Text size">
              {() => (
                <Segmented
                  label="Heading size"
                  value={Number(block.data.level) || 2}
                  options={[
                    { value: 1, label: "XL" },
                    { value: 2, label: "L" },
                    { value: 3, label: "M" },
                    { value: 4, label: "S" },
                  ]}
                  onChange={(level) => set({ level })}
                />
              )}
            </Field>
            <Field label="Align">
              {() => (
                <Segmented
                  label="Heading alignment"
                  value={str(block, "align") || "left"}
                  options={[
                    {
                      value: "left",
                      label: <AlignLeft className="size-4" />,
                      title: "Left",
                    },
                    {
                      value: "center",
                      label: <AlignCenter className="size-4" />,
                      title: "Centre",
                    },
                    {
                      value: "right",
                      label: <AlignRight className="size-4" />,
                      title: "Right",
                    },
                  ]}
                  onChange={(align) => set({ align })}
                />
              )}
            </Field>
          </div>
        </div>
      );
    case "RICH_TEXT":
      return (
        <div className="space-y-2">
          <p className="t-label text-[10px] text-white/60">Text</p>
          <LexicalRichTextEditor
            key={block.id}
            value={block.data.lexical}
            onChange={(lexical) => set({ lexical })}
            namespace={`artist-block-${block.id}`}
            showToolbar
            placeholder="Write something..."
            ariaLabel="Text block"
            minHeight="10rem"
          />
        </div>
      );
    case "IMAGE":
      return (
        <div className="space-y-5">
          <p className="t-label -mb-3 text-[10px] text-white/60">Photo</p>
          <ImageUploadField
            value={
              typeof block.data.fileId === "string" && block.data.fileId
                ? block.data.fileId
                : null
            }
            onChange={(fileId) => set({ fileId })}
            preset="artistBlockImage"
            context={{ profileId }}
          />
          <Field label="Describe it" hint="For people using screen readers.">
            {(id) => (
              <TextInput
                id={id}
                value={str(block, "alt")}
                placeholder="Kraayjoy playing San Fran"
                onChange={(e) => set({ alt: e.target.value })}
              />
            )}
          </Field>
        </div>
      );
    case "GALLERY":
      return (
        <div className="space-y-2">
          <p className="t-label text-[10px] text-white/60">Photos</p>
          <ImageGalleryField
            value={
              Array.isArray(block.data.fileIds)
                ? block.data.fileIds.filter(
                    (v): v is string => typeof v === "string" && v.length > 0,
                  )
                : []
            }
            onChange={(fileIds) => set({ fileIds })}
            preset="artistBlockImage"
            context={{ profileId }}
          />
        </div>
      );
    case "SOUNDCLOUD_TRACK":
    case "SOUNDCLOUD_PLAYLIST":
      return (
        <LinkField
          block={block}
          label="SoundCloud link"
          placeholder="https://soundcloud.com/..."
          valid={(url) =>
            /^https:\/\/(www\.|on\.|m\.)?soundcloud\.com\//.test(url)
          }
          hint="The player takes your theme's accent colour."
          onChange={(url) => set({ url })}
        />
      );
    case "YOUTUBE_VIDEO":
      return (
        <LinkField
          block={block}
          label="YouTube link"
          placeholder="https://youtube.com/watch?v=..."
          valid={(url) => getYouTubeId(url) !== null}
          onChange={(url) => set({ url })}
        />
      );
    case "SPOTIFY_EMBED":
      return (
        <LinkField
          block={block}
          label="Spotify link"
          placeholder="https://open.spotify.com/..."
          valid={(url) => toSpotifyEmbedSrc(url) !== null}
          hint="Tracks show a small player; albums and playlists a tall one."
          onChange={(url) => set({ url })}
        />
      );
    case "CUSTOM_EMBED":
      return (
        <LinkField
          block={block}
          label="Link to embed"
          placeholder="https://..."
          valid={(url) => url.startsWith("https://")}
          hint="Any https page that allows embedding."
          onChange={(url) => set({ url })}
        />
      );
    case "LINK_LIST":
      return <LinksField block={block} onChange={(links) => set({ links })} />;
    case "GIG_LIST":
      return (
        <Field
          label="Title"
          hint="Your upcoming sets from Atmos lineups, soonest first, with ticket buttons. Hidden while you have none booked."
        >
          {(id) => (
            <TextInput
              id={id}
              value={str(block, "title")}
              placeholder="Sets"
              onChange={(e) => set({ title: e.target.value })}
            />
          )}
        </Field>
      );
    case "PAST_GIGS":
      return (
        <div className="space-y-5">
          <Field
            label="Title"
            hint="Every set you've played on an Atmos lineup, newest first."
          >
            {(id) => (
              <TextInput
                id={id}
                value={str(block, "title")}
                placeholder="Past sets"
                onChange={(e) => set({ title: e.target.value })}
              />
            )}
          </Field>
          <SiteCheckbox
            id={`${block.id}-upcoming`}
            checked={block.data.includeUpcoming === true}
            onCheckedChange={(includeUpcoming) => set({ includeUpcoming })}
          >
            Include upcoming sets too
          </SiteCheckbox>
          <SiteCheckbox
            id={`${block.id}-role`}
            checked={block.data.showRole !== false}
            onCheckedChange={(showRole) => set({ showRole })}
          >
            Show what you were billed as (headline, support, B2B)
          </SiteCheckbox>
        </div>
      );
    case "SOCIAL_LINKS":
      return (
        <div className="space-y-4">
          <p className="text-[14px] leading-relaxed text-white/70">
            Your socials as big rows. They&apos;re always in your header too.
          </p>
          <PanelButton onClick={() => store.getState().openPanel("socials")}>
            Edit socials
          </PanelButton>
        </div>
      );
    case "DIVIDER":
    case "SPACER":
      return null;
    default:
      return (
        <p className="text-[14px] leading-relaxed text-white/70">
          This block can&apos;t be shown any more. Remove it.
        </p>
      );
  }
}

function LinkField({
  block,
  label,
  placeholder,
  hint,
  valid,
  onChange,
}: {
  block: ClientBlock;
  label: string;
  placeholder: string;
  hint?: string;
  valid: (url: string) => boolean;
  onChange: (url: string) => void;
}) {
  const url = str(block, "url").trim();
  const bad = url !== "" && !valid(url);
  return (
    <Field
      label={label}
      hint={hint}
      error={
        bad
          ? "That link won't play here. Paste the address from your browser."
          : null
      }
    >
      {(id) => (
        <TextInput
          id={id}
          type="url"
          autoFocus={!url}
          aria-invalid={bad}
          value={str(block, "url")}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

type LinkRow = { label: string; url: string };

function LinksField({
  block,
  onChange,
}: {
  block: ClientBlock;
  onChange: (links: LinkRow[]) => void;
}) {
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const links: LinkRow[] = Array.isArray(block.data.links)
    ? block.data.links.flatMap((l: unknown) =>
        l && typeof l === "object" && "url" in l
          ? [{ label: "label" in l ? text(l.label) : "", url: text(l.url) }]
          : [],
      )
    : [];
  const edit = (i: number, patch: Partial<LinkRow>) =>
    onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-3">
      <p className="t-label text-[10px] text-white/60">Links</p>
      {links.map((link, i) => {
        const bad =
          link.url.trim() !== "" && !/^https?:\/\//.test(link.url.trim());
        return (
          <div
            key={i}
            className="space-y-2 rounded-[18px] border border-white/10 p-3"
          >
            <div className="flex gap-2">
              <TextInput
                aria-label={`Link ${i + 1} name`}
                placeholder="Bookings"
                value={link.label}
                onChange={(e) => edit(i, { label: e.target.value })}
              />
              <IconAction
                label={`Remove link ${i + 1}`}
                className="mt-1"
                onClick={() => onChange(links.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </IconAction>
            </div>
            <TextInput
              aria-label={`Link ${i + 1} address`}
              type="url"
              placeholder="https://..."
              aria-invalid={bad}
              value={link.url}
              onChange={(e) => edit(i, { url: e.target.value })}
            />
            {bad ? (
              <p className="text-site-danger-text px-2 text-[13px]">
                Start the address with https://
              </p>
            ) : null}
          </div>
        );
      })}
      <PanelButton
        className={cn(!links.length && "w-full")}
        onClick={() => onChange([...links, { label: "", url: "" }])}
      >
        <Plus className="size-3.5" /> Add a link
      </PanelButton>
      <p className="text-[13px] leading-snug text-white/50">
        The first link is also a button in the Stage layout&apos;s header.
      </p>
    </div>
  );
}
