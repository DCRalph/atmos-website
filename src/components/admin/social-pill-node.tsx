/**
 * `SocialPillLinkNode` — a `LinkNode` subclass that renders as a stylised
 * "social pill" (icon + handle, platform colour) when its `title` attribute
 * matches one of the registered social platforms. Regular links (no pill
 * title) keep standard `LinkNode` appearance.
 *
 * Implementation notes:
 *   - Lexical requires subclass replacements to use a unique `getType()` so
 *     we register this class as `"social-pill-link"`. On serialisation,
 *     every `LinkNode` instance that flows through the editor is promoted
 *     to a `SocialPillLinkNode` (see {@link SOCIAL_PILL_LINK_REPLACEMENT}),
 *     which means the stored JSON `type` becomes `"social-pill-link"` for
 *     new writes.
 *   - Existing documents stored with `type: "link"` deserialise fine: the
 *     registry looks up `LinkNode.importJSON`, which calls `$createLinkNode`,
 *     which runs through `$applyNodeReplacement` and returns a
 *     `SocialPillLinkNode`. Pill styling is then applied at render time
 *     based on the node's `title`.
 *   - Pill styling itself lives in `createDOM`/`updateDOM`; the icon is
 *     prepended as an unmanaged DOM child (`setDOMUnmanaged`) so Lexical's
 *     reconciler doesn't strip it when it diffs the node's text children.
 */
"use client";

import { LinkNode, type LinkAttributes } from "@lexical/link";
import {
  $applyNodeReplacement,
  setDOMUnmanaged,
  type EditorConfig,
  type LexicalNode,
  type LexicalNodeReplacement,
  type LexicalUpdateJSON,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from "lexical";
import {
  SOCIAL_PLATFORMS,
  detectPlatformFromUrl,
  getPlatformFromPillTitle,
  type SocialPlatform,
} from "~/lib/social-pills";

const SOCIAL_PILL_LINK_TYPE = "social-pill-link";

const PILL_TITLES = new Set(SOCIAL_PLATFORMS.map((p) => p.pillTitle));

const PILL_BASE_CLASSES = [
  "social-pill",
  "inline-flex",
  "items-center",
  "gap-1.5",
  "rounded-full",
  "border",
  "px-3",
  "py-0.5",
  "text-sm",
  "font-semibold",
  "no-underline",
  "transition-colors",
];

const ALL_PLATFORM_CLASSES = Array.from(
  new Set(
    SOCIAL_PLATFORMS.flatMap((p) =>
      p.pillClassName.split(" ").filter(Boolean),
    ),
  ),
);

function resolvePlatform(
  url: string,
  title: string | null,
): SocialPlatform | null {
  if (title && PILL_TITLES.has(title)) {
    return (
      getPlatformFromPillTitle(title) ?? detectPlatformFromUrl(url) ?? null
    );
  }
  return null;
}

function applyPillStyling(
  dom: HTMLAnchorElement | HTMLSpanElement,
  platform: SocialPlatform | null,
): void {
  const anchor = dom as HTMLElement;
  anchor.classList.remove(...ALL_PLATFORM_CLASSES);

  const existingIcon = anchor.querySelector<HTMLImageElement>(
    ":scope > img[data-social-pill-icon]",
  );

  if (!platform) {
    anchor.classList.remove(...PILL_BASE_CLASSES);
    if (existingIcon) existingIcon.remove();
    return;
  }

  anchor.classList.add(...PILL_BASE_CLASSES);
  anchor.classList.add(
    ...platform.pillClassName.split(" ").filter(Boolean),
  );
  // The underlying `title` attribute stores the pill marker
  // (e.g. `atmos-social-pill:instagram`). Hide it so users don't see a
  // tooltip with an internal identifier.
  anchor.removeAttribute("title");

  if (existingIcon) {
    if (existingIcon.getAttribute("src") !== platform.iconSrc) {
      existingIcon.setAttribute("src", platform.iconSrc);
    }
    if (anchor.firstChild !== existingIcon) {
      anchor.insertBefore(existingIcon, anchor.firstChild);
    }
    return;
  }

  const icon = document.createElement("img");
  icon.setAttribute("data-social-pill-icon", "");
  icon.className = "social-pill__icon h-4 w-4 shrink-0 object-contain";
  icon.src = platform.iconSrc;
  icon.alt = "";
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("contenteditable", "false");
  setDOMUnmanaged(icon);
  anchor.insertBefore(icon, anchor.firstChild);
}

export type SerializedSocialPillLinkNode = Spread<
  {
    url: string;
    rel: null | string;
    target: null | string;
    title: null | string;
  },
  SerializedElementNode
>;

export class SocialPillLinkNode extends LinkNode {
  static override getType(): string {
    return SOCIAL_PILL_LINK_TYPE;
  }

  static override clone(node: SocialPillLinkNode): SocialPillLinkNode {
    return new SocialPillLinkNode(
      node.__url,
      {
        title: node.__title,
        rel: node.__rel,
        target: node.__target,
      },
      node.__key,
    );
  }

  constructor(url?: string, attributes?: LinkAttributes, key?: NodeKey) {
    super(url, attributes, key);
  }

  static override importJSON(
    serializedNode: SerializedSocialPillLinkNode,
  ): SocialPillLinkNode {
    return $createSocialPillLinkNode().updateFromJSON(serializedNode);
  }

  override updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedSocialPillLinkNode>,
  ): this {
    return super.updateFromJSON(serializedNode) as this;
  }

  override createDOM(
    config: EditorConfig,
  ): HTMLAnchorElement | HTMLSpanElement {
    const dom = super.createDOM(config);
    const platform = resolvePlatform(this.getURL(), this.getTitle());
    applyPillStyling(dom, platform);
    return dom;
  }

  override updateDOM(
    prevNode: this,
    anchor: HTMLAnchorElement | HTMLSpanElement,
    config: EditorConfig,
  ): boolean {
    const updated = super.updateDOM(prevNode, anchor, config);
    const platform = resolvePlatform(this.getURL(), this.getTitle());
    applyPillStyling(anchor, platform);
    return updated;
  }
}

export function $createSocialPillLinkNode(
  url?: string,
  attributes?: LinkAttributes,
): SocialPillLinkNode {
  return $applyNodeReplacement(new SocialPillLinkNode(url, attributes));
}

export function $isSocialPillLinkNode(
  node: LexicalNode | null | undefined,
): node is SocialPillLinkNode {
  return node instanceof SocialPillLinkNode;
}

/**
 * Node replacement entry to register alongside `LinkNode` in a
 * `LexicalComposer` config. Promotes every `LinkNode` instance (created via
 * `$createLinkNode`, parsed from stored JSON, imported from HTML, etc.) to a
 * `SocialPillLinkNode` so pill styling is applied automatically. Must be
 * paired with `LinkNode` and `SocialPillLinkNode` in the `nodes` array.
 */
export const SOCIAL_PILL_LINK_REPLACEMENT: LexicalNodeReplacement = {
  replace: LinkNode,
  with: (node: LinkNode) =>
    new SocialPillLinkNode(node.__url, {
      title: node.__title,
      rel: node.__rel,
      target: node.__target,
    }),
  withKlass: SocialPillLinkNode,
};
