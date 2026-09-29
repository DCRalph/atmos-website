"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Plus, ShoppingBag } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatPrice, useBoard } from "../board-state";
import { merch, sizes } from "../fixtures";
import { Button, Media, VariantTag } from "../primitives";

type Product = (typeof merch)[number];

function SizeChips({
  value,
  onChange,
  small,
}: {
  value: string | null;
  onChange: (s: string) => void;
  small?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Size">
      {sizes.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          disabled={s === "2XL"}
          title={s === "2XL" ? "Out of stock" : undefined}
          onClick={() => onChange(s)}
          className={cn(
            "mx-label rounded-full border transition-colors disabled:line-through disabled:opacity-35",
            small
              ? "h-8 min-w-10 px-2.5 text-[10px]"
              : "h-10 min-w-12 px-3 text-[11px]",
            value === s
              ? "border-white bg-white text-black"
              : "border-white/20 text-white/80 hover:border-white/50",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/** A: hard product image, info and sizes below on black. */
function ProductOpen({ product }: { product: Product }) {
  const { addToCart } = useBoard();
  const [size, setSize] = useState<string | null>(null);
  return (
    <article className="flex flex-col">
      <Media
        src={product.image}
        alt={`${product.name} in ${product.colour}`}
        sizes="(min-width: 1024px) 25vw, 50vw"
        className="aspect-[4/5]"
      />
      <div className="flex items-baseline justify-between gap-4 pt-4">
        <h3 className="mx-display text-lg">{product.name}</h3>
        <p className="mx-display mx-num text-lg">
          {formatPrice(product.price)}
        </p>
      </div>
      <p className="mt-1.5 text-[13px] text-white/60">{product.colour}</p>
      <div className="mt-4">
        <SizeChips value={size} onChange={setSize} small />
      </div>
      <Button
        className="mt-4 w-full"
        disabled={!size}
        onClick={() => {
          if (!size) return;
          addToCart({
            name: product.name,
            colour: product.colour,
            size,
            price: product.price,
            image: product.image,
          });
          setSize(null);
        }}
      >
        {size ? `Add ${size} to cart` : "Pick a size"}
      </Button>
    </article>
  );
}

/** B: glass plate over the product shot; the + opens a size popover. */
function ProductPlate({ product }: { product: Product }) {
  const { addToCart, portalContainer } = useBoard();
  const [open, setOpen] = useState(false);
  return (
    <article className="group relative aspect-[4/5] overflow-hidden">
      <Media
        src={product.image}
        alt={`${product.name} in ${product.colour}`}
        sizes="(min-width: 1024px) 25vw, 50vw"
        className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      />
      <div className="mx-glass-dark absolute inset-x-2.5 bottom-2.5 flex items-center gap-3 rounded-xl p-3 pl-4">
        <div className="min-w-0 flex-1">
          <h3 className="mx-display truncate text-base">{product.name}</h3>
          <p className="mt-1 text-[13px] text-white/70">
            {product.colour} ·{" "}
            <span className="mx-num">{formatPrice(product.price)}</span>
          </p>
        </div>
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label={`Add ${product.name} ${product.colour}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-[var(--mx-accent)] hover:text-[var(--mx-accent-ink)] data-[state=open]:bg-[var(--mx-accent)] data-[state=open]:text-[var(--mx-accent-ink)]"
            >
              <Plus className="size-5" />
            </button>
          </Popover.Trigger>
          <Popover.Portal container={portalContainer}>
            <Popover.Content
              side="top"
              align="end"
              sideOffset={10}
              className="mx-glass-dark mx-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-[90] w-[260px] rounded-[var(--mx-r-panel)] rounded-br-none p-4 outline-none"
            >
              <p className="mx-label mb-3 text-[11px]">Pick a size</p>
              <SizeChips
                small
                value={null}
                onChange={(size) => {
                  addToCart({
                    name: product.name,
                    colour: product.colour,
                    size,
                    price: product.price,
                    image: product.image,
                  });
                  setOpen(false);
                }}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </article>
  );
}

function CartBar() {
  const { cartCount, cartTotal, setCartOpen } = useBoard();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-y border-white/10 px-5 py-4 md:px-10">
      <p className="text-[15px] text-white/75" aria-live="polite">
        {cartCount ? (
          <>
            <span className="mx-num">{cartCount}</span>{" "}
            {cartCount === 1 ? "item" : "items"} ·{" "}
            <span className="mx-num text-white">{formatPrice(cartTotal)}</span>
          </>
        ) : (
          "Cart is empty. Add a tee above."
        )}
      </p>
      <Button
        variant={cartCount ? "accent" : "outline"}
        onClick={() => setCartOpen(true)}
      >
        <ShoppingBag className="size-4" /> Open cart
      </Button>
    </div>
  );
}

export function MerchSection() {
  return (
    <div className="space-y-14 pb-16">
      <div>
        <VariantTag>Product A · pick a size, then add</VariantTag>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 px-5 md:px-10 lg:grid-cols-4 lg:gap-x-6">
          {merch.map((p) => (
            <ProductOpen key={p.image} product={p} />
          ))}
        </div>
      </div>
      <div>
        <VariantTag>Product B · quick add from a size popover</VariantTag>
        <div className="grid grid-cols-2 gap-4 px-5 md:px-10 lg:grid-cols-4 lg:gap-6">
          {merch.map((p) => (
            <ProductPlate key={p.image} product={p} />
          ))}
        </div>
      </div>
      <div>
        <VariantTag>Cart · shared with the nav badge and toasts</VariantTag>
        <CartBar />
      </div>
    </div>
  );
}
