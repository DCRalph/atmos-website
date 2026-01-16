import { useEffect, useRef } from "react";
import { useUnsavedChangesDialog } from "~/components/admin/unsaved-changes-provider";

type Options = {
  enabled: boolean;
  message?: string;
};

/**
 * Warn the user when there are unsaved changes and they try to:
 * - close/refresh the tab (beforeunload)
 * - navigate via link clicks / back button (SPA navigation)
 */
export function useUnsavedChangesWarning({
  enabled,
  message = "You have unsaved changes. Are you sure you want to leave?",
}: Options) {
  const { requestNavigation } = useUnsavedChangesDialog();
  const enabledRef = useRef(enabled);
  const messageRef = useRef(message);
  const ignoreNextPopRef = useRef(false);
  const hasSentinelRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Tab close / reload
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!enabledRef.current) return;
      e.preventDefault();
      // Required for Chrome to show a prompt
      e.returnValue = "";
      return "";
    };

    // In-app link navigation
    const onClickCapture = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return; // left click only
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // allow new tab/window

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      // Same-origin only; let the browser handle external URLs (beforeunload will catch if needed)
      let url: URL | null = null;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      e.preventDefault();
      e.stopPropagation();

      requestNavigation(
        { type: "href", href: url.pathname + url.search + url.hash },
        messageRef.current,
      );
    };

    const ensureSentinel = () => {
      if (hasSentinelRef.current) return;
      try {
        window.history.pushState({ __unsaved_sentinel: true }, "", window.location.href);
        hasSentinelRef.current = true;
      } catch {
        // ignore
      }
    };

    const onPopState = () => {
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }

      // If no unsaved changes, let navigation proceed by going back once more.
      if (!enabledRef.current) {
        ignoreNextPopRef.current = true;
        window.history.back();
        return;
      }

      // We landed on the sentinel (same URL). Ask via AlertDialog.
      requestNavigation({ type: "back" }, messageRef.current);

      // Re-arm the sentinel so the user can try again if they cancel.
      // (If they confirm, we ignore the next popstate.)
      ensureSentinel();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("popstate", onPopState);

    // Arm sentinel for back/forward interception when mounted.
    ensureSentinel();

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [requestNavigation]);
}

