"use client";

import { useCallback, useEffect, useRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type EditorState,
} from "lexical";
import { LexicalRichTextEditor } from "~/components/admin/lexical-rich-text-editor";
import { cn } from "~/lib/utils";
import { type ClientBlock } from "./block-types";

type Align = "left" | "center" | "right";

type InlineBlockEditorProps = {
  block: ClientBlock;
  onChange: (next: ClientBlock) => void;
  onFocus?: () => void;
};

/**
 * In-place editor for text-based creator blocks.
 *
 * - RICH_TEXT uses the full Lexical rich-text editor (without its toolbar) so
 *   users can add formatting, headings, lists, links, etc. The value stored in
 *   `block.data.lexical` is a `SerializedEditorState`.
 * - HEADING uses a lightweight Lexical plaintext composer styled to match the
 *   public heading renderer. `block.data.text` is stored as plain text.
 */
export function InlineBlockEditor({
  block,
  onChange,
  onFocus,
}: InlineBlockEditorProps) {
  if (block.type === "HEADING") {
    return <InlineHeadingEditor block={block} onChange={onChange} onFocus={onFocus} />;
  }
  if (block.type === "RICH_TEXT") {
    return <InlineRichTextEditor block={block} onChange={onChange} onFocus={onFocus} />;
  }
  return null;
}

function InlineRichTextEditor({
  block,
  onChange,
  onFocus,
}: InlineBlockEditorProps) {
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

function InlineHeadingEditor({
  block,
  onChange,
  onFocus,
}: InlineBlockEditorProps) {
  const text = typeof block.data.text === "string" ? block.data.text : "";
  const level = Number(block.data.level) || 2;
  const align = (typeof block.data.align === "string" ? block.data.align : "left") as Align;

  const sizeClass =
    level === 1
      ? "text-4xl md:text-5xl font-bold"
      : level === 2
        ? "text-3xl md:text-4xl font-bold"
        : level === 3
          ? "text-2xl md:text-3xl font-semibold"
          : "text-xl md:text-2xl font-semibold";

  const initialConfig = {
    namespace: `creator-heading-${block.id}`,
    onError: (error: Error) => {
      console.error("Lexical heading editor error:", error);
    },
    theme: {},
    editorState: () => {
      const root = $getRoot();
      if (root.getChildrenSize() === 0) {
        const paragraph = $createParagraphNode();
        if (text) paragraph.append($createTextNode(text));
        root.append(paragraph);
      }
    },
  };

  const lastEmittedRef = useRef<string>(text);

  const handleChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const value = $getRoot().getTextContent();
        if (value === lastEmittedRef.current) return;
        lastEmittedRef.current = value;
        onChange({
          ...block,
          data: { ...block.data, text: value },
        });
      });
    },
    [block, onChange],
  );

  return (
    <div className="h-full w-full" onFocus={onFocus}>
      <LexicalComposer initialConfig={initialConfig}>
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              aria-label="Edit heading"
              aria-placeholder="Heading"
              placeholder={
                <div
                  className="text-muted-foreground pointer-events-none absolute top-0 left-0 w-full opacity-60"
                  style={{ textAlign: align }}
                >
                  Heading
                </div>
              }
              className={cn(
                "relative w-full outline-none",
                sizeClass,
              )}
              style={{ textAlign: align }}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
        <ExternalHeadingValuePlugin text={text} lastEmittedRef={lastEmittedRef} />
      </LexicalComposer>
    </div>
  );
}

function ExternalHeadingValuePlugin({
  text,
  lastEmittedRef,
}: {
  text: string;
  lastEmittedRef: { current: string };
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (text === lastEmittedRef.current) return;
    lastEmittedRef.current = text;
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        if (text) paragraph.append($createTextNode(text));
        root.append(paragraph);
      },
      { tag: "history-merge" },
    );
  }, [editor, text, lastEmittedRef]);

  return null;
}
