"use client";

import { AlertTriangle, Minus, Plus, ShoppingBag } from "lucide-react";
import posthog from "posthog-js";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/react";
import { useMerchCart } from "~/components/merch/merch-cart-provider";
import { formatMoney } from "../cart-sheet";
import { useSite } from "../site-provider";
import { Button, Skeleton } from "../ui";

/** Shared parts for /merch and /merch/[handle]. Products come from the Shopify cache. */

export type Product = RouterOutputs["shopify"]["getProducts"][number];
export type Variant = Product["variants"][number];

export const FALLBACK_IMAGE = "/home/atmos-46.jpg";

export const productHref = (handle: string) =>
  `/merch/${encodeURIComponent(handle)}`;

/** A lone "Default Title" variant means the product has no size to pick. */
export const hasSizes = (p: Product) =>
  !(p.variants.length === 1 && /^default/i.test(p.variants[0]?.title ?? ""));

export const isSoldOut = (p: Product) =>
  !p.variants.some((v) => v.availableForSale);

/** "Sold out", "2XL sold out" or null when every size is in stock. */
export function soldOutNote(p: Product) {
  if (isSoldOut(p)) return "Sold out";
  const out = p.variants.filter((v) => !v.availableForSale).map((v) => v.title);
  return out.length && hasSizes(p) ? `${out.join(", ")} sold out` : null;
}

/**
 * Adds `qty` of a variant to the real cart, toasts with a way into the cart,
 * and records the posthog event the old pages sent.
 */
export function useAddVariant(
  event: "merch_add_to_cart" | "merch_add_to_cart_detail",
) {
  const { addItem } = useMerchCart();
  const { setCartOpen } = useSite();
  return (product: Product, variant: Variant, quantity = 1) => {
    const imageUrl = variant.imageUrl ?? product.image ?? FALLBACK_IMAGE;
    addItem({
      merchandiseId: variant.id,
      quantity,
      productId: product.id,
      productHandle: product.handle,
      productTitle: product.title,
      variantTitle: variant.title,
      imageUrl,
      unitPrice: variant.price,
      currencyCode: variant.currencyCode,
    });
    toast.success(
      hasSizes(product)
        ? `Added ${product.title}, ${variant.title}`
        : `Added ${product.title}`,
      {
        action: { label: "View cart", onClick: () => setCartOpen(true) },
      },
    );
    posthog.capture(event, {
      merch_item_id: product.id,
      merch_item_name: product.title,
      variant_id: variant.id,
      price: variant.price,
      handle: product.handle,
    });
  };
}

/** Size pills. Sold-out sizes are struck through; `allowSoldOut` keeps them selectable. */
export function SizeChips({
  variants,
  value,
  onChange,
  small,
  allowSoldOut,
}: {
  variants: readonly Variant[];
  value: string | null;
  onChange: (variantId: string) => void;
  small?: boolean;
  allowSoldOut?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Size">
      {variants.map((v) => {
        const out = !v.availableForSale;
        const on = value === v.id;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={out ? `${v.title}, sold out` : v.title}
            disabled={out && !allowSoldOut}
            onClick={() => onChange(v.id)}
            className={cn(
              "t-label rounded-full border transition-colors disabled:cursor-not-allowed",
              small
                ? "h-8 min-w-10 px-2.5 text-[10px]"
                : "h-11 min-w-14 px-3 text-[12px]",
              out && "line-through decoration-1",
              on
                ? out
                  ? "border-white/60 bg-white/10 text-white/70"
                  : "border-white bg-white text-black"
                : out
                  ? "border-white/10 text-white/45"
                  : "border-white/20 text-white/80 hover:border-white/50",
            )}
          >
            {v.title}
          </button>
        );
      })}
    </div>
  );
}

export function QtyStepper({
  value,
  onChange,
  max = 10,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  return (
    <div className="inline-flex h-11 items-center rounded-full border border-white/20">
      <button
        type="button"
        aria-label="Fewer"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className="flex size-11 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
      >
        <Minus className="size-4" />
      </button>
      <span
        className="t-display w-6 text-center tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="More"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="flex size-11 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Cart count and total with an open button, for the merch title row. */
export function CartSummary({ className }: { className?: string }) {
  const { totalQuantity, subtotalAmount, currencyCode } = useMerchCart();
  const { setCartOpen } = useSite();
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <p className="text-[14px] text-white/65" aria-live="polite">
        {totalQuantity ? (
          <>
            <span className="text-white tabular-nums">{totalQuantity}</span>{" "}
            {totalQuantity === 1 ? "item" : "items"} ·{" "}
            <span className="text-white tabular-nums">
              {formatMoney(subtotalAmount, currencyCode)}
            </span>
          </>
        ) : (
          "Cart is empty"
        )}
      </p>
      <Button
        size="sm"
        variant={totalQuantity ? "accent" : "outline"}
        onClick={() => setCartOpen(true)}
      >
        <ShoppingBag className="size-3.5" /> Cart
      </Button>
    </div>
  );
}

/** Empty catalog, worded for shoppers. */
export function CatalogEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 border-y border-white/10 px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-white/15">
        <ShoppingBag className="size-5 text-white/60" />
      </span>
      <p className="t-display text-2xl">No products in the catalog yet</p>
      <p className="max-w-[34ch] text-[15px] text-white/60">
        The next drop lands here first.
      </p>
    </div>
  );
}

/** A catalog or product query failed. `onRetry` refetches. */
export function CatalogError({
  onRetry,
  retrying,
  title = "Could not load the merch catalog.",
  message,
}: {
  onRetry: () => void;
  retrying?: boolean;
  title?: string;
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-4 rounded-[var(--site-r-chip)] border border-[var(--site-danger)]/50 bg-white/[0.03] p-5"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[var(--site-danger-text)]" />
      <div className="min-w-0 flex-1">
        <p className="t-label text-[12px] leading-snug">{title}</p>
        <p className="mt-1.5 text-[14px] text-white/70">
          {message ?? "Please try again later."}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-4"
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? "Retrying…" : "Try again"}
        </Button>
      </div>
    </div>
  );
}

/** Rounded skeleton bar for text and controls. */
export function Bone({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded-full", className)} />;
}
