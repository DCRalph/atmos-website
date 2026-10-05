"use client";

import "~/styles/site.css";

import { useRef, type ComponentProps } from "react";
import { cn } from "~/lib/utils";
import { siteFontVariables } from "~/lib/site-fonts";
import { ScrollContainerProvider } from "~/components/scroll-container-provider";
import { CartSheet } from "./cart-sheet";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SiteProvider } from "./site-provider";

/**
 * Shell for a public page: the `.site` design system, fixed header, footer
 * and cart. Pages scroll inside `#main-layout-container` (components that
 * track scroll read it from ScrollContainerProvider). `padTop` clears the
 * header for pages that don't open on a full-bleed hero. Extra props land on
 * the scroll container, which is how creator profiles set their theme.
 */
export function SiteShell({
  children,
  padTop,
  tone = "dark",
  className,
  ...rest
}: Omit<ComponentProps<"div">, "ref"> & {
  padTop?: boolean;
  tone?: "dark" | "light";
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <ScrollContainerProvider scrollRef={scrollRef}>
      <div
        ref={scrollRef}
        id="main-layout-container"
        className={cn(
          // `relative` makes this the containing block for every absolutely
          // positioned descendant (sr-only labels included). Without it they
          // anchor to the document and give the page a second scrollbar.
          "site relative h-dvh w-full overflow-x-hidden overflow-y-scroll",
          siteFontVariables,
          className,
        )}
        {...rest}
      >
        <SiteProvider>
          <SiteHeader tone={tone} />
          <div className={padTop ? "pt-16 md:pt-20" : undefined}>
            {children}
          </div>
          <SiteFooter />
          <CartSheet />
        </SiteProvider>
      </div>
    </ScrollContainerProvider>
  );
}
