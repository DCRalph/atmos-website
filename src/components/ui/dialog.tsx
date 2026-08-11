"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "~/lib/utils";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Tracks whether a scroll container has content hidden above/below the
 * viewport, so the body can draw a divider and the cut-off edge reads as "there
 * is more here" rather than "this dialog is broken".
 */
function useScrollEdges(ref: React.RefObject<HTMLElement | null>) {
  const [edges, setEdges] = React.useState({ up: false, down: false });

  const sync = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const up = el.scrollTop > 1;
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((prev) =>
      prev.up === up && prev.down === down ? prev : { up, down },
    );
  }, [ref]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      observer?.disconnect();
    };
  }, [ref, sync]);

  // Dialog bodies grow and shrink with state (a section expands, a list gains a
  // row), and the container itself never resizes when that happens — so
  // re-measure after every commit instead of relying on the observer alone.
  React.useEffect(sync);

  return edges;
}

/**
 * The scrolling middle of a dialog. Put the long part of a dialog in here and
 * the header/footer stay pinned while it scrolls; without it `DialogContent`
 * wraps everything in one of these automatically.
 *
 * `inset` pulls the scrollbar out to the dialog edge with a negative margin
 * while the content keeps its padding — which only lines up on a dialog with
 * the default `p-6`. The automatic wrapper turns it off, since it has no say
 * over the padding of the dialog it is wrapping.
 */
function DialogBody({
  className,
  ref,
  inset = true,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const { up, down } = useScrollEdges(innerRef);

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  return (
    <div
      data-slot="dialog-body"
      ref={setRefs}
      className={cn(
        "min-h-0 overflow-x-hidden overflow-y-auto border-y border-transparent",
        inset && "-mx-6 px-6",
        up && "border-t-border/70",
        down && "border-b-border/70",
        className,
      )}
      {...props}
    />
  );
}

/**
 * True when the dialog supplies its own <DialogBody>. Conditionals and
 * fragments are common around dialog bodies, so look through those — but not
 * through component boundaries, whose output we cannot inspect from here.
 */
function containsDialogBody(children: React.ReactNode, depth = 0): boolean {
  if (depth > 4) return false;
  let found = false;
  React.Children.forEach(children, (child) => {
    if (found || !React.isValidElement(child)) return;
    if (child.type === DialogBody) {
      found = true;
    } else if (child.type === React.Fragment) {
      const fragmentChildren = (child.props as { children?: React.ReactNode })
        .children;
      found = containsDialogBody(fragmentChildren, depth + 1);
    }
  });
  return found;
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  scrollable = true,
  bodyClassName,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  /**
   * Set false for a dialog that manages its own scrolling and must not be
   * height-capped by the automatic scroll container.
   */
  scrollable?: boolean;
  /** Classes for the automatic scroll region. Ignored when a <DialogBody> is supplied. */
  bodyClassName?: string;
}) {
  // No explicit body: wrap the whole dialog so a tall one scrolls instead of
  // running off the screen. Header and footer scroll with it, which is the
  // right trade for dialogs that were never laid out for it.
  const autoScroll = scrollable && !containsDialogBody(children);

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          scrollable && "max-h-[calc(100dvh-2rem)]",
          className,
        )}
        {...props}
      >
        {autoScroll ? (
          <DialogBody
            inset={false}
            className={cn("flex flex-col gap-4", bodyClassName)}
          >
            {children}
          </DialogBody>
        ) : (
          children
        )}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex shrink-0 flex-col gap-2 text-center sm:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
