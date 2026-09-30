"use client";

import "~/styles/site.css";

import { useRef } from "react";
import { cn } from "~/lib/utils";
import { siteFontVariables } from "~/lib/site-fonts";
import { ScrollContainerProvider } from "~/components/scroll-container-provider";
import { CartSheet } from "~/components/site/cart-sheet";
import { SiteFooter } from "~/components/site/site-footer";
import { SiteHeader, useHeroRoute } from "~/components/site/site-header";
import { SiteProvider } from "~/components/site/site-provider";

/**
 * Shell for every public page: the `.site` design system, fixed header, footer
 * and cart. Pages scroll inside `#main-layout-container` (components that
 * track scroll read it from ScrollContainerProvider). Pages that open on a
 * full-bleed hero sit under the header; the rest get top padding.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hero = useHeroRoute();

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
        )}
      >
        <SiteProvider>
          <SiteHeader />
          <div className={hero ? undefined : "pt-16 md:pt-20"}>{children}</div>
          <SiteFooter />
          <CartSheet />
        </SiteProvider>
      </div>
    </ScrollContainerProvider>
  );
}
