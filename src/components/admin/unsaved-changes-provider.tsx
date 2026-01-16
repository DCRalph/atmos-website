"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

type PendingNavigation =
  | { type: "href"; href: string }
  | { type: "back" };

type UnsavedChangesContextValue = {
  /**
   * Ask the user via an AlertDialog. If confirmed, perform the navigation.
   */
  requestNavigation: (nav: PendingNavigation, message?: string) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(
  null,
);

export function useUnsavedChangesDialog() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error(
      "useUnsavedChangesDialog must be used within UnsavedChangesProvider",
    );
  }
  return ctx;
}

export function UnsavedChangesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(
    "You have unsaved changes. Are you sure you want to leave?",
  );
  const pendingRef = useRef<PendingNavigation | null>(null);

  const requestNavigation = useCallback(
    (nav: PendingNavigation, nextMessage?: string) => {
      pendingRef.current = nav;
      if (nextMessage) setMessage(nextMessage);
      setOpen(true);
    },
    [],
  );

  const onCancel = useCallback(() => {
    pendingRef.current = null;
    setOpen(false);
  }, []);

  const onConfirm = useCallback(() => {
    const nav = pendingRef.current;
    pendingRef.current = null;
    setOpen(false);

    if (!nav) return;
    if (nav.type === "href") {
      router.push(nav.href);
    } else if (nav.type === "back") {
      // Let the browser handle the back navigation
      // (the unsaved-changes hook will ignore the resulting popstate)
      window.history.back();
    }
  }, [router]);

  const value = useMemo<UnsavedChangesContextValue>(
    () => ({ requestNavigation }),
    [requestNavigation],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>{message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancel}>Stay</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>
              Leave page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  );
}

