import { $isLinkNode, type LinkNode as LinkNodeType } from "@lexical/link";
import { $findMatchingParent } from "@lexical/utils";
import type { BaseSelection } from "lexical";
import {
  resolvePillPlatform,
  type SocialPlatformId,
} from "~/lib/social-pills";

export type LinkDialogMode = "standard" | SocialPlatformId;

export type OpenLinkDialogState = {
  open: true;
  selection: BaseSelection | null;
  initialMode: LinkDialogMode;
  initialUrl: string;
  initialSocialInputs: Partial<Record<SocialPlatformId, string>>;
  initialText: string;
  initialHasLink: boolean;
};

export type LinkDialogState = { open: false } | OpenLinkDialogState;

export function buildLinkDialogStateFromLinkNode(
  linkNode: LinkNodeType,
  selection: BaseSelection | null,
): OpenLinkDialogState {
  const existingUrl = linkNode.getURL() ?? "";
  const existingTitle = linkNode.getTitle() ?? "";
  const platform = resolvePillPlatform(existingUrl, existingTitle);
  const socialInputs: Partial<Record<SocialPlatformId, string>> = {};
  if (platform) {
    const handle = platform.extractHandle(existingUrl);
    socialInputs[platform.id] = handle || existingUrl;
  }
  return {
    open: true,
    selection,
    initialMode: platform ? platform.id : "standard",
    initialUrl: platform ? "" : existingUrl,
    initialSocialInputs: socialInputs,
    initialText: linkNode.getTextContent(),
    initialHasLink: true,
  };
}

/** Find the nearest ancestor `LinkNode` of the given node. */
export function findLinkAncestor(node: unknown): LinkNodeType | null {
  return $findMatchingParent(
    node as Parameters<typeof $findMatchingParent>[0],
    $isLinkNode,
  ) as LinkNodeType | null;
}
