"use client";

import { Trash2, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { LexicalRichTextEditor } from "~/components/lexical";
import { ImageUploadField } from "~/components/uploads/image-upload-field";
import { ImageGalleryField } from "~/components/uploads/image-gallery-field";
import { type ClientBlock } from "./block-types";

type Props = {
  block: ClientBlock;
  onChange: (next: ClientBlock) => void;
  /**
   * Profile the uploaded files should be associated with. In self mode this
   * can be omitted (the server falls back to the current user's profile); in
   * admin mode pass the target profile id.
   */
  profileId?: string;
};

function dataField(block: ClientBlock, key: string): string {
  const v = block.data[key];
  return typeof v === "string" ? v : "";
}

function dataFileId(block: ClientBlock, key: string): string | null {
  const v = block.data[key];
  return typeof v === "string" && v ? v : null;
}

function dataFileIdArray(block: ClientBlock, key: string): string[] {
  const v = block.data[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function updateData(
  block: ClientBlock,
  key: string,
  value: unknown,
): ClientBlock {
  return { ...block, data: { ...block.data, [key]: value } };
}

function UrlField({
  block,
  onChange,
  label,
  placeholder,
  help,
}: Props & { label: string; placeholder: string; help?: string }) {
  const id = `url-${block.id}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={dataField(block, "url")}
        onChange={(e) => onChange(updateData(block, "url", e.target.value))}
        placeholder={placeholder}
      />
      {help ? <p className="text-muted-foreground text-xs">{help}</p> : null}
    </div>
  );
}

function TitleField({
  block,
  onChange,
  placeholder,
  help,
}: Props & { placeholder: string; help: string }) {
  const id = `title-${block.id}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Section title</Label>
      <Input
        id={id}
        value={dataField(block, "title")}
        onChange={(e) => onChange(updateData(block, "title", e.target.value))}
        placeholder={placeholder}
      />
      <p className="text-muted-foreground text-xs">{help}</p>
    </div>
  );
}

/** The settings for one profile section, shown under it in the section list. */
export function BlockInspector({ block, onChange, profileId }: Props) {
  switch (block.type) {
    case "HEADING":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`heading-${block.id}`}>Heading</Label>
            <Input
              id={`heading-${block.id}`}
              value={dataField(block, "text")}
              onChange={(e) =>
                onChange(updateData(block, "text", e.target.value))
              }
              placeholder="Listen"
            />
            <p className="text-muted-foreground text-xs">
              Headings name the parts of your page, and become the tabs in the
              Stage layout.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Size</Label>
              <Select
                value={String(Number(block.data.level) || 2)}
                onValueChange={(v) =>
                  onChange(updateData(block, "level", Number(v)))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Largest</SelectItem>
                  <SelectItem value="2">Large</SelectItem>
                  <SelectItem value="3">Medium</SelectItem>
                  <SelectItem value="4">Small</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Align</Label>
              <Select
                value={dataField(block, "align") || "left"}
                onValueChange={(v) => onChange(updateData(block, "align", v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );
    case "RICH_TEXT":
      return (
        <LexicalRichTextEditor
          value={block.data.lexical}
          onChange={(state) => onChange(updateData(block, "lexical", state))}
          namespace={`creator-block-${block.id}`}
          showToolbar
          placeholder="Write something..."
          ariaLabel="Edit text section"
          minHeight="8rem"
        />
      );
    case "IMAGE":
      return (
        <div className="space-y-3">
          <ImageUploadField
            label="Image"
            value={dataFileId(block, "fileId")}
            onChange={(id) => onChange(updateData(block, "fileId", id))}
            preset="creatorBlockImage"
            context={{ profileId }}
          />
          <div className="space-y-1">
            <Label htmlFor={`alt-${block.id}`}>Alt text</Label>
            <Input
              id={`alt-${block.id}`}
              value={dataField(block, "alt")}
              onChange={(e) =>
                onChange(updateData(block, "alt", e.target.value))
              }
              placeholder="What's in the photo"
            />
          </div>
        </div>
      );
    case "GALLERY":
      return (
        <ImageGalleryField
          label="Photos"
          value={dataFileIdArray(block, "fileIds")}
          onChange={(ids) => onChange(updateData(block, "fileIds", ids))}
          preset="creatorBlockImage"
          context={{ profileId }}
        />
      );
    case "SOUNDCLOUD_TRACK":
    case "SOUNDCLOUD_PLAYLIST":
      return (
        <UrlField
          block={block}
          onChange={onChange}
          label="SoundCloud link"
          placeholder="https://soundcloud.com/..."
          help="The player takes your theme's accent colour."
        />
      );
    case "YOUTUBE_VIDEO":
      return (
        <UrlField
          block={block}
          onChange={onChange}
          label="YouTube link"
          placeholder="https://youtube.com/watch?v=..."
        />
      );
    case "SPOTIFY_EMBED":
      return (
        <UrlField
          block={block}
          onChange={onChange}
          label="Spotify link"
          placeholder="https://open.spotify.com/..."
        />
      );
    case "CUSTOM_EMBED":
      return (
        <UrlField
          block={block}
          onChange={onChange}
          label="Embed link"
          placeholder="https://..."
          help="Any https page that allows embedding."
        />
      );
    case "LINK_LIST": {
      const links =
        (block.data.links as
          Array<{ label: string; url: string }> | undefined) ?? [];
      const setLinks = (next: typeof links) =>
        onChange(updateData(block, "links", next));
      return (
        <div className="space-y-3">
          {links.map((l, i) => (
            <div key={i} className="space-y-2 rounded-md border p-2">
              <Input
                aria-label={`Link ${i + 1} label`}
                placeholder="Label, like Bookings"
                value={l.label}
                onChange={(e) =>
                  setLinks(
                    links.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                aria-label={`Link ${i + 1} address`}
                placeholder="https://..."
                value={l.url}
                onChange={(e) =>
                  setLinks(
                    links.map((x, j) =>
                      j === i ? { ...x, url: e.target.value } : x,
                    ),
                  )
                }
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setLinks(links.filter((_, j) => j !== i))}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Remove
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLinks([...links, { label: "", url: "" }])}
          >
            <Plus className="mr-1 h-4 w-4" /> Add link
          </Button>
          <p className="text-muted-foreground text-xs">
            The first link also becomes a button in the Stage layout&apos;s
            header.
          </p>
        </div>
      );
    }
    case "GIG_LIST":
      return (
        <TitleField
          block={block}
          onChange={onChange}
          placeholder="Sets"
          help="Your upcoming sets from Atmos lineups, soonest first, with ticket buttons. Hidden while you have none booked."
        />
      );
    case "PAST_GIGS": {
      const includeUpcoming = block.data.includeUpcoming === true;
      const showRole = block.data.showRole !== false;
      return (
        <div className="space-y-3">
          <TitleField
            block={block}
            onChange={onChange}
            placeholder="Past sets"
            help="Every set you've played on an Atmos lineup, newest first."
          />
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={includeUpcoming}
              onChange={(e) =>
                onChange(updateData(block, "includeUpcoming", e.target.checked))
              }
            />
            <span>
              Include upcoming sets
              <span className="text-muted-foreground block text-xs">
                Useful if you don&apos;t have an Upcoming sets section.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={showRole}
              onChange={(e) =>
                onChange(updateData(block, "showRole", e.target.checked))
              }
            />
            <span>
              Show what you were billed as
              <span className="text-muted-foreground block text-xs">
                Headline, support, B2B and so on, from the lineup.
              </span>
            </span>
          </label>
        </div>
      );
    }
    case "SOCIAL_LINKS":
      return (
        <p className="text-muted-foreground text-sm">
          Shows the socials you add in the Socials panel, as big rows.
        </p>
      );
    case "DIVIDER":
    case "SPACER":
      return <p className="text-muted-foreground text-sm">No settings.</p>;
    default:
      return null;
  }
}
