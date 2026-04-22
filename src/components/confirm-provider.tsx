"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
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
import { cn } from "~/lib/utils";

export type ConfirmOptions = {
  title?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

type PendingState = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  const resolvedRef = useRef(false);

  const confirm = useCallback<ConfirmFn>((input) => {
    const options: ConfirmOptions =
      typeof input === "string" ? { description: input } : input;
    return new Promise<boolean>((resolve) => {
      resolvedRef.current = false;
      setPending({ options, resolve });
    });
  }, []);

  const close = (value: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    pending?.resolve(value);
    setPending(null);
  };

  const variant = pending?.options.variant ?? "default";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.options.title ?? "Are you sure?"}
            </AlertDialogTitle>
            {pending?.options.description !== undefined && (
              <AlertDialogDescription asChild>
                <div>{pending.options.description}</div>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {pending?.options.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={cn(
                variant === "destructive" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {pending?.options.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return ctx;
}
