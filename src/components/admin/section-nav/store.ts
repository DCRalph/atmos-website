import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";

export type SectionNavItem = {
  value: string;
  label: string;
  icon: LucideIcon;
  /** Shown at the right of the row, for lists: orders, tickets, sessions. */
  count?: number;
  /** Marks a section with unsaved changes. */
  dirty?: boolean;
};

export type SectionNavGroup = {
  /** Omit for an ungrouped run of items, such as a lone Overview at the top. */
  label?: string;
  items: SectionNavItem[];
};

export type SectionNavConfig = {
  /** The thing being edited: the event, the gig, the user. */
  title: string;
  /** A status badge beside the title. */
  status?: ReactNode;
  backLink?: { href: string; label: string };
  groups: SectionNavGroup[];
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * The one section nav on screen. A page registers its sections here and the
 * admin layout draws them as a rail beside the main sidebar, so the rail can
 * live outside the page's scroll column and the main sidebar can react to it.
 *
 * A tiny external store rather than context: the page writes on every render
 * and only the rail subscribes, so registering never re-renders the page.
 */
let current: SectionNavConfig | null = null;
const listeners = new Set<() => void>();

export function setSectionNav(config: SectionNavConfig | null) {
  current = config;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => current;
const getServerSnapshot = () => null;

/** The registered section nav, or null on a page without one. */
export function useSectionNav() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
