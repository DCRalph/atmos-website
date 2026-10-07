import type { SerializedEditorState } from "lexical";

/**
 * Plain text into the shape the gig description editor stores.
 *
 * The extraction returns paragraphs of text, and the gig's description column
 * holds a serialized Lexical state. Building it here rather than round-tripping
 * through an editor keeps the import a server-side operation: the wizard never
 * has to mount a rich text editor just to save what it read.
 *
 * Only paragraphs and plain runs of text are produced. Anything richer is the
 * admin's to add in the full editor afterwards.
 */
export function plainTextToLexical(text: string): SerializedEditorState | null {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return null;

  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: "ltr",
      children: paragraphs.map((paragraph) => ({
        type: "paragraph",
        format: "",
        indent: 0,
        version: 1,
        direction: "ltr",
        textFormat: 0,
        textStyle: "",
        children: [
          {
            type: "text",
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: paragraph,
            version: 1,
          },
        ],
      })),
    },
  } as unknown as SerializedEditorState;
}

type LexicalNode = { type?: unknown; text?: unknown; children?: unknown };

const isNode = (value: unknown): value is LexicalNode =>
  typeof value === "object" && value !== null;

const childrenOf = (node: LexicalNode): LexicalNode[] =>
  Array.isArray(node.children) ? node.children.filter(isNode) : [];

function textOf(node: LexicalNode): string {
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (node.type === "linebreak") return "\n";
  // List items each get a line; everything else inside a block runs together.
  return childrenOf(node)
    .map(textOf)
    .join(node.type === "list" ? "\n" : "");
}

/**
 * A serialized Lexical state as plain text, one blank line between blocks.
 * The inverse of `plainTextToLexical`, for reading a description rather than
 * writing one: formatting and links are dropped and only the words are kept.
 * Null for anything that is not an editor state.
 */
export function lexicalToPlainText(value: unknown): string | null {
  if (!isNode(value) || !("root" in value) || !isNode(value.root)) return null;
  return childrenOf(value.root)
    .map(textOf)
    .filter((block) => block.trim())
    .join("\n\n");
}
