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
import { type ClientBlock } from "./block-types";

type Props = {
  block: ClientBlock;
  onChange: (next: ClientBlock) => void;
};

function dataField(block: ClientBlock, key: string): string {
  const v = block.data[key];
  return typeof v === "string" ? v : "";
}

function updateData(
  block: ClientBlock,
  key: string,
  value: unknown,
): ClientBlock {
  return { ...block, data: { ...block.data, [key]: value } };
}

export function BlockInspector({ block, onChange }: Props) {
  switch (block.type) {
    case "HEADING":
      return (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Click the heading on the layout to edit its text directly.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Level</Label>
              <Select
                value={String(block.data.level ?? 2)}
                onValueChange={(v) => onChange(updateData(block, "level", Number(v)))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">H1</SelectItem>
                  <SelectItem value="2">H2</SelectItem>
                  <SelectItem value="3">H3</SelectItem>
                  <SelectItem value="4">H4</SelectItem>
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
        <p className="text-muted-foreground text-sm">
          No settings for this block.
        </p>
      );
    case "IMAGE":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Image URL</Label>
            <Input
              value={dataField(block, "url")}
              onChange={(e) => onChange(updateData(block, "url", e.target.value))}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1">
            <Label>Alt text</Label>
            <Input
              value={dataField(block, "alt")}
              onChange={(e) => onChange(updateData(block, "alt", e.target.value))}
            />
          </div>
        </div>
      );
    case "GALLERY": {
      const urls = (block.data.urls as string[] | undefined) ?? [];
      return (
        <div className="space-y-3">
          <Label>Image URLs</Label>
          {urls.map((u, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={u}
                onChange={(e) => {
                  const copy = [...urls];
                  copy[i] = e.target.value;
                  onChange(updateData(block, "urls", copy));
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const copy = [...urls];
                  copy.splice(i, 1);
                  onChange(updateData(block, "urls", copy));
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange(updateData(block, "urls", [...urls, ""]))}
          >
            <Plus className="mr-1 h-4 w-4" /> Add image
          </Button>
        </div>
      );
    }
    case "SOUNDCLOUD_TRACK":
    case "SOUNDCLOUD_PLAYLIST":
      return (
        <div className="space-y-1">
          <Label>SoundCloud URL</Label>
          <Input
            value={dataField(block, "url")}
            onChange={(e) => onChange(updateData(block, "url", e.target.value))}
            placeholder="https://soundcloud.com/..."
          />
        </div>
      );
    case "YOUTUBE_VIDEO":
      return (
        <div className="space-y-1">
          <Label>YouTube URL</Label>
          <Input
            value={dataField(block, "url")}
            onChange={(e) => onChange(updateData(block, "url", e.target.value))}
            placeholder="https://youtube.com/watch?v=..."
          />
        </div>
      );
    case "SPOTIFY_EMBED":
      return (
        <div className="space-y-1">
          <Label>Spotify URL</Label>
          <Input
            value={dataField(block, "url")}
            onChange={(e) => onChange(updateData(block, "url", e.target.value))}
            placeholder="https://open.spotify.com/..."
          />
        </div>
      );
    case "LINK_LIST": {
      const links =
        (block.data.links as Array<{ label: string; url: string }> | undefined) ??
        [];
      return (
        <div className="space-y-3">
          <Label>Links</Label>
          {links.map((l, i) => (
            <div key={i} className="space-y-2 rounded-md border p-2">
              <Input
                placeholder="Label"
                value={l.label}
                onChange={(e) => {
                  const copy = [...links];
                  copy[i] = { ...l, label: e.target.value };
                  onChange(updateData(block, "links", copy));
                }}
              />
              <Input
                placeholder="https://..."
                value={l.url}
                onChange={(e) => {
                  const copy = [...links];
                  copy[i] = { ...l, url: e.target.value };
                  onChange(updateData(block, "links", copy));
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  const copy = [...links];
                  copy.splice(i, 1);
                  onChange(updateData(block, "links", copy));
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Remove
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange(
                updateData(block, "links", [
                  ...links,
                  { label: "", url: "" },
                ]),
              )
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add link
          </Button>
        </div>
      );
    }
    case "GIG_LIST":
      return (
        <div className="space-y-1">
          <Label>Source</Label>
          <Select
            value={(block.data.source as string) || "auto"}
            onValueChange={(v) => onChange(updateData(block, "source", v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                Auto: gigs I'm attributed to
              </SelectItem>
              <SelectItem value="manual">Manual (pick specific gigs)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Manual picking can be added later from the dashboard.
          </p>
        </div>
      );
    case "PAST_GIGS": {
      const includeUpcoming = block.data.includeUpcoming === true;
      const showRole =
        block.data.showRole === undefined ? true : block.data.showRole === true;
      const title = dataField(block, "title");
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Section title</Label>
            <Input
              value={title}
              onChange={(e) =>
                onChange(updateData(block, "title", e.target.value))
              }
              placeholder="Past gigs"
            />
          </div>
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
              Include upcoming gigs
              <span className="text-muted-foreground block text-xs">
                By default only gigs that have already happened are shown.
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
              Show your role
              <span className="text-muted-foreground block text-xs">
                Displays the role you were credited with on each gig.
              </span>
            </span>
          </label>
          <p className="text-muted-foreground text-xs">
            Auto-pulled from gigs you've been added to in the lineup. Up to 3
            are shown in the block (fewer for smaller sizes) — the rest appear
            when visitors click "View all".
          </p>
        </div>
      );
    }
    case "CONTENT_LIST":
      return (
        <p className="text-muted-foreground text-sm">
          Pulls from your content items. (Filtering UI coming soon.)
        </p>
      );
    case "CUSTOM_EMBED":
      return (
        <div className="space-y-1">
          <Label>Embed URL</Label>
          <Input
            value={dataField(block, "url")}
            onChange={(e) => onChange(updateData(block, "url", e.target.value))}
            placeholder="https://..."
          />
          <p className="text-muted-foreground text-xs">
            Any iframe-embeddable URL.
          </p>
        </div>
      );
    case "SOCIAL_LINKS":
      return (
        <p className="text-muted-foreground text-sm">
          Edit socials from the "Socials" panel above. They appear here
          automatically.
        </p>
      );
    case "DIVIDER":
    case "SPACER":
      return (
        <p className="text-muted-foreground text-sm">
          No options. Drag the corner to change size.
        </p>
      );
    default:
      return null;
  }
}
