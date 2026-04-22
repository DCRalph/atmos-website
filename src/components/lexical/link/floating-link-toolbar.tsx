"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Link2, Pencil, Trash2 } from "lucide-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import {
  resolvePillPlatform,
  type SocialPlatform,
} from "~/lib/social-pills";
import { Button } from "~/components/ui/button";
import { PlatformIcon } from "../toolbar/toolbar-button";
import {
  buildLinkDialogStateFromLinkNode,
  findLinkAncestor,
  type OpenLinkDialogState,
} from "./types";

type FloatingLinkToolbarProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onRequestLinkDialog: (state: OpenLinkDialogState) => void;
};

type FloatingLinkInfo = {
  linkKey: string;
  url: string;
  platform: SocialPlatform | null;
  top: number;
  left: number;
};

export function FloatingLinkToolbar({
  containerRef,
  onRequestLinkDialog,
}: FloatingLinkToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const [info, setInfo] = useState<FloatingLinkInfo | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const computeInfo = useCallback((): FloatingLinkInfo | null => {
    const container = containerRef.current;
    if (!container) return null;
    const activeElement =
      typeof document !== "undefined" ? document.activeElement : null;
    const isInsidePopover =
      popoverRef.current && activeElement
        ? popoverRef.current.contains(activeElement)
        : false;
    const isInsideEditor =
      activeElement && container.contains(activeElement);
    if (!isInsideEditor && !isInsidePopover) return null;

    let result: FloatingLinkInfo | null = null;
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const linkNode = findLinkAncestor(selection.anchor.getNode());
      if (!linkNode) return;
      const linkKey = linkNode.getKey();
      const domEl = editor.getElementByKey(linkKey);
      if (!domEl) return;
      const linkRect = domEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const nodeUrl = linkNode.getURL();
      result = {
        linkKey,
        url: nodeUrl,
        platform: resolvePillPlatform(nodeUrl, linkNode.getTitle()),
        top: linkRect.bottom - containerRect.top + 6,
        left: Math.max(4, linkRect.left - containerRect.left),
      };
    });
    return result;
  }, [containerRef, editor]);

  const refresh = useCallback(() => {
    setInfo(computeInfo());
  }, [computeInfo]);

  useEffect(() => {
    const off = mergeRegister(
      editor.registerUpdateListener(() => refresh()),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          refresh();
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      const container = containerRef.current;
      if (container?.contains(target)) {
        requestAnimationFrame(refresh);
        return;
      }
      setInfo(null);
    };
    const onResize = () => refresh();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      off();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, [editor, refresh, containerRef]);

  if (!info) return null;

  const handleEdit = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const linkNode = findLinkAncestor(selection.anchor.getNode());
      if (!linkNode) return;
      onRequestLinkDialog(
        buildLinkDialogStateFromLinkNode(linkNode, selection.clone()),
      );
    });
  };

  const handleRemove = () => {
    editor.update(() => {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    });
    setInfo(null);
    requestAnimationFrame(() => editor.focus());
  };

  const displayUrl = info.url.replace(/^https?:\/\//, "");

  return (
    <div
      ref={popoverRef}
      contentEditable={false}
      onMouseDown={(e) => e.preventDefault()}
      style={{ top: info.top, left: info.left }}
      className="bg-popover text-popover-foreground absolute z-10 flex max-w-[min(26rem,calc(100%-1rem))] items-center gap-1 rounded-md border p-1 shadow-md"
    >
      <a
        href={info.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-1.5 rounded px-2 py-1 text-xs hover:underline"
        title={info.url}
      >
        {info.platform ? (
          <PlatformIcon
            platform={info.platform}
            size={14}
            className="h-3.5 w-3.5"
          />
        ) : (
          <Link2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate">{displayUrl}</span>
        <ExternalLink className="text-muted-foreground h-3 w-3 shrink-0" />
      </a>
      <span className="bg-border mx-0.5 h-5 w-px" aria-hidden />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Edit link"
        aria-label="Edit link"
        onClick={handleEdit}
        className="h-7 w-7"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Remove link"
        aria-label="Remove link"
        onClick={handleRemove}
        className="text-destructive hover:text-destructive h-7 w-7"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
