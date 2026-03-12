"use client";

import { useState, type FormEvent } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { DatePicker } from "~/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export type ContentLinkType =
  | "SOUNDCLOUD_TRACK"
  | "SOUNDCLOUD_PLAYLIST"
  | "YOUTUBE_VIDEO"
  | "OTHER";

function decodeTwice(value: string) {
  let decoded = value;

  for (let i = 0; i < 2; i += 1) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break;
    }
  }

  return decoded;
}

function extractSoundCloudEmbedUrl(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Paste SoundCloud embed code or a player URL.");
  }

  let source = trimmed;

  const iframeSrcMatch = trimmed.match(/src=(["'])(.*?)\1/i);
  if (iframeSrcMatch?.[2]) {
    source = iframeSrcMatch[2];
  }

  if (source.includes("w.soundcloud.com/player")) {
    try {
      const playerUrl = new URL(source);
      const encodedTrackUrl = playerUrl.searchParams.get("url");

      if (!encodedTrackUrl) {
        throw new Error("Could not find the SoundCloud track URL in the embed.");
      }

      return decodeTwice(encodedTrackUrl);
    } catch {
      const urlParamMatch = source.match(/[?&]url=([^&]+)/i);

      if (urlParamMatch?.[1]) {
        return decodeTwice(urlParamMatch[1]);
      }
    }
  }

  if (source.startsWith("https%3A") || source.startsWith("http%3A")) {
    return decodeTwice(source);
  }

  if (
    source.startsWith("https://api.soundcloud.com/") ||
    source.startsWith("http://api.soundcloud.com/")
  ) {
    return decodeTwice(source);
  }

  throw new Error("Could not parse a SoundCloud embed URL from that input.");
}

function SoundCloudEmbedParserDialog({
  onApply,
}: {
  onApply: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [parsedValue, setParsedValue] = useState("");
  const [error, setError] = useState("");

  const handleParse = () => {
    try {
      const nextValue = extractSoundCloudEmbedUrl(rawInput);
      setParsedValue(nextValue);
      setError("");
    } catch (err) {
      setParsedValue("");
      setError(
        err instanceof Error
          ? err.message
          : "Unable to parse the SoundCloud embed URL.",
      );
    }
  };

  const handleApply = () => {
    if (!parsedValue) return;

    onApply(parsedValue);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setRawInput("");
          setParsedValue("");
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Parse SoundCloud embed
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Parse SoundCloud embed URL</DialogTitle>
          <DialogDescription className="wrap-break-word">
            Paste the full SoundCloud iframe embed code or player URL. This tool
            extracts the `url` value and decodes it twice into the final API
            URL.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="soundcloud-embed-input">Embed input</Label>
            <Textarea
              id="soundcloud-embed-input"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder='Paste the iframe HTML or SoundCloud player URL here'
              className="min-h-40 whitespace-pre-wrap break-all"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={handleParse}>
              Parse
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleApply}
              disabled={!parsedValue}
            >
              Use parsed URL
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="soundcloud-embed-output">Parsed embed URL</Label>
            <Textarea
              id="soundcloud-embed-output"
              value={parsedValue}
              readOnly
              placeholder="Parsed SoundCloud API URL will appear here"
              className="min-h-24 whitespace-pre-wrap break-all"
            />
          </div>
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ContentItemDialogProps = {
  open: boolean;
  editingId: string | null;
  type: string;
  linkType: ContentLinkType;
  title: string;
  dj: string;
  description: string;
  date: Date | undefined;
  link: string;
  embedUrl: string;
  platform: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onResetForm: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTypeChange: (value: string) => void;
  onLinkTypeChange: (value: ContentLinkType) => void;
  onTitleChange: (value: string) => void;
  onDjChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDateChange: (value: Date | undefined) => void;
  onLinkChange: (value: string) => void;
  onEmbedUrlChange: (value: string) => void;
  onPlatformChange: (value: string) => void;
};

export function ContentItemDialog({
  open,
  editingId,
  type,
  linkType,
  title,
  dj,
  description,
  date,
  link,
  embedUrl,
  platform,
  isPending,
  onOpenChange,
  onResetForm,
  onSubmit,
  onTypeChange,
  onLinkTypeChange,
  onTitleChange,
  onDjChange,
  onDescriptionChange,
  onDateChange,
  onLinkChange,
  onEmbedUrlChange,
  onPlatformChange,
}: ContentItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button onClick={onResetForm}>Add Content</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit" : "Add"} Content Item</DialogTitle>
          <DialogDescription>
            {editingId ? "Update" : "Create"} a new content item
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="type">Type</Label>
            <Input
              id="type"
              value={type}
              onChange={(e) => onTypeChange(e.target.value)}
              placeholder="mix, video, playlist"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="platform">Platform (optional)</Label>
            <Input
              id="platform"
              value={platform}
              onChange={(e) => onPlatformChange(e.target.value)}
              placeholder="SoundCloud, Spotify, YouTube, etc."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dj">DJ (optional)</Label>
            <Input
              id="dj"
              value={dj}
              onChange={(e) => onDjChange(e.target.value)}
              placeholder="DJ name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">Date</Label>
            <DatePicker
              date={date}
              onDateChange={onDateChange}
              placeholder="Select a date"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Link type</Label>
            <Select value={linkType} onValueChange={onLinkTypeChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select link type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OTHER">Other</SelectItem>
                <SelectItem value="SOUNDCLOUD_TRACK">
                  SoundCloud track
                </SelectItem>
                <SelectItem value="SOUNDCLOUD_PLAYLIST">
                  SoundCloud playlist
                </SelectItem>
                <SelectItem value="YOUTUBE_VIDEO">YouTube video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="link">Link</Label>
            <Input
              id="link"
              type="url"
              value={link}
              onChange={(e) => onLinkChange(e.target.value)}
              placeholder={
                linkType === "SOUNDCLOUD_TRACK" ||
                linkType === "SOUNDCLOUD_PLAYLIST"
                  ? "SoundCloud track/playlist URL"
                  : linkType === "YOUTUBE_VIDEO"
                    ? "YouTube video URL"
                    : "Content URL"
              }
              required
            />
          </div>
          {(linkType === "SOUNDCLOUD_TRACK" ||
            linkType === "SOUNDCLOUD_PLAYLIST" ||
            linkType === "YOUTUBE_VIDEO") && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="embedUrl">
                  {linkType === "YOUTUBE_VIDEO"
                    ? "YouTube video ID (optional)"
                    : "Embed URL (optional)"}
                </Label>
                {(linkType === "SOUNDCLOUD_TRACK" ||
                  linkType === "SOUNDCLOUD_PLAYLIST") && (
                  <SoundCloudEmbedParserDialog onApply={onEmbedUrlChange} />
                )}
              </div>
              <Input
                id="embedUrl"
                type={linkType === "YOUTUBE_VIDEO" ? "text" : "url"}
                value={embedUrl}
                onChange={(e) => onEmbedUrlChange(e.target.value)}
                placeholder={
                  linkType === "YOUTUBE_VIDEO"
                    ? "YouTube video ID (e.g. dQw4w9WgXcQ)"
                    : "SoundCloud embed URL for the player"
                }
              />
              <p className="text-muted-foreground text-xs">
                {linkType === "YOUTUBE_VIDEO"
                  ? "If provided, this ID will be used for the YouTube embed."
                  : "If provided, this URL will be used for the SoundCloud player embed. Otherwise, the Link URL will be used."}
              </p>
            </div>
          )}
          <Button type="submit" disabled={isPending}>
            {editingId ? "Update" : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
