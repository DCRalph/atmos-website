import { Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { colors, space } from "@/lib/theme";

/**
 * The gig description, rendered natively.
 *
 * The web stores descriptions as a serialized Lexical editor state and renders
 * them with the Lexical runtime. Shipping that runtime in the app buys nothing:
 * the state is plain JSON, and the subset an admin can actually produce in the
 * gig editor — paragraphs, headings, quotes, lists, links, and inline bold,
 * italic, underline, strikethrough and code — maps one to one onto `<Text>` and
 * `<View>`. So this walks the JSON instead.
 *
 * Unknown node types render their children rather than nothing, so a new
 * editor feature degrades to plain text in old app builds instead of a hole in
 * the page.
 */

/** Lexical's inline format bitmask, as stored on text nodes. */
const BOLD = 1;
const ITALIC = 2;
const STRIKETHROUGH = 4;
const UNDERLINE = 8;
const CODE = 16;

type LexicalNode = {
  type?: string;
  text?: string;
  format?: number | string;
  /** Inline CSS the editor's colour picker writes, e.g. `color: #ec4899;`. */
  style?: string;
  tag?: string;
  url?: string;
  listType?: string;
  start?: number;
  children?: LexicalNode[];
};

/** The one CSS property the editor can set on a text node. */
function colorOf(style?: string): string | undefined {
  return /(?:^|;)\s*color:\s*([^;]+)/.exec(style ?? "")?.[1]?.trim();
}

export function LexicalContent({ value }: { value: unknown }) {
  const root = rootOf(value);
  if (!root?.children?.length) return null;

  return (
    <View style={{ gap: space.md }}>
      {root.children.map((node, index) => (
        <Block key={index} node={node} />
      ))}
    </View>
  );
}

/** Whether a serialized state has anything visible in it. */
export function hasLexicalContent(value: unknown): boolean {
  const root = rootOf(value);
  return !!root?.children?.some((node) => textOf(node).trim().length > 0);
}

/**
 * Older rows hold the state as a JSON string rather than an object — the web
 * renderer normalizes both (see `src/components/lexical/normalize.ts`), and
 * this has to as well or those gigs silently fall back to plain text.
 */
function rootOf(value: unknown): LexicalNode | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return rootOf(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const root = (value as { root?: LexicalNode }).root;
  return root ?? null;
}

function textOf(node: LexicalNode): string {
  if (typeof node.text === "string") return node.text;
  return (node.children ?? []).map(textOf).join("");
}

function Block({ node }: { node: LexicalNode }) {
  switch (node.type) {
    case "heading": {
      // The editor offers h1–h3; anything smaller reads as body on a phone.
      const big = node.tag === "h1";
      return (
        <Text
          style={{
            color: colors.text,
            fontWeight: "900",
            textTransform: "uppercase",
            letterSpacing: big ? -0.5 : 0.4,
            fontSize: big ? 20 : 13,
            marginTop: space.sm,
          }}
        >
          <Inline nodes={node.children} />
        </Text>
      );
    }
    case "quote":
      return (
        <View
          style={{
            borderLeftWidth: 2,
            borderLeftColor: colors.borderHard,
            paddingLeft: space.md,
          }}
        >
          <Text style={bodyStyle}>
            <Inline nodes={node.children} />
          </Text>
        </View>
      );
    case "list": {
      const ordered = node.listType === "number";
      const start = node.start ?? 1;
      return (
        <View style={{ gap: space.xs }}>
          {(node.children ?? []).map((item, index) => (
            <View key={index} style={{ flexDirection: "row", gap: space.sm }}>
              <Text style={[bodyStyle, { color: colors.textFaint }]}>
                {ordered ? `${start + index}.` : "–"}
              </Text>
              <Text style={[bodyStyle, { flex: 1 }]}>
                <Inline nodes={item.children} />
              </Text>
            </View>
          ))}
        </View>
      );
    }
    default:
      // Paragraphs, and any block type this build has never heard of.
      return (
        <Text style={bodyStyle}>
          <Inline nodes={node.children} />
        </Text>
      );
  }
}

function Inline({ nodes }: { nodes?: LexicalNode[] }) {
  if (!nodes?.length) return null;
  return (
    <>
      {nodes.map((node, index) => (
        <InlineNode key={index} node={node} />
      ))}
    </>
  );
}

function InlineNode({ node }: { node: LexicalNode }) {
  if (node.type === "linebreak") return "\n";

  // Anything carrying a URL is a link — this also catches the editor's
  // social-pill nodes, which serialize as a LinkNode subclass under their own
  // type name.
  if (
    typeof node.url === "string" ||
    node.type === "link" ||
    node.type === "autolink"
  ) {
    const url = node.url;
    return (
      <Text
        style={{ color: colors.text, textDecorationLine: "underline" }}
        onPress={url ? () => void WebBrowser.openBrowserAsync(url) : undefined}
      >
        <Inline nodes={node.children} />
      </Text>
    );
  }

  if (typeof node.text === "string") {
    const format = typeof node.format === "number" ? node.format : 0;
    const color = colorOf(node.style);
    return (
      <Text
        style={[
          format & BOLD ? { fontWeight: "700", color: colors.text } : null,
          format & ITALIC ? { fontStyle: "italic" } : null,
          format & UNDERLINE ? { textDecorationLine: "underline" } : null,
          format & STRIKETHROUGH
            ? { textDecorationLine: "line-through" }
            : null,
          format & CODE ? { fontFamily: "Menlo" } : null,
          color ? { color } : null,
        ]}
      >
        {node.text}
      </Text>
    );
  }

  return <Inline nodes={node.children} />;
}

const bodyStyle = {
  color: colors.textSoft,
  fontSize: 14,
  lineHeight: 22,
} as const;
