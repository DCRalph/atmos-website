"use client";

import { useState } from "react";
import { AlertTriangle, Minus, Plus, ShoppingBag } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatPrice, useBoard } from "../board-state";
import { merch, sizes } from "../fixtures";
import { Button } from "../primitives";

/**
 * Shared data and small parts for the /merch and /merch/[handle] drafts.
 * Products are the four real tees; which sizes are sold out is illustrative.
 */

export type Size = (typeof sizes)[number];

export type Product = {
  handle: string;
  name: string;
  colour: string;
  price: number;
  image: string;
  soldOut: readonly Size[];
};

// Illustrative stock so every layout has to show a sold-out size.
const soldOutSizes: Record<string, readonly Size[]> = {
  "guys-staple-tee-black": ["2XL"],
  "guys-staple-tee-white": ["XS", "2XL"],
  "girls-staple-tee-white": ["XS"],
};

const slug = (s: string) => s.toLowerCase().replace(/\W+/g, "-");

export const products: readonly Product[] = merch.map((p) => {
  const handle = slug(`${p.name} ${p.colour}`);
  return { ...p, handle, soldOut: soldOutSizes[handle] ?? [] };
});

export const isSoldOut = (p: Product) => p.soldOut.length === sizes.length;

/** The catalog for a page state: "sold-out" empties the last tee completely. */
export const catalogFor = (state: string): readonly Product[] =>
  state === "sold-out"
    ? products.map((p, i) =>
        i === products.length - 1 ? { ...p, soldOut: sizes } : p,
      )
    : products;

/**
 * A product page groups one cut across colours, so the colour swatches double
 * as the gallery. Descriptions are placeholders; real copy comes from Shopify.
 */
export type Style = {
  handle: string;
  name: string;
  price: number;
  description: string;
  colours: readonly {
    colour: string;
    image: string;
    soldOut: readonly Size[];
  }[];
};

const descriptions: Record<string, string> = {
  "Guys staple tee": "Relaxed fit tee with a small Atmos logo on the chest.",
  "Girls staple tee": "Regular fit tee with a small Atmos logo on the chest.",
};

export const styles: readonly Style[] = [
  ...new Set(products.map((p) => p.name)),
].map((name) => {
  const group = products.filter((p) => p.name === name);
  return {
    handle: slug(name),
    name,
    price: group[0]?.price ?? 0,
    description: descriptions[name] ?? "",
    colours: group.map(({ colour, image, soldOut }) => ({
      colour,
      image,
      soldOut,
    })),
  };
});

/** Size pills. Sold-out sizes are struck through; `allowSoldOut` keeps them selectable. */
export function SizeChips({
  value,
  onChange,
  soldOut,
  small,
  allowSoldOut,
}: {
  value: Size | null;
  onChange: (s: Size) => void;
  soldOut: readonly Size[];
  small?: boolean;
  allowSoldOut?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Size">
      {sizes.map((s) => {
        const out = soldOut.includes(s);
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            aria-label={out ? `${s}, sold out` : s}
            disabled={out && !allowSoldOut}
            onClick={() => onChange(s)}
            className={cn(
              "mx-label rounded-full border transition-colors disabled:cursor-not-allowed",
              small
                ? "h-8 min-w-10 px-2.5 text-[10px]"
                : "h-11 min-w-14 px-3 text-[12px]",
              out && "line-through decoration-1",
              value === s
                ? out
                  ? "border-white/60 bg-white/10 text-white/70"
                  : "border-white bg-white text-black"
                : out
                  ? "border-white/10 text-white/45"
                  : "border-white/20 text-white/80 hover:border-white/50",
            )}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

export function QtyStepper({
  value,
  onChange,
  max = 5,
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
      <span className="mx-display mx-num w-6 text-center" aria-live="polite">
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

/**
 * Adds `qty` of one variant to the shared cart with a single toast. The board
 * only adds one at a time, so the rest is set on the line it just made (its id
 * is name-colour-size, as in board-state).
 */
export function useAddVariant() {
  const { addToCart, setCartQty, cart } = useBoard();
  return (
    item: {
      name: string;
      colour: string;
      size: Size;
      price: number;
      image: string;
    },
    qty = 1,
  ) => {
    const id = `${item.name}-${item.colour}-${item.size}`;
    const existing = cart.find((i) => i.id === id)?.qty ?? 0;
    addToCart(item);
    if (qty > 1) setCartQty(id, existing + qty);
  };
}

/** Cart count and total with an open button, for page headers. */
export function CartSummary({ className }: { className?: string }) {
  const { cartCount, cartTotal, setCartOpen } = useBoard();
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <p className="text-[14px] text-white/65" aria-live="polite">
        {cartCount ? (
          <>
            <span className="mx-num text-white">{cartCount}</span>{" "}
            {cartCount === 1 ? "item" : "items"} ·{" "}
            <span className="mx-num text-white">{formatPrice(cartTotal)}</span>
          </>
        ) : (
          "Cart is empty"
        )}
      </p>
      <Button
        size="sm"
        variant={cartCount ? "accent" : "outline"}
        onClick={() => setCartOpen(true)}
      >
        <ShoppingBag className="size-3.5" /> Cart
      </Button>
    </div>
  );
}

/** Empty catalog. The live copy points visitors at the admin sync; this speaks to shoppers. */
export function CatalogEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 border-y border-white/10 px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-white/15">
        <ShoppingBag className="size-5 text-white/60" />
      </span>
      <p className="mx-display text-2xl">No products in the catalog yet</p>
      <p className="max-w-[34ch] text-[15px] text-white/60">
        The next drop lands here first.
      </p>
    </div>
  );
}

/** Catalog failed to load. Retry flips the draft to its loaded state. */
export function CatalogError({
  onRetry,
  title = "Could not load the merch catalog.",
}: {
  onRetry: () => void;
  title?: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-4 rounded-[var(--mx-r-chip)] border border-[#ff6b6b]/50 bg-white/[0.03] p-5"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#ff8a8a]" />
      <div className="min-w-0 flex-1">
        <p className="mx-label text-[12px]">{title}</p>
        <p className="mt-1.5 text-[14px] text-white/70">
          Please try again later.
        </p>
        <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

/** Page state that a retry can move on from. Drafts are remounted per state. */
export function useRetryableState(state: string) {
  const [current, setCurrent] = useState(state);
  return [current, () => setCurrent("loaded")] as const;
}

/** Static skeleton bar. No shimmer. */
export function Bone({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("rounded-full bg-white/[0.07]", className)}
    />
  );
}
