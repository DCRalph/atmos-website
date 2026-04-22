"use client";

// `LinkNode` subclass that renders as a branded "social pill" when its stored
// `title` matches a registered social platform. Paired with `LinkNode` via
// `SOCIAL_PILL_LINK_REPLACEMENT` so every link flowing through the editor is
// promoted to this class and pill styling stays consistent.

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
  // Hide the raw pill marker (`*-pill`) so users don't see an internal title.
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
  // `setDOMUnmanaged` prevents Lexical's reconciler from stripping the icon
  // when it diffs the node's text children.
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
    applyPillStyling(dom, resolvePlatform(this.getURL(), this.getTitle()));
    return dom;
  }

  override updateDOM(
    prevNode: this,
    anchor: HTMLAnchorElement | HTMLSpanElement,
    config: EditorConfig,
  ): boolean {
    const updated = super.updateDOM(prevNode, anchor, config);
    applyPillStyling(anchor, resolvePlatform(this.getURL(), this.getTitle()));
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

/** Promotes every `LinkNode` (created in-editor or parsed from JSON/HTML) to
 * a `SocialPillLinkNode` so pill styling is applied automatically. */
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
