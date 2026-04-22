"use client";

import { useMemo } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { cn } from "~/lib/utils";
import { LEXICAL_NODES } from "./nodes";
import { LEXICAL_THEME } from "./theme";
import {
  normalizeLexicalValue,
  type LexicalEditorValue,
} from "./normalize";

type LexicalContentProps = {
  value?: LexicalEditorValue;
  /** Must be unique on the page. */
  namespace?: string;
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
};

/** Read-only renderer for `LexicalRichTextEditor` content. */
export function LexicalContent({
  value,
  namespace = "lexical-content",
  className,
  contentClassName,
  ariaLabel = "Content",
}: LexicalContentProps) {
  const normalized = normalizeLexicalValue(value);
  const initialConfig = useMemo(
    () => ({
      namespace,
      editable: false,
      onError: (error: Error) =>
        console.error("Lexical content renderer error:", error),
      theme: LEXICAL_THEME,
      nodes: LEXICAL_NODES,
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
