"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type SiteContext = {
  /** Overlays portal here, inside `.site`, so they keep its fonts and tokens. */
  portalContainer: HTMLElement | null;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
};

const Context = createContext<SiteContext | null>(null);

export function useSite() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSite must be used inside <SiteProvider>");
  return ctx;
}

/** Shell state for the public site. Renders the portal target itself. */
export function SiteProvider({ children }: { children: ReactNode }) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <Context.Provider value={{ portalContainer, cartOpen, setCartOpen }}>
      {children}
      <div ref={setPortalContainer} />
    </Context.Provider>
  );
}
