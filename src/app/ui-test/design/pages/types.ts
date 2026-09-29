import type { ReactNode } from "react";

/**
 * Contract for a page in the board's Pages mode. Each `(main)` page exports
 * one `PageSpec`: its drafts (alternative designs) and the states every draft
 * must be able to render (loading, empty, error, sold out, ...).
 */
export type PageStateOption = {
  id: string;
  label: string;
  /** Short explanation shown under the state picker. */
  hint?: string;
};

export type PageDraft = {
  id: string;
  label: string;
  /** One line on what this draft is trying. */
  note: string;
  /**
   * The page body (between site header and footer) in `state`. Rendered as a
   * component keyed by page, draft and state, so it can use hooks freely and
   * treat `state` as its starting condition.
   */
  Component: (props: { state: string }) => ReactNode;
  /** The draft opens with a full-bleed photo hero; the site header floats over it. */
  heroUnderHeader?: boolean;
};

export type PageSpec = {
  id: string;
  title: string;
  /** The real route, shown in the frame's address bar. */
  route: string;
  states: readonly PageStateOption[];
  drafts: readonly PageDraft[];
  /** Which top-nav item to mark active. */
  nav?: string;
};
