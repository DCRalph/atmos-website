"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createParagraphNode, $getRoot } from "lexical";
import {
  normalizeLexicalValue,
  type LexicalEditorValue,
} from "./normalize";

type ValueRef = { current: string };

type ExternalValuePluginProps = {
  value: LexicalEditorValue;
  lastEmittedRef: ValueRef;
};

/** Syncs external `value` into the editor, skipping reentrant self-emits via
 * `lastEmittedRef` (the editor writes the same fingerprint on every change). */
export function ExternalValuePlugin({
  value,
  lastEmittedRef,
}: ExternalValuePluginProps) {
  const [editor] = useLexicalComposerContext();

  const normalized = normalizeLexicalValue(value);
  const fingerprint = normalized ? JSON.stringify(normalized) : "";

  useEffect(() => {
    if (fingerprint === lastEmittedRef.current) return;
    lastEmittedRef.current = fingerprint;
    if (normalized) {
      try {
        const parsed = editor.parseEditorState(normalized);
        editor.setEditorState(parsed, { tag: "history-merge" });
        return;
      } catch (err) {
        console.error("Failed to parse Lexical editor state:", err);
      }
    }
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        root.append($createParagraphNode());
      },
      { tag: "history-merge" },
    );
  }, [editor, fingerprint, normalized, lastEmittedRef]);

  return null;
}

export function AutoFocusOnMount() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.focus();
  }, [editor]);
  return null;
}
