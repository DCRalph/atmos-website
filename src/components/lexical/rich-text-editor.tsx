"use client";

import { useCallback, useRef, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import {
  $createParagraphNode,
  $getRoot,
  type EditorState,
  type LexicalEditor,
  type SerializedEditorState,
} from "lexical";
import { cn } from "~/lib/utils";
import {
  normalizeLexicalValue,
  type LexicalEditorValue,
} from "./normalize";
import { LEXICAL_NODES } from "./nodes";
import { LEXICAL_THEME } from "./theme";
import {
  AutoFocusOnMount,
  ExternalValuePlugin,
} from "./external-value-plugin";
import { Toolbar } from "./toolbar/toolbar";
import { LinkDialog } from "./link/link-dialog";
import { FloatingLinkToolbar } from "./link/floating-link-toolbar";
import type { LinkDialogState } from "./link/types";

type LexicalRichTextEditorProps = {
  /** Stored Lexical state — a `SerializedEditorState`, a JSON string, or null. */
  value: LexicalEditorValue;
  /** Called with the full `SerializedEditorState` on every change. */
  onChange: (state: SerializedEditorState) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  minHeight?: string;
  showToolbar?: boolean;
  namespace?: string;
  autoFocus?: boolean;
  contentClassName?: string;
  onFocus?: () => void;
  /** Fills the flex parent vertically and scrolls content within. */
  fillParent?: boolean;
};

export function LexicalRichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  ariaLabel = "Rich text editor",
  className,
  minHeight = "12rem",
  showToolbar = true,
  namespace = "lexical-editor",
  autoFocus = false,
  contentClassName,
  onFocus,
  fillParent = false,
}: LexicalRichTextEditorProps) {
  const initialNormalized = normalizeLexicalValue(value);
  const lastEmittedRef = useRef<string>(
    initialNormalized ? JSON.stringify(initialNormalized) : "",
  );
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);
  const [linkDialog, setLinkDialog] = useState<LinkDialogState>({
    open: false,
  });

  const initialConfig = {
    namespace,
    onError: (error: Error) => console.error("Lexical error:", error),
    theme: LEXICAL_THEME,
    nodes: LEXICAL_NODES,
    editorState: initialNormalized
      ? JSON.stringify(initialNormalized)
      : () => {
          const root = $getRoot();
          if (root.getChildrenSize() === 0) {
            root.append($createParagraphNode());
          }
        },
  };

  const handleChange = useCallback(
    (editorState: EditorState, _editor: LexicalEditor, tags: Set<string>) => {
      if (tags.has("history-merge")) return;
      const state = editorState.toJSON();
      const fingerprint = JSON.stringify(state);
      if (fingerprint === lastEmittedRef.current) return;
      lastEmittedRef.current = fingerprint;
      onChange(state);
    },
    [onChange],
  );

  return (
    <div className={cn("flex flex-col", className)} onFocus={onFocus}>
      <LexicalComposer initialConfig={initialConfig}>
        {showToolbar ? (
          <Toolbar onRequestLinkDialog={(next) => setLinkDialog(next)} />
        ) : null}
        <div
          ref={editorWrapperRef}
          className={cn(
            "border-input bg-background focus-within:border-ring focus-within:ring-ring/50 relative border shadow-xs transition-colors focus-within:ring-[3px]",
            showToolbar ? "rounded-b-md" : "rounded-md",
            fillParent && "flex-1 min-h-0 overflow-hidden",
          )}
        >
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                aria-label={ariaLabel}
                aria-placeholder={placeholder}
                placeholder={
                  <div className="text-muted-foreground pointer-events-none absolute top-3 left-3 text-sm">
                    {placeholder}
                  </div>
                }
                className={cn(
                  "min-w-0 px-3 py-3 text-sm outline-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                  contentClassName,
                )}
                style={{ minHeight }}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <OnChangePlugin
            onChange={handleChange}
            ignoreHistoryMergeTagChange
            ignoreSelectionChange
          />
          <ExternalValuePlugin
            value={value}
            lastEmittedRef={lastEmittedRef}
          />
          {autoFocus ? <AutoFocusOnMount /> : null}
          <FloatingLinkToolbar
            containerRef={editorWrapperRef}
            onRequestLinkDialog={(next) => setLinkDialog(next)}
          />
        </div>
        <LinkDialog
          state={linkDialog}
          onClose={() => setLinkDialog({ open: false })}
        />
      </LexicalComposer>
    </div>
  );
}
