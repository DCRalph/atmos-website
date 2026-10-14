"use client";

import { Fragment, useEffect, useLayoutEffect, useRef } from "react";
import { LayoutGroup, MotionConfig, motion } from "motion/react";

import { cn } from "~/lib/utils";
import { setSectionNav, type SectionNavConfig } from "./store";

export type {
  SectionNavConfig,
  SectionNavGroup,
  SectionNavItem,
} from "./store";

/** The same spring as the Will GPT rail, so the two columns move alike. */
export const SECTION_NAV_SPRING = {
  type: "spring",
  stiffness: 400,
  damping: 40,
} as const;

/**
 * A page's sections. On desktop the admin layout draws them as a rail beside
 * the main sidebar (see SectionRail), so this renders nothing of its own
 * there. Below lg it renders a chip strip that sticks under the header. Put it
 * where the strip should sit: directly above the section content.
 */
export function SectionNav(config: SectionNavConfig) {
  // Re-registered every render so counts, dirty marks and the active value
  // never go stale. A layout effect so the rail and the hidden back link are
  // settled before first paint.
  useLayoutEffect(() => {
    setSectionNav(config);
  });
  useLayoutEffect(() => () => setSectionNav(null), []);

  return <SectionStrip {...config} />;
}

function SectionStrip({
  title,
  groups,
  value,
  onValueChange,
}: SectionNavConfig) {
  const scroller = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // Keep the active chip in view: a deep link can land on the last section,
  // and a Save that fails jumps to the section with the error.
  useEffect(() => {
    const el = scroller.current;
    const chip = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !chip) return;
    const left = chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2;
    el.scrollTo({ left, behavior: mounted.current ? "smooth" : "instant" });
    mounted.current = true;
  }, [value]);

  return (
    <MotionConfig reducedMotion="user">
      <nav
        aria-label={`${title} sections`}
        className="bg-background/90 sticky top-14 z-30 -mx-4 mb-4 border-b backdrop-blur-sm sm:-mx-6 lg:hidden"
      >
        <div
          ref={scroller}
          className="no-scrollbar flex items-center gap-1.5 overflow-x-auto overscroll-x-contain px-4 py-2 sm:px-6"
        >
          <LayoutGroup id="section-strip">
            {groups.map((group, index) => (
              <Fragment key={group.label ?? index}>
                {index > 0 ? (
                  <span
                    aria-hidden
                    className="bg-border mx-1 h-5 w-px shrink-0"
                  />
                ) : null}
                {group.items.map((item) => {
                  const active = item.value === value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => onValueChange(item.value)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative isolate inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                        active
                          ? "border-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="section-strip-active"
                          transition={SECTION_NAV_SPRING}
                          className="bg-foreground absolute inset-0 -z-10 rounded-full"
                        />
                      ) : null}
                      <item.icon className="size-3.5" aria-hidden />
                      {item.label}
                      {item.dirty ? (
                        <span
                          className="size-1.5 rounded-full bg-amber-500"
                          aria-label="Unsaved changes"
                        />
                      ) : null}
                      {item.count !== undefined ? (
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            active
                              ? "text-background/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {item.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </LayoutGroup>
        </div>
      </nav>
    </MotionConfig>
  );
}
