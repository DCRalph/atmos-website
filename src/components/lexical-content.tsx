"use client";

import { useMemo } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import {
  LEXICAL_EDITOR_NODES,
  LEXICAL_EDITOR_THEME,
  type LexicalEditorValue,
} from "~/components/admin/lexical-rich-text-editor";
import type { SerializedEditorState } from "lexical";
import { cn } from "~/lib/utils";

function isLexicalStateObject(v: unknown): v is SerializedEditorState {
  return (
    typeof v === "object" &&
    v !== null &&
    "root" in (v as Record<string, unknown>)
  );
}

function normalize(
  value: LexicalEditorValue,
): SerializedEditorState | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return isLexicalStateObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isLexicalStateObject(value) ? value : null;
}

type LexicalContentProps = {
  /**
   * Serialized Lexical editor state — either a `SerializedEditorState` object
   * (e.g. straight from a Prisma `Json` column) or a JSON string.
   */
  value?: LexicalEditorValue;
  /** Namespace for the Lexical instance (must be unique on the page). */
  namespace?: string;
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
};

/**
 * Read-only Lexical renderer. Use this to display content produced by
 * `LexicalRichTextEditor`. Renders nothing when `value` is empty or invalid.
 */
export function LexicalContent({
  value,
  namespace = "lexical-content",
  className,
  contentClassName,
  ariaLabel = "Content",
}: LexicalContentProps) {
  const normalized = normalize(value);
  const initialConfig = useMemo(
    () => ({
      namespace,
      editable: false,
      onError: (error: Error) => {
        console.error("Lexical content renderer error:", error);
      },
      theme: LEXICAL_EDITOR_THEME,
      nodes: LEXICAL_EDITOR_NODES,
      editorState: normalized ? JSON.stringify(normalized) : null,
    }),
    [namespace, normalized],
  );

  if (!normalized) return null;

  return (
    <div className={cn("lexical-content", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              aria-label={ariaLabel}
              className={cn(
                "outline-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                contentClassName,
              )}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </LexicalComposer>
    </div>
  );
}
