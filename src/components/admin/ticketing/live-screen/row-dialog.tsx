"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { X } from "lucide-react";

import { boxOf, EASE, isTopLayer, px, stillPlease } from "./expand";

/**
 * A dialog that grows out of the row that opened it, for digging into one
 * scan, order or tier without leaving the live screen. One is open at a
 * time, and it belongs to the screen rather than the row: the feeds turn
 * over, and a dialog mustn't vanish because its row scrolled off the list.
 *
 * Opening from inside a dialog swaps what it shows in place. Closing shrinks
 * it back to the row if the row is still there, and fades it out if not.
 */

/** What a row opens. The content fetches its own data, by id. */
export type RowDialogSpec = {
  /** Names the dialog for a screen reader. */
  label: string;
  content: ReactNode;
};

type Open = (spec: RowDialogSpec, from?: HTMLElement | null) => void;

const OpenContext = createContext<Open | null>(null);
const CloseContext = createContext<() => void>(() => undefined);

/** Opens a row dialog, or null where there's no live screen to hold one. */
export const useOpenRowDialog = () => useContext(OpenContext);
/** Closes the dialog the caller is inside. */
export const useCloseRowDialog = () => useContext(CloseContext);

/**
 * The props that make a row open its dialog, or none when it has nothing to
 * open. Spread onto the row's own element.
 */
export function rowOpens(open: Open | null, spec: RowDialogSpec | undefined) {
  if (!open || !spec) return {};
  return {
    tabIndex: 0,
    "aria-haspopup": "dialog" as const,
    onClick: (e: ReactMouseEvent<HTMLElement>) => open(spec, e.currentTarget),
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      open(spec, e.currentTarget);
    },
  };
}

/** The look of a row that opens something. */
export const ROW_OPENS =
  "cursor-pointer outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50";

const GROW_MS = 380;

export function RowDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    spec: RowDialogSpec;
    from: HTMLElement | null;
    /** Where it's drawn: inside the screen's dark wrapper, to keep its theme. */
    host: Element;
  } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  const open = useCallback<Open>((spec, from = null) => {
    setState((current) =>
      // From inside the dialog: the same box, showing something else.
      current
        ? { ...current, spec }
        : {
            spec,
            from,
            host: from?.closest(".dark") ?? document.body,
          },
    );
  }, []);

  const mounted = state !== null;
  const from = state?.from ?? null;

  // The grow, once the box is in place at its open size.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!mounted || !box) return;
    closing.current = false;
    const duration = stillPlease() ? 0 : GROW_MS;
    if (from?.isConnected) {
      box.animate([{ ...px(boxOf(from)), offset: 0 }], {
        duration,
        easing: EASE,
      });
    } else {
      box.animate([{ opacity: 0, transform: "scale(0.97)" }, {}], {
        duration,
        easing: EASE,
      });
    }
    innerRef.current?.animate(
      [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }],
      { duration },
    );
    backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration,
    });
    box.focus({ preventScroll: true });
  }, [mounted, from]);

  const close = useCallback(() => {
    const box = boxRef.current;
    if (!box || closing.current) return;
    closing.current = true;
    const now = boxOf(box);
    const duration = stillPlease() ? 0 : GROW_MS;
    const timing = { duration, fill: "forwards" } as const;
    for (const el of [box, innerRef.current, backdropRef.current]) {
      el?.getAnimations().forEach((animation) => animation.cancel());
    }
    // The content goes first, then the box shrinks onto its row and fades
    // into it, so nothing is left to pop when it's taken away.
    innerRef.current?.animate(
      [{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }],
      timing,
    );
    backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], timing);
    const shrink = from?.isConnected
      ? box.animate(
          [
            { ...px(now), opacity: 1 },
            { opacity: 1, offset: 0.55 },
            { ...px(boxOf(from)), opacity: 0 },
          ],
          { ...timing, easing: EASE },
        )
      : box.animate([{ opacity: 1 }, { opacity: 0 }], timing);
    shrink.onfinish = () => {
      flushSync(() => setState(null));
      if (from?.isConnected) from.focus({ preventScroll: true });
    };
  }, [from]);

  // Esc closes this and nothing behind it, and the page behind stays put.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isTopLayer(e, boxRef.current)) return;
      e.stopPropagation();
      close();
    };
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      root.style.overflow = overflow;
    };
  }, [mounted, close]);

  return (
    <OpenContext.Provider value={open}>
      {children}
      {state
        ? createPortal(
            <CloseContext.Provider value={close}>
              <div
                ref={backdropRef}
                className="fixed inset-0 z-50 bg-black/65"
                onClick={close}
                aria-hidden
              />
              <div
                ref={boxRef}
                role="dialog"
                aria-modal
                aria-label={state.spec.label}
                tabIndex={-1}
                className="bg-background text-foreground fixed top-2 left-2 z-50 h-[calc(100%-1rem)] w-[calc(100%-1rem)] overflow-hidden rounded-xl border outline-none sm:top-[9vh] sm:left-[max(0.75rem,calc(50%-336px))] sm:h-[82vh] sm:w-[min(672px,calc(100%-1.5rem))]"
              >
                {/* Held at the open width, so nothing reflows as it grows. */}
                <div
                  ref={innerRef}
                  className="flex h-full w-[calc(100vw-1rem-2px)] flex-col sm:w-[min(670px,calc(100vw-1.5rem-2px))]"
                >
                  {state.spec.content}
                </div>
              </div>
            </CloseContext.Provider>,
            state.host,
          )
        : null}
    </OpenContext.Provider>
  );
}

/**
 * A row dialog's layout: who or what it's about on top, a body that
 * scrolls, and the actions pinned along the bottom.
 */
export function DialogFrame({
  title,
  sub,
  state,
  footer,
  children,
}: {
  title: ReactNode;
  /** The line under the title: a ticket number, an order's summary. */
  sub?: ReactNode;
  /** Where things stand right now, in its own colour. */
  state?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const close = useCloseRowDialog();
  return (
    <>
      <header className="flex items-start justify-between gap-3 border-b px-4 pt-4 pb-3">
        <div className="min-w-0">
          <p className="truncate text-lg leading-tight font-bold tracking-tight">
            {title}
          </p>
          {sub ? (
            <p className="text-muted-foreground mt-0.5 truncate text-sm">
              {sub}
            </p>
          ) : null}
          {state ? <p className="mt-1.5 text-sm font-medium">{state}</p> : null}
        </div>
        <button
          type="button"
          onClick={close}
          className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded-md border p-1.5 transition-colors"
          aria-label="Close"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-4 text-sm">
        {children}
      </div>
      {footer ? (
        <footer className="border-t px-4 py-3 text-sm">{footer}</footer>
      ) : null}
    </>
  );
}
