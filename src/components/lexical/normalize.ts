import type { SerializedEditorState } from "lexical";

/** Anything we might receive as stored Lexical content. */
export type LexicalEditorValue = unknown;

function isLexicalStateObject(v: unknown): v is SerializedEditorState {
  return (
    typeof v === "object" &&
    v !== null &&
    "root" in (v as Record<string, unknown>)
  );
}

/** Normalize a stored value into a `SerializedEditorState` or `null`. */
export function normalizeLexicalValue(
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
