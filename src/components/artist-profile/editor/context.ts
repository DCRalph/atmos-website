"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SectionProps } from "../sections";

/**
 * What the public profile parts need from the page editor while it's open.
 * Kept free of editor UI: the grid editor, dock and panels load on demand
 * when edit mode first opens, and fill this in.
 */
export type ProfileEditorHooks = {
  editing: boolean;
  /** The editable grid, in place of the public one. */
  renderGrid: (props: SectionProps) => ReactNode;
  /** Open the name, photos and bio panel (clicking a layout's hero). */
  editProfile: () => void;
};

export const ProfileEditorContext = createContext<ProfileEditorHooks | null>(
  null,
);

/** The page editor, or null on a page nobody is editing. */
export const useProfileEditor = () => useContext(ProfileEditorContext);
