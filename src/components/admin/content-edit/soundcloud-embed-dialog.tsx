"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
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

/**
 * Pulls the player URL out of a pasted SoundCloud embed. Unchanged behaviour,
 * moved here from the old content dialog so the editor can keep the tool without
 * carrying the form plumbing that used to surround it.
 */

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

export function extractSoundCloudEmbedUrl(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Paste SoundCloud embed code or a player URL.");
  }

  let source = trimmed;

  const iframeSrcMatch = /src=(["'])(.*?)\1/i.exec(trimmed);
  if (iframeSrcMatch?.[2]) {
    source = iframeSrcMatch[2];
  }

  if (source.includes("w.soundcloud.com/player")) {
    try {
      const playerUrl = new URL(source);
      const encodedTrackUrl = playerUrl.searchParams.get("url");

      if (!encodedTrackUrl) {
        throw new Error(
          "Could not find the SoundCloud track URL in the embed.",
        );
      }

      return decodeTwice(encodedTrackUrl);
    } catch {
      const urlParamMatch = /[?&]url=([^&]+)/i.exec(source);

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

export function SoundCloudEmbedParserDialog({
  onApply,
  disabled,
}: {
  onApply: (value: string) => void;
  disabled?: boolean;
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
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
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
              placeholder="Paste the iframe HTML or SoundCloud player URL here"
              className="min-h-40 break-all whitespace-pre-wrap"
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
              className="min-h-24 break-all whitespace-pre-wrap"
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
