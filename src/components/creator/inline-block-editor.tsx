"use client";

import { useEffect, useRef } from "react";
import { LexicalRichTextEditor } from "~/components/lexical";
import { cn } from "~/lib/utils";
import { type ClientBlock } from "./block-types";

type Align = "left" | "center" | "right";

type InlineBlockEditorProps = {
  block: ClientBlock;
  onChange: (next: ClientBlock) => void;
  onFocus?: () => void;
};

/**
 * In-place editor for text-based creator blocks. RICH_TEXT uses the Lexical
 * editor (with its toolbar); HEADING is a plain auto-grow textarea — its data
 * is a `string` so Lexical's overhead isn't needed.
 */
export function InlineBlockEditor({
  block,
  onChange,
  onFocus,
}: InlineBlockEditorProps) {
  if (block.type === "HEADING") {
    return (
      <InlineHeadingEditor block={block} onChange={onChange} onFocus={onFocus} />
    );
  }
  if (block.type === "RICH_TEXT") {
    return (
      <LexicalRichTextEditor
        value={block.data.lexical}
        onChange={(state) =>
          onChange({
            ...block,
            data: { ...block.data, lexical: state },
          })
        }
        namespace={`creator-block-${block.id}`}
        showToolbar
        fillParent
        placeholder="Write something..."
        ariaLabel="Edit text block"
        minHeight="0"
        className="h-full"
        contentClassName="h-full overflow-auto"
        onFocus={onFocus}
      />
    );
  }
  return null;
}

function InlineHeadingEditor({
  block,
  onChange,
  onFocus,
}: InlineBlockEditorProps) {
  const text = typeof block.data.text === "string" ? block.data.text : "";
  const level = Number(block.data.level) || 2;
  const align = (
    typeof block.data.align === "string" ? block.data.align : "left"
  ) as Align;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const sizeClass =
    level === 1
      ? "text-4xl md:text-5xl font-bold"
      : level === 2
        ? "text-3xl md:text-4xl font-bold"
        : level === 3
          ? "text-2xl md:text-3xl font-semibold"
          : "text-xl md:text-2xl font-semibold";

  // Auto-grow to fit content whenever the value (or style) changes.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, sizeClass]);

  return (
    <textarea
      ref={textareaRef}
      value={text}
      onChange={(e) =>
        onChange({
          ...block,
          data: { ...block.data, text: e.target.value },
        })
      }
      onFocus={onFocus}
      placeholder="Heading"
      rows={1}
      className={cn(
        "placeholder:text-muted-foreground/60 block h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none",
        sizeClass,
      )}
      style={{ textAlign: align }}
    />
  );
}
