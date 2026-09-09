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
