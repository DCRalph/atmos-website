"use client";

import { useState } from "react";
import { ArrowLeft, Check, Expand, SearchX } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatPrice, useBoard } from "../board-state";
import { Lightbox, useLightbox } from "../overlays";
import { Button, IconButton, Media } from "../primitives";
import {
  Bone,
  CatalogError,
  products,
  QtyStepper,
  SizeChips,
  styles,
  useAddVariant,
  useRetryableState,
  type Size,
} from "./merch-kit";
import type { PageSpec } from "./types";

const style = styles[0]!;

/**
 * Everything a product page draft needs: the page view (after retries), the
 * picked colour, size and quantity, and add / buy now with their feedback.
 */
function useProduct(state: string) {
  const { toast, setCartOpen } = useBoard();
  const addVariant = useAddVariant();
  const [view, retry] = useRetryableState(state);
  const [colour, setColourState] = useState(
    style.colours[state === "sold-out" ? 1 : 0]?.colour ?? "",
  );
  const [size, setSizeState] = useState<Size | null>(
    state === "sold-out"
      ? "2XL"
      : state === "added" || state === "checkout"
        ? "M"
        : null,
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(state === "added");
  const [busy, setBusy] = useState(state === "checkout");

  const current =
    style.colours.find((c) => c.colour === colour) ?? style.colours[0]!;
  const soldOut = size !== null && current.soldOut.includes(size);
  const canBuy = size !== null && !soldOut && !busy;
  const item = size
    ? {
        name: style.name,
        colour: current.colour,
        size,
        price: style.price,
        image: current.image,
      }
    : null;

  return {
    view,
    retry,
    current,
    size,
    qty,
    setQty,
    soldOut,
    canBuy,
    added,
    busy,
    openCart: () => setCartOpen(true),
    setColour: (c: string) => {
      setColourState(c);
      setAdded(false);
    },
    setSize: (s: Size) => {
      setSizeState(s);
      setAdded(false);
    },
    add: () => {
      if (!item || !canBuy) return;
      addVariant(item, qty);
      setAdded(true);
    },
    buyNow: () => {
      if (!canBuy) return;
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        toast({
          title: "Checkout is Shopify's page, not mocked here",
          tone: "info",
        });
      }, 1400);
    },
  };
}
type ProductState = ReturnType<typeof useProduct>;

function BackLink({ className }: { className?: string }) {
  return (
    <a
      href="#"
      className={cn(
        "mx-label inline-flex h-10 items-center gap-2 text-[11px] text-white/70 hover:text-white",
        className,
      )}
    >
      <ArrowLeft className="size-4" /> Back to merch
    </a>
  );
}

/** Colour pills with a swatch dot. */
function ColourPicker({ p }: { p: ProductState }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
      {style.colours.map((c) => (
        <button
          key={c.colour}
          type="button"
          role="radio"
          aria-checked={p.current.colour === c.colour}
          onClick={() => p.setColour(c.colour)}
          className={cn(
            "mx-label inline-flex h-11 items-center gap-2.5 rounded-full border pr-5 pl-3 text-[12px] transition-colors",
            p.current.colour === c.colour
              ? "border-white text-white"
              : "border-white/20 text-white/70 hover:border-white/50",
          )}
        >
          <span
            className={cn(
              "size-4 rounded-full border border-white/40",
              c.colour === "White" ? "bg-white" : "bg-black",
            )}
          />
          {c.colour}
        </button>
      ))}
    </div>
  );
}

/** Options, quantity, add to cart and buy now. The one purchase block every draft uses. */
function Purchase({ p, compact }: { p: ProductState; compact?: boolean }) {
  const addLabel =
    p.size === null
      ? "Pick a size"
      : p.soldOut
        ? `${p.size} sold out`
        : "Add to cart";
  return (
    <div className="space-y-6">
      <div>
        <p className="mx-label mb-3 text-[10px] text-white/70">
          Colour <span className="ml-2 text-white">{p.current.colour}</span>
        </p>
        <ColourPicker p={p} />
      </div>
      <div>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <p className="mx-label text-[10px] text-white/70">
            Size{" "}
            {p.size ? <span className="ml-2 text-white">{p.size}</span> : null}
          </p>
          {p.current.soldOut.length ? (
            <p className="text-[12px] text-white/55">
              Struck sizes are sold out
            </p>
          ) : null}
        </div>
        <SizeChips
          value={p.size}
          onChange={p.setSize}
          soldOut={p.current.soldOut}
          allowSoldOut
          small={compact}
        />
        {p.soldOut ? (
          <p role="status" className="mt-3 text-[14px] text-white/75">
            {p.size} is sold out in {p.current.colour}. Try another size or
            colour.
          </p>
        ) : null}
      </div>
      <div className="flex gap-3">
        <QtyStepper value={p.qty} onChange={p.setQty} />
        <Button
          size="md"
          className="flex-1"
          disabled={!p.canBuy}
          onClick={p.add}
        >
          {addLabel}
        </Button>
      </div>
      <Button
        variant="accent"
        size="lg"
        className="w-full"
        disabled={!p.canBuy}
        aria-busy={p.busy}
        onClick={p.buyNow}
      >
        {p.busy
          ? "Preparing checkout…"
          : `Buy now · ${formatPrice(style.price * p.qty)}`}
      </Button>
      {p.added && p.size ? (
        <div
          role="status"
          className="animate-in fade-in-0 flex items-center gap-3 border-y border-white/10 py-3"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]">
            <Check className="size-3.5" />
          </span>
          <p className="min-w-0 flex-1 text-[14px]">
            Added {style.name}, {p.current.colour}, {p.size}
          </p>
          <Button size="sm" variant="outline" onClick={p.openCart}>
            View cart
          </Button>
        </div>
      ) : null}
      <p className="text-[13px] text-white/55">
        Shipping calculated at checkout.
      </p>
    </div>
  );
}

/** Not found: say so plainly and offer the rest of the catalog. */
function NotFound() {
  return (
    <div className="px-5 pt-12 pb-20 md:px-10 md:pt-20">
      <BackLink />
      <div className="mt-8 flex flex-col items-start gap-5">
        <span className="flex size-12 items-center justify-center rounded-full border border-white/15">
          <SearchX className="size-5 text-white/60" />
        </span>
        <h1 className="mx-display text-[clamp(2.25rem,6vw,4.5rem)]">
          Product not found
        </h1>
        <p className="max-w-[44ch] text-[16px] text-white/65">
          It isn&apos;t in the catalog anymore. Here&apos;s what is.
        </p>
      </div>
      <ul className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {products.map((prod) => (
          <li key={prod.handle}>
            <a href="#" className="group block">
              <Media
                src={prod.image}
                alt=""
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="aspect-[4/5]"
              />
              <p className="mx-display mt-3 text-[15px] group-hover:text-[var(--mx-accent-text)]">
                {prod.name}
              </p>
              <p className="mt-1 text-[13px] text-white/60">
                {prod.colour} ·{" "}
                <span className="mx-num">{formatPrice(prod.price)}</span>
              </p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorBody({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-5 pt-12 pb-20 md:px-10 md:pt-20">
      <BackLink className="mb-8" />
      <div className="max-w-xl">
        <CatalogError title="Could not load this product." onRetry={onRetry} />
      </div>
    </div>
  );
}

const gallery = style.colours.map((c) => ({
  src: c.image,
  alt: `${style.name} in ${c.colour}`,
}));

// ---------------------------------------------------------------------------
// A · Split: gallery left, sticky purchase column right.

function SplitSkeleton() {
  return (
    <div
      aria-busy
      className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16"
    >
      <div className="space-y-3">
        <div className="aspect-[5/4] bg-white/[0.06]" />
        <div className="flex gap-3">
          <div className="aspect-[4/5] w-20 bg-white/[0.06]" />
          <div className="aspect-[4/5] w-20 bg-white/[0.06]" />
        </div>
      </div>
      <div className="space-y-5">
        <Bone className="h-12 w-4/5" />
        <Bone className="h-7 w-24" />
        <Bone className="h-4 w-full" />
        <div className="flex gap-2 pt-4">
          <Bone className="h-11 w-28" />
          <Bone className="h-11 w-28" />
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Bone key={i} className="h-11 w-14" />
          ))}
        </div>
        <Bone className="h-14 w-full" />
      </div>
    </div>
  );
}

function SplitDraft({ state }: { state: string }) {
  const p = useProduct(state);
  const lightbox = useLightbox();
  if (p.view === "not-found") return <NotFound />;
  if (p.view === "error") return <ErrorBody onRetry={p.retry} />;
  const index = style.colours.indexOf(p.current);
  return (
    <div className="px-5 pt-6 pb-20 md:px-10 md:pt-8">
      <BackLink />
      {p.view === "loading" ? (
        <SplitSkeleton />
      ) : (
        <div className="animate-in fade-in-0 mt-6 grid gap-10 duration-300 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <button
              type="button"
              onClick={() => lightbox.open(index)}
              className="group relative block w-full"
              aria-label="View full size"
            >
              <Media
                key={p.current.image}
                src={p.current.image}
                alt={`${style.name} in ${p.current.colour}`}
                sizes="(min-width: 1024px) 55vw, 100vw"
                priority
                className="animate-in fade-in-0 aspect-[5/4] duration-200"
              />
              <span className="mx-glass absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full opacity-80 transition-opacity group-hover:opacity-100">
                <Expand className="size-4" />
              </span>
            </button>
            <div className="mt-3 flex gap-3">
              {style.colours.map((c) => (
                <button
                  key={c.colour}
                  type="button"
                  onClick={() => p.setColour(c.colour)}
                  aria-label={`Show ${c.colour}`}
                  className={cn(
                    "relative w-20 ring-offset-2 ring-offset-black transition-shadow",
                    p.current.colour === c.colour
                      ? "ring-2 ring-white"
                      : "opacity-60 hover:opacity-100",
                  )}
                >
                  <Media
                    src={c.image}
                    alt=""
                    sizes="80px"
                    className="aspect-[4/5]"
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="lg:sticky lg:top-6 lg:self-start">
            <h1 className="mx-display text-[clamp(2.25rem,4.5vw,4rem)]">
              {style.name}
            </h1>
            <p className="mx-display mx-num mt-4 text-2xl">
              {formatPrice(style.price)}
            </p>
            <p className="mt-5 max-w-[48ch] text-[16px] text-white/65">
              {style.description}
            </p>
            <div className="mt-8 border-t border-white/10 pt-8">
              <Purchase p={p} />
            </div>
          </div>
        </div>
      )}
      <Lightbox images={gallery} {...lightbox.props} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// B · Showroom: the product photo is the hero; a notched glass panel floats on
// it (desktop). Phones get the panel under the photo on black.

function ShowroomDraft({ state }: { state: string }) {
  const p = useProduct(state);
  if (p.view === "not-found")
    return (
      <div className="pt-20">
        <NotFound />
      </div>
    );
  if (p.view === "error")
    return (
      <div className="pt-20">
        <ErrorBody onRetry={p.retry} />
      </div>
    );
  const loading = p.view === "loading";
  const others = products.filter((prod) => prod.name !== style.name);
  return (
    <div className="pb-20">
      <section className="relative aspect-[4/5] max-h-[92svh] w-full sm:aspect-[5/4] lg:aspect-auto lg:h-[92svh] lg:min-h-[680px]">
        {loading ? (
          <div className="absolute inset-0 bg-white/[0.06]" />
        ) : (
          <Media
            key={p.current.image}
            src={p.current.image}
            alt={`${style.name} in ${p.current.colour}`}
            sizes="100vw"
            priority
            className="animate-in fade-in-0 absolute inset-0 duration-300 [&_img]:object-[50%_20%]"
          />
        )}
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="mx-scrim-bottom absolute inset-0" />
        <div className="absolute inset-x-0 top-16 px-5 md:top-20 md:px-10">
          <BackLink />
        </div>
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 md:px-10 md:pb-10 lg:right-[460px]">
          {loading ? (
            <div className="space-y-4">
              <Bone className="h-16 w-3/4 bg-white/15" />
              <Bone className="h-7 w-24 bg-white/15" />
            </div>
          ) : (
            <>
              <h1 className="mx-display text-[clamp(2.75rem,8vw,7.5rem)]">
                {style.name}
              </h1>
              <p className="mt-3 text-[15px] text-white/75">
                <span className="mx-display mx-num mr-3 text-2xl text-white">
                  {formatPrice(style.price)}
                </span>
                {p.current.colour}
              </p>
            </>
          )}
        </div>
        {loading ? null : (
          <div className="mx-glass-dark absolute right-10 bottom-10 hidden w-[400px] rounded-[var(--mx-r-panel)] rounded-tl-none p-6 lg:block">
            <Purchase p={p} compact />
          </div>
        )}
      </section>
      {loading ? null : (
        <div className="px-5 pt-8 lg:hidden">
          <Purchase p={p} />
        </div>
      )}
      <div className="grid gap-10 px-5 pt-14 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-16 lg:pt-20">
        <div>
          <h2 className="mx-display text-2xl">About this tee</h2>
          {loading ? (
            <Bone className="mt-5 h-4 w-full" />
          ) : (
            <p className="mt-5 max-w-[48ch] text-[16px] text-white/65">
              {style.description}
            </p>
          )}
        </div>
        <div>
          <h2 className="mx-display text-2xl">More merch</h2>
          <ul className="mt-5 grid grid-cols-2 gap-4">
            {others.map((prod) => (
              <li key={prod.handle}>
                <a href="#" className="group block">
                  <Media
                    src={prod.image}
                    alt=""
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="aspect-[5/4]"
                  />
                  <p className="mx-display mt-3 text-[14px] group-hover:text-[var(--mx-accent-text)]">
                    {prod.name}
                  </p>
                  <p className="mt-1 text-[13px] text-white/60">
                    {prod.colour} ·{" "}
                    <span className="mx-num">{formatPrice(prod.price)}</span>
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C · Sheet: one narrow column like a phone, the colour shots are the colour
// picker, and a bar with the total sticks to the bottom until you add.

function SheetDraft({ state }: { state: string }) {
  const p = useProduct(state);
  const lightbox = useLightbox();
  if (p.view === "not-found") return <NotFound />;
  if (p.view === "error") return <ErrorBody onRetry={p.retry} />;
  const loading = p.view === "loading";
  return (
    <div className="relative">
      <div className="mx-auto max-w-[680px] px-5 pt-6 pb-10 md:pt-10">
        <BackLink />
        {loading ? (
          <div aria-busy className="mt-6 space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <div className="aspect-[4/5] bg-white/[0.06]" />
              <div className="aspect-[4/5] bg-white/[0.06]" />
            </div>
            <Bone className="h-12 w-3/4" />
            <Bone className="h-4 w-full" />
            <div className="flex gap-1.5">
              {Array.from({ length: 6 }, (_, i) => (
                <Bone key={i} className="h-11 w-14" />
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in-0 duration-300">
            <div
              className="mt-6 grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Colour"
            >
              {style.colours.map((c, i) => {
                const on = p.current.colour === c.colour;
                return (
                  <div key={c.colour} className="relative">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => p.setColour(c.colour)}
                      className={cn(
                        "block w-full transition-opacity",
                        on ? "" : "opacity-45 hover:opacity-80",
                      )}
                    >
                      <Media
                        src={c.image}
                        alt={`${style.name} in ${c.colour}`}
                        sizes="340px"
                        priority={i === 0}
                        className="aspect-[4/5]"
                      />
                      <span
                        className={cn(
                          "mx-label absolute bottom-3 left-3 rounded-full px-3 py-2 text-[10px]",
                          on
                            ? "bg-white text-black"
                            : "mx-glass-dark text-white",
                        )}
                      >
                        {c.colour}
                      </span>
                    </button>
                    <IconButton
                      label={`View ${c.colour} full size`}
                      onClick={() => lightbox.open(i)}
                      className="absolute top-3 right-3 size-9"
                    >
                      <Expand className="size-3.5" />
                    </IconButton>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 flex items-start justify-between gap-6">
              <h1 className="mx-display text-[clamp(2rem,6vw,3.25rem)]">
                {style.name}
              </h1>
              <p className="mx-display mx-num pt-1 text-2xl">
                {formatPrice(style.price)}
              </p>
            </div>
            <p className="mt-4 text-[16px] text-white/65">
              {style.description}
            </p>
            <div className="mt-8 space-y-6 border-t border-white/10 pt-8">
              <div>
                <div className="mb-3 flex items-baseline justify-between gap-4">
                  <p className="mx-label text-[10px] text-white/70">
                    Size{" "}
                    {p.size ? (
                      <span className="ml-2 text-white">{p.size}</span>
                    ) : null}
                  </p>
                  {p.current.soldOut.length ? (
                    <p className="text-[12px] text-white/55">
                      Struck sizes are sold out
                    </p>
                  ) : null}
                </div>
                <SizeChips
                  value={p.size}
                  onChange={p.setSize}
                  soldOut={p.current.soldOut}
                  allowSoldOut
                />
                {p.soldOut ? (
                  <p role="status" className="mt-3 text-[14px] text-white/75">
                    {p.size} is sold out in {p.current.colour}. Try another size
                    or colour.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="mx-label text-[10px] text-white/70">Quantity</p>
                <QtyStepper value={p.qty} onChange={p.setQty} />
              </div>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                disabled={!p.canBuy}
                aria-busy={p.busy}
                onClick={p.buyNow}
              >
                {p.busy ? "Preparing checkout…" : "Buy now"}
              </Button>
              {p.added && p.size ? (
                <div
                  role="status"
                  className="animate-in fade-in-0 flex items-center gap-3 border-y border-white/10 py-3"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]">
                    <Check className="size-3.5" />
                  </span>
                  <p className="min-w-0 flex-1 text-[14px]">
                    Added {p.current.colour}, {p.size}
                  </p>
                  <Button size="sm" variant="outline" onClick={p.openCart}>
                    View cart
                  </Button>
                </div>
              ) : null}
              <p className="text-[13px] text-white/55">
                Shipping calculated at checkout.
              </p>
            </div>
          </div>
        )}
      </div>
      {loading ? null : (
        <div className="sticky bottom-0 z-20 border-t border-white/10 bg-black">
          <div className="mx-auto flex max-w-[680px] items-center gap-3 px-5 py-3">
            <div className="mr-auto min-w-0">
              <p className="mx-display mx-num text-xl">
                {formatPrice(style.price * p.qty)}
              </p>
              <p className="truncate text-[12px] text-white/60">
                {p.current.colour} · {p.size ?? "No size yet"} ·{" "}
                <span className="mx-num">{p.qty}</span>
              </p>
            </div>
            <Button variant="accent" disabled={!p.canBuy} onClick={p.add}>
              {p.size === null
                ? "Pick a size"
                : p.soldOut
                  ? "Sold out"
                  : "Add to cart"}
            </Button>
          </div>
        </div>
      )}
      <Lightbox images={gallery} {...lightbox.props} />
    </div>
  );
}

export const merchProductPage: PageSpec = {
  id: "merch-product",
  title: "Merch product",
  route: "/merch/[handle]",
  nav: "Merch",
  states: [
    { id: "loaded", label: "Loaded", hint: "Nothing picked yet" },
    {
      id: "sold-out",
      label: "Sold-out size",
      hint: "White, 2XL picked (illustrative stock)",
    },
    {
      id: "added",
      label: "Added",
      hint: "Inline confirmation; the real add updates the header cart",
    },
    {
      id: "checkout",
      label: "Checkout busy",
      hint: "Buy now while Shopify checkout is created",
    },
    { id: "loading", label: "Loading" },
    { id: "error", label: "Error", hint: "Try again flips to loaded" },
    { id: "not-found", label: "Not found" },
  ],
  drafts: [
    {
      id: "a",
      label: "A · Split",
      note: "Photo and colour thumbs left, sticky purchase column right. Description copy is placeholder.",
      Component: ({ state }) => <SplitDraft key={state} state={state} />,
    },
    {
      id: "b",
      label: "B · Showroom",
      note: "Product photo as the hero with a notched glass purchase panel on it, more merch below.",
      heroUnderHeader: true,
      Component: ({ state }) => <ShowroomDraft key={state} state={state} />,
    },
    {
      id: "c",
      label: "C · Sheet",
      note: "Narrow phone-like column; colour shots are the colour picker, total and add stick to the bottom.",
      Component: ({ state }) => <SheetDraft key={state} state={state} />,
    },
  ],
};
