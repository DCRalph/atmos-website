"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "motion/react";
import { ArrowLeft } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";
import { SECTION_NAV_SPRING } from "./section-nav";
import { useSectionNav, type SectionNavConfig } from "./store";

const RAIL_WIDTH = "14rem";

/**
 * The desktop section rail: a second column beside the main sidebar, built
 * from the same primitives, showing whichever page has registered a
 * SectionNav. Slides in and out with the page; while it is up the main
 * sidebar drops to its icon mode so the two columns don't eat the page.
 */
export function SectionRail() {
  const nav = useSectionNav();
  useCollapseSidebarWhile(nav !== null);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence initial={false}>
        {nav ? (
          <motion.aside
            key="section-rail"
            aria-label={`${nav.title} sections`}
            initial={{ width: 0 }}
            animate={{ width: RAIL_WIDTH }}
            exit={{ width: 0 }}
            transition={SECTION_NAV_SPRING}
            className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden shrink-0 overflow-hidden border-l lg:block"
          >
            {/* Fixed width so the rows don't reflow while the column grows. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex h-full flex-col"
              style={{ width: RAIL_WIDTH }}
            >
              <RailHeader nav={nav} />
              <RailMenu nav={nav} />
            </motion.div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}

function RailHeader({ nav }: { nav: SectionNavConfig }) {
  return (
    <div className="border-sidebar-border flex h-16 shrink-0 flex-col justify-center gap-0.5 border-b px-4">
      {nav.backLink ? (
        <Link
          href={nav.backLink.href}
          className="text-sidebar-foreground/60 hover:text-sidebar-foreground inline-flex w-fit items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3" aria-hidden />
          {nav.backLink.label}
        </Link>
      ) : null}
      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate text-sm font-semibold">{nav.title}</p>
        {nav.status ? <span className="shrink-0">{nav.status}</span> : null}
      </div>
    </div>
  );
}

function RailMenu({ nav }: { nav: SectionNavConfig }) {
  return (
    <nav className="no-scrollbar flex-1 overflow-x-hidden overflow-y-auto py-2">
      <LayoutGroup id="section-rail">
        {nav.groups.map((group, index) => (
          <SidebarGroup key={group.label ?? index} className="py-1">
            {group.label ? (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = item.value === nav.value;
                  return (
                    <SidebarMenuItem key={item.value}>
                      <SidebarMenuButton
                        isActive={active}
                        aria-current={active ? "page" : undefined}
                        onClick={() => nav.onValueChange(item.value)}
                        // The active background is the sliding span below,
                        // not the button's own.
                        className="relative isolate h-9 data-[active=true]:bg-transparent"
                      >
                        {active ? (
                          <motion.span
                            layoutId="section-rail-active"
                            transition={SECTION_NAV_SPRING}
                            className="bg-sidebar-accent absolute inset-0 -z-10 rounded-md"
                          />
                        ) : null}
                        <item.icon />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.dirty ? (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-amber-500"
                            aria-label="Unsaved changes"
                          />
                        ) : null}
                        {item.count !== undefined ? (
                          <span
                            className={cn(
                              "shrink-0 text-xs tabular-nums",
                              active
                                ? "text-sidebar-accent-foreground/70"
                                : "text-sidebar-foreground/50",
                            )}
                          >
                            {item.count}
                          </span>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </LayoutGroup>
    </nav>
  );
}

/**
 * Drops the main sidebar to icon mode while a rail is up and restores it when
 * the rail goes, but only if the rail was what collapsed it. The header
 * trigger still expands it over the rail, and that choice is left alone.
 */
function useCollapseSidebarWhile(present: boolean) {
  const sidebar = useSidebar();
  // Read through a ref: `setOpen` changes identity with `open`, and depending
  // on it would re-run this on every toggle and fight the user.
  const sidebarRef = useRef(sidebar);
  useEffect(() => {
    sidebarRef.current = sidebar;
  });
  const collapsedByRail = useRef(false);

  useEffect(() => {
    const { open, setOpen } = sidebarRef.current;
    if (present) {
      if (open) {
        setOpen(false);
        collapsedByRail.current = true;
      }
    } else if (collapsedByRail.current) {
      collapsedByRail.current = false;
      setOpen(true);
    }
  }, [present]);
}
