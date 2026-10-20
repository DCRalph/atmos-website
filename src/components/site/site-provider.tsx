"use client";

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const HIDDEN_EVENTS_STORAGE_KEY = "atmos_show_hidden_events";

const noSubscribe = () => () => {
  // Toggle changes are handled by local React state.
};

function readSavedHiddenEvents() {
  try {
    return window.localStorage.getItem(HIDDEN_EVENTS_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

type SiteContext = {
  /** Overlays portal here, inside `.site`, so they keep its fonts and tokens. */
  portalContainer: HTMLElement | null;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  /** Admin preference for home and gigs lists; saved locally across visits. */
  showHiddenEvents: boolean;
  setShowHiddenEvents: (show: boolean) => void;
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
  // Restore after hydration; local state keeps the toggle usable if saving fails.
  const savedHiddenEvents = useSyncExternalStore(
    noSubscribe,
    readSavedHiddenEvents,
    () => true,
  );
  const [hiddenEventsOverride, setHiddenEvents] = useState<boolean>();
  const showHiddenEvents = hiddenEventsOverride ?? savedHiddenEvents;

  const setShowHiddenEvents = (show: boolean) => {
    setHiddenEvents(show);
    try {
      window.localStorage.setItem(HIDDEN_EVENTS_STORAGE_KEY, String(show));
    } catch {
      // The toggle still works in memory when browser storage is unavailable.
    }
  };

  return (
    <Context.Provider
      value={{
        portalContainer,
        cartOpen,
        setCartOpen,
        showHiddenEvents,
        setShowHiddenEvents,
      }}
    >
      {children}
      <div ref={setPortalContainer} />
    </Context.Provider>
  );
}
