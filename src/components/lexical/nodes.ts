import { LinkNode } from "@lexical/link";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code-core";
import {
  SocialPillLinkNode,
  SOCIAL_PILL_LINK_REPLACEMENT,
} from "./social-pill-node";

/** Node set shared by the editor and the read-only renderer. */
export const LEXICAL_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  SocialPillLinkNode,
  SOCIAL_PILL_LINK_REPLACEMENT,
  CodeNode,
  CodeHighlightNode,
];
