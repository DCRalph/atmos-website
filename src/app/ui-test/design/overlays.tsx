"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Minus,
  Plus,
  ShoppingBag,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { formatPrice, useBoard } from "./board-state";
import { Button, IconButton, Media } from "./primitives";

/**
 * Glass modal. `side="center"` is a notched panel, `side="right"` a full-height
 * sheet (cart, filters), `side="bottom"` a phone-style sheet. Portals into the
 * board so fonts and accent vars carry through.
 */
export function GlassDialog({
  open,
  onOpenChange,
  title,
  description,
  side = "center",
  trigger,
  children,
  className,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  side?: "center" | "right" | "bottom";
  trigger?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { portalContainer } = useBoard();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal container={portalContainer}>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "mx-glass-dark mx-float fixed z-[71] flex flex-col duration-200 outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            side === "center" &&
              "data-[state=open]:zoom-in-95 top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--mx-r-panel)] rounded-tl-none",
            side === "right" &&
              "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 w-full max-w-[440px] border-y-0 border-r-0",
            side === "bottom" &&
              "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[var(--mx-r-panel)] border-x-0 border-b-0",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
            <div>
              <Dialog.Title className="mx-display text-2xl">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-2 text-[14px] text-white/65">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">
                  {title}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close" className="size-10">
                <X className="size-4" />
              </IconButton>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const DialogClose = Dialog.Close;

/** Cart sheet, opened from any cart button or "View cart" toast. */
export function CartSheet() {
  const {
    cart,
    cartOpen,
    setCartOpen,
    cartTotal,
    cartCount,
    setCartQty,
    removeFromCart,
    toast,
  } = useBoard();
  return (
    <GlassDialog
      open={cartOpen}
      onOpenChange={setCartOpen}
      title="Cart"
      side="right"
      description={
        cartCount
          ? `${cartCount} ${cartCount === 1 ? "item" : "items"}`
          : undefined
      }
    >
      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
          <ShoppingBag className="size-10 text-white/30" />
          <p className="mx-display text-xl">Nothing in here yet</p>
          <p className="max-w-[30ch] text-[14px] text-white/60">
            Tees and drops live in Merch. Pick a size and it lands here.
          </p>
          <DialogClose asChild>
            <Button variant="outline">Browse merch</Button>
          </DialogClose>
        </div>
      ) : (
        <>
          <ul className="flex-1 overflow-y-auto">
            {cart.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[72px_1fr_auto] gap-4 border-b border-white/10 p-5"
              >
                <Media
                  src={item.image}
                  alt=""
                  sizes="72px"
                  className="aspect-[4/5]"
                />
                <div className="min-w-0">
                  <p className="mx-display truncate text-base">{item.name}</p>
                  <p className="mt-1.5 text-[13px] text-white/60">
                    {item.colour} · {item.size}
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="inline-flex h-9 items-center rounded-full border border-white/20">
                      <button
                        type="button"
                        aria-label="Fewer"
                        onClick={() => setCartQty(item.id, item.qty - 1)}
                        className="flex size-9 items-center justify-center text-white/70 hover:text-white"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span
                        className="mx-display mx-num w-4 text-center text-sm"
                        aria-live="polite"
                      >
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        aria-label="More"
                        disabled={item.qty >= 5}
                        onClick={() => setCartQty(item.id, item.qty + 1)}
                        className="flex size-9 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="text-[13px] text-white/60 underline underline-offset-4 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <p className="mx-display mx-num text-base">
                  {formatPrice(item.price * item.qty)}
                </p>
              </li>
            ))}
          </ul>
          <div className="space-y-4 border-t border-white/10 p-5">
            <div className="flex items-baseline justify-between">
              <span className="mx-label text-[12px] text-white/70">
                Subtotal
              </span>
              <span className="mx-display mx-num text-2xl">
                {formatPrice(cartTotal)}
              </span>
            </div>
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              onClick={() => {
                setCartOpen(false);
                toast({
                  title: "Checkout is Shopify's page, not mocked here",
                  tone: "info",
                });
              }}
            >
              Checkout
            </Button>
            <p className="text-center text-[13px] text-white/55">
              Shipping calculated at checkout
            </p>
          </div>
        </>
      )}
    </GlassDialog>
  );
}

const toneIcon = {
  success: {
    Icon: Check,
    className: "bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]",
  },
  error: { Icon: X, className: "bg-[#ff6b6b] text-black" },
  info: { Icon: Info, className: "bg-white text-black" },
};

/** Bottom-right stack; newest on top, auto-dismissed by the board store. */
export function ToastViewport() {
  const { toasts, dismissToast, cartOpen } = useBoard();
  return (
    <ol
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed right-3 z-[80] flex w-[calc(100vw-1.5rem)] max-w-[400px] flex-col gap-2 md:right-6",
        // Keep clear of the cart sheet's checkout button while it's open.
        cartOpen
          ? "top-3 md:top-auto md:right-[464px] md:bottom-6"
          : "bottom-3 md:bottom-6",
      )}
    >
      {toasts.map((t) => {
        const { Icon, className } = toneIcon[t.tone];
        return (
          <li
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "mx-glass-dark mx-float animate-in fade-in-0 slide-in-from-bottom-2 pointer-events-auto flex items-center gap-3 rounded-full py-2 pr-2 pl-3 duration-200",
              t.tone === "error" && "border-[#ff6b6b]/50",
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full",
                className,
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <p className="min-w-0 flex-1 truncate text-[14px]">{t.title}</p>
            {t.action ? (
              <Button
                size="sm"
                onClick={() => {
                  t.action?.run();
                  dismissToast(t.id);
                }}
              >
                {t.action.label}
              </Button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismissToast(t.id)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Full-screen image viewer. Arrow keys step, Escape closes (Radix). Images
 * are contained, never cropped, so posters read in full.
 */
export function Lightbox({
  images,
  index,
  onIndexChange,
}: {
  images: readonly { src: string; alt: string }[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const { portalContainer } = useBoard();
  const current = index === null ? undefined : images[index];
  const step = (dir: 1 | -1) =>
    index !== null &&
    onIndexChange((index + dir + images.length) % images.length);

  return (
    <Dialog.Root
      open={index !== null}
      onOpenChange={(open) => !open && onIndexChange(null)}
    >
      <Dialog.Portal container={portalContainer}>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-[70] bg-black/90 backdrop-blur-md" />
        <Dialog.Content
          className="fixed inset-0 z-[71] flex flex-col outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
        >
          <div className="flex items-center justify-between p-4 md:p-6">
            <Dialog.Title className="mx-label mx-num text-[12px] text-white/70">
              {index === null ? "" : `${index + 1} / ${images.length}`}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Use the arrow keys to move between images.
            </Dialog.Description>
            <Dialog.Close asChild>
              <IconButton label="Close viewer">
                <X className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="relative flex-1">
            {current ? (
              <Image
                key={current.src}
                src={current.src}
                alt={current.alt}
                fill
                sizes="100vw"
                unoptimized={current.src.endsWith(".gif")}
                className="animate-in fade-in-0 object-contain duration-200"
              />
            ) : null}
            {images.length > 1 ? (
              <>
                <IconButton
                  label="Previous image"
                  onClick={() => step(-1)}
                  className="absolute top-1/2 left-3 -translate-y-1/2 md:left-6"
                >
                  <ChevronLeft className="size-5" />
                </IconButton>
                <IconButton
                  label="Next image"
                  onClick={() => step(1)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 md:right-6"
                >
                  <ChevronRight className="size-5" />
                </IconButton>
              </>
            ) : null}
          </div>
          <p className="p-4 text-center text-[14px] text-white/70 md:p-6">
            {current?.alt}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Convenience state for a lightbox: returns [index, open(i), props]. */
export function useLightbox() {
  const [index, setIndex] = useState<number | null>(null);
  return {
    index,
    open: setIndex,
    props: { index, onIndexChange: setIndex },
  } as const;
}
