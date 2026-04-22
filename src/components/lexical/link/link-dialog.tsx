"use client";

import { useEffect, useState } from "react";
import { Link2, Trash2 } from "lucide-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { TOGGLE_LINK_COMMAND, type LinkNode as LinkNodeType } from "@lexical/link";
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $setSelection,
} from "lexical";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  SOCIAL_PLATFORMS,
  getPlatform,
  type SocialPlatform,
  type SocialPlatformId,
} from "~/lib/social-pills";
import { cn } from "~/lib/utils";
import { PlatformIcon } from "../toolbar/toolbar-button";
import {
  findLinkAncestor,
  type LinkDialogMode,
  type LinkDialogState,
} from "./types";

type LinkDialogProps = {
  state: LinkDialogState;
  onClose: () => void;
};

export function LinkDialog({ state, onClose }: LinkDialogProps) {
  const [editor] = useLexicalComposerContext();
  const [mode, setMode] = useState<LinkDialogMode>("standard");
  const [url, setUrl] = useState("");
  const [socialInputs, setSocialInputs] = useState<
    Partial<Record<SocialPlatformId, string>>
  >({});
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.open) return;
    setMode(state.initialMode);
    setUrl(state.initialUrl);
    setSocialInputs(state.initialSocialInputs);
    setText(state.initialText);
    setError(null);
  }, [state]);

  if (!state.open) return null;

  const hasLink = state.initialHasLink;
  const activePlatform: SocialPlatform | null =
    mode === "standard" ? null : getPlatform(mode);

  const setSocialInput = (id: SocialPlatformId, value: string) => {
    setSocialInputs((prev) => ({ ...prev, [id]: value }));
  };

  const fallbackDisplayText = (): string => {
    if (!activePlatform) return url.trim();
    const input = (socialInputs[activePlatform.id] ?? "").trim();
    if (!input) return activePlatform.name;
    if (/^https?:\/\//i.test(input)) {
      const normalized = activePlatform.normalizeInput(input);
      const handle = normalized ? activePlatform.extractHandle(normalized) : "";
      if (!handle) return activePlatform.name;
      return activePlatform.supportsHandleInput ? `@${handle}` : handle;
    }
    const handle = input.replace(/^@/, "");
    return activePlatform.supportsHandleInput ? `@${handle}` : handle;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let finalUrl: string;
    let title: string | null;

    if (activePlatform) {
      const rawInput = (socialInputs[activePlatform.id] ?? "").trim();
      if (!rawInput) {
        setError(
          `Enter a ${activePlatform.name} URL${
            activePlatform.supportsHandleInput ? " or handle" : ""
          }.`,
        );
        return;
      }
      const normalized = activePlatform.normalizeInput(rawInput);
      if (!normalized) {
        setError(
          activePlatform.supportsHandleInput
            ? `Enter a ${activePlatform.name} handle or a valid ${activePlatform.hosts[0]} URL.`
            : `Enter a valid ${activePlatform.name} URL.`,
        );
        return;
      }
      finalUrl = normalized;
      title = activePlatform.pillTitle;
    } else {
      const trimmed = url.trim();
      if (!trimmed) {
        setError("URL is required.");
        return;
      }
      try {
        const parsed = new URL(trimmed);
        if (!/^https?:$/.test(parsed.protocol)) {
          setError("Only http and https URLs are supported.");
          return;
        }
        finalUrl = parsed.toString();
      } catch {
        setError("Enter a valid URL (e.g. https://example.com).");
        return;
      }
      title = null;
    }

    const typedText = text.trim();
    const displayText = typedText || fallbackDisplayText() || finalUrl;

    editor.update(() => {
      if (state.selection) {
        $setSelection(state.selection.clone());
      }
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const existingLink = findLinkAncestor(selection.anchor.getNode());

      if (existingLink) {
        existingLink.setURL(finalUrl);
        existingLink.setTitle(title);
        const currentText = existingLink.getTextContent();
        if (displayText && displayText !== currentText) {
          for (const child of existingLink.getChildren()) {
            child.remove();
          }
          existingLink.append($createTextNode(displayText));
        }
        return;
      }

      if (selection.isCollapsed()) {
        const node = $createTextNode(displayText);
        selection.insertNodes([node]);
        node.select(0, displayText.length);
      } else {
        const currentText = selection.getTextContent();
        if (typedText && typedText !== currentText) {
          selection.insertText(displayText);
          selection.anchor.offset -= displayText.length;
        }
      }
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
        url: finalUrl,
        title,
        target: null,
        rel: null,
      });
    });

    onClose();
    requestAnimationFrame(() => editor.focus());
  };

  const handleRemove = () => {
    editor.update(() => {
      if (state.selection) {
        $setSelection(state.selection.clone());
      }
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    });
    onClose();
    requestAnimationFrame(() => editor.focus());
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{hasLink ? "Edit link" : "Insert link"}</DialogTitle>
          <DialogDescription>
            Pick a standard link or a social platform to render a branded pill
            on the public site.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ModeButton
              active={mode === "standard"}
              onClick={() => setMode("standard")}
              icon={<Link2 className="h-5 w-5" />}
              label="Standard"
            />
            {SOCIAL_PLATFORMS.map((platform) => (
              <ModeButton
                key={platform.id}
                active={mode === platform.id}
                onClick={() => setMode(platform.id)}
                icon={
                  <PlatformIcon
                    platform={platform}
                    size={20}
                    className="h-5 w-5"
                  />
                }
                label={platform.name}
              />
            ))}
          </div>

          {activePlatform ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`link-${activePlatform.id}`}>
                {activePlatform.supportsHandleInput
                  ? `${activePlatform.name} handle or URL`
                  : `${activePlatform.name} URL`}
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
                  <PlatformIcon
                    platform={activePlatform}
                    size={16}
                    className="h-4 w-4"
                  />
                </span>
                <Input
                  id={`link-${activePlatform.id}`}
                  value={socialInputs[activePlatform.id] ?? ""}
                  onChange={(e) =>
                    setSocialInput(activePlatform.id, e.target.value)
                  }
                  placeholder={activePlatform.inputPlaceholder}
                  className="pl-9"
                  autoFocus
                />
              </div>
              {activePlatform.inputHelp ? (
                <p className="text-muted-foreground text-xs">
                  {activePlatform.inputHelp}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                autoFocus
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="link-text">Display text</Label>
            <Input
              id="link-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                activePlatform
                  ? activePlatform.supportsHandleInput
                    ? "@atmos"
                    : activePlatform.name
                  : "Link text shown to readers"
              }
            />
            <p className="text-muted-foreground text-xs">
              Leave blank to auto-generate from the{" "}
              {activePlatform ? "handle" : "URL"}.
            </p>
          </div>

          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            {hasLink ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleRemove}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Remove link
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {hasLink ? "Update link" : "Insert link"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ModeButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
};

function ModeButton({ active, onClick, icon, label }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-md border p-3 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "hover:bg-accent text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
