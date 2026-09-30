"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Expand, SearchX } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useMerchCart } from "~/components/merch/merch-cart-provider";
import { formatMoney } from "../cart-sheet";
import { Lightbox, useLightbox } from "../overlays";
import { useSite } from "../site-provider";
import { Button, Media, Skeleton } from "../ui";
import {
  Bone,
  CatalogError,
  FALLBACK_IMAGE,
  hasSizes,
  isSoldOut,
  productHref,
  QtyStepper,
  SizeChips,
  useAddVariant,
  type Product,
} from "./merch-kit";

function BackLink({ className }: { className?: string }) {
  return (
    <Link
      href="/merch"
      className={cn(
        "t-label inline-flex h-10 items-center gap-2 text-[11px] text-white/70 hover:text-white",
        className,
      )}
    >
      <ArrowLeft className="size-4" /> Back to merch
    </Link>
  );
}

/** Size, quantity, add to cart and buy now for one product. */
function Purchase({ product }: { product: Product }) {
  const { items } = useMerchCart();
  const { setCartOpen } = useSite();
  const add = useAddVariant("merch_add_to_cart_detail");
  const sized = hasSizes(product);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState<string | null>(null);
  const checkout = api.shopify.createCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
    onError: (err) => toast.error(err.message ?? "Could not start checkout"),
  });

  const variant = sized
    ? product.variants.find((v) => v.id === variantId)
    : product.variants[0];
  const soldOut = !!variant && !variant.availableForSale;
  const canBuy = !!variant && !soldOut && !checkout.isPending;
  const outSizes = product.variants.some((v) => !v.availableForSale);
  const price = variant?.price ?? product.price;

  const pick = (id: string) => {
    setVariantId(id);
    setAdded(null);
  };

  /** Adds the line, then checks out the whole cart (the cart state lags a render, so merge here). */
  const buyNow = () => {
    if (!variant || !canBuy) return;
    add(product, variant, qty);
    const lines = items.map((i) => ({
      merchandiseId: i.merchandiseId,
      quantity:
        i.merchandiseId === variant.id
          ? Math.min(99, i.quantity + qty)
          : i.quantity,
      productHandle: i.productHandle,
      variantTitle: i.variantTitle,
    }));
    if (!items.some((i) => i.merchandiseId === variant.id)) {
      lines.push({
        merchandiseId: variant.id,
        quantity: qty,
        productHandle: product.handle,
        variantTitle: variant.title,
      });
    }
    checkout.mutate({ lines });
  };

  if (product.variants.length === 0) {
    return (
      <p className="text-[15px] text-white/70">Not available to order yet.</p>
    );
  }

  return (
    <div className="space-y-6">
      {sized ? (
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <p className="t-label text-[10px] text-white/70">
              Size{" "}
              {variant ? (
                <span className="ml-2 text-white">{variant.title}</span>
              ) : null}
            </p>
            {outSizes ? (
              <p className="text-[12px] text-white/55">
                Struck sizes are sold out
              </p>
            ) : null}
          </div>
          <SizeChips
            variants={product.variants}
            value={variantId}
            onChange={pick}
            allowSoldOut
          />
          {soldOut && variant ? (
            <p role="status" className="mt-3 text-[14px] text-white/75">
              {variant.title} is sold out. Try another size.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex gap-3">
        <QtyStepper value={qty} onChange={setQty} />
        <Button
          className="flex-1"
          disabled={!canBuy}
          onClick={() => {
            if (!variant || !canBuy) return;
            add(product, variant, qty);
            setAdded(variant.title);
          }}
        >
          {!variant
            ? "Pick a size"
            : soldOut
              ? sized
                ? `${variant.title} sold out`
                : "Sold out"
              : "Add to cart"}
        </Button>
      </div>
      <Button
        variant="accent"
        size="lg"
        className="w-full"
        disabled={!canBuy}
        aria-busy={checkout.isPending}
        onClick={buyNow}
      >
        {checkout.isPending
          ? "Preparing checkout…"
          : `Buy now · ${formatMoney(price * qty, variant?.currencyCode ?? product.currencyCode)}`}
      </Button>
      {added ? (
        <div
          role="status"
          className="animate-in fade-in-0 flex items-center gap-3 border-y border-white/10 py-3"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--site-accent)] text-[var(--site-accent-ink)]">
            <Check className="size-3.5" />
          </span>
          <p className="min-w-0 flex-1 text-[14px]">
            Added {product.title}
            {sized ? `, ${added}` : null}
          </p>
          <Button size="sm" variant="outline" onClick={() => setCartOpen(true)}>
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

/** Gallery, then a sticky column with title, price, description and purchase. */
function ProductBody({ product }: { product: Product }) {
  const lightbox = useLightbox();
  const images = [
    ...new Set(
      [product.image, ...product.variants.map((v) => v.imageUrl)].filter(
        (src): src is string => !!src,
      ),
    ),
  ];
  const gallery = (images.length ? images : [FALLBACK_IMAGE]).map((src) => ({
    src,
    alt: product.title,
  }));
  const [shown, setShown] = useState(0);
  const current = gallery[shown] ?? gallery[0];

  return (
    <div className="animate-in fade-in-0 mt-6 grid gap-10 duration-300 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
      <div>
        {current ? (
          <button
            type="button"
            onClick={() => lightbox.open(shown)}
            className="group relative block w-full"
            aria-label="View full size"
          >
            <Media
              key={current.src}
              src={current.src}
              alt={current.alt}
              sizes="(min-width: 1024px) 55vw, 100vw"
              priority
              className={cn(
                "animate-in fade-in-0 aspect-[5/4] duration-200",
                isSoldOut(product) && "grayscale",
              )}
            />
            <span className="glass absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full opacity-80 transition-opacity group-hover:opacity-100">
              <Expand className="size-4" />
            </span>
          </button>
        ) : null}
        {gallery.length > 1 ? (
          <div className="mt-3 flex gap-3">
            {gallery.map((g, i) => (
              <button
                key={g.src}
                type="button"
                onClick={() => setShown(i)}
                aria-label={`Show image ${i + 1}`}
                className={cn(
                  "relative w-20 ring-offset-2 ring-offset-black transition-shadow",
                  i === shown
                    ? "ring-2 ring-white"
                    : "opacity-60 hover:opacity-100",
                )}
              >
                <Media
                  src={g.src}
                  alt=""
                  sizes="80px"
                  className="aspect-[4/5]"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <h1 className="t-display text-[clamp(2.25rem,4.5vw,4rem)] [overflow-wrap:anywhere]">
          {product.title}
        </h1>
        <p className="t-display mt-4 text-2xl tabular-nums">
          {formatMoney(product.price, product.currencyCode)}
        </p>
        {product.description ? (
          <p className="mt-5 max-w-[48ch] text-[16px] text-white/65">
            {product.description}
          </p>
        ) : null}
        <div className="mt-8 border-t border-white/10 pt-8">
          <Purchase product={product} />
        </div>
      </div>
      <Lightbox images={gallery} {...lightbox.props} />
    </div>
  );
}

function SplitSkeleton() {
  return (
    <div
      aria-busy
      className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16"
    >
      <Skeleton className="aspect-[5/4]" />
      <div className="space-y-5">
        <Bone className="h-12 w-4/5" />
        <Bone className="h-7 w-24" />
        <Bone className="h-4 w-full" />
        <div className="flex flex-wrap gap-1.5 pt-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Bone key={i} className="h-11 w-14" />
          ))}
        </div>
        <Bone className="h-11 w-full" />
        <Bone className="h-14 w-full" />
      </div>
    </div>
  );
}

/** Not found: say so plainly and offer the rest of the catalog. */
function NotFound() {
  const products = api.shopify.getProducts.useQuery();
  return (
    <>
      <div className="mt-8 flex flex-col items-start gap-5">
        <span className="flex size-12 items-center justify-center rounded-full border border-white/15">
          <SearchX className="size-5 text-white/60" />
        </span>
        <h1 className="t-heading text-[clamp(2.25rem,6vw,4.5rem)]">
          Product not found
        </h1>
        <p className="max-w-[44ch] text-[16px] text-white/65">
          It isn&apos;t in the catalog anymore. Here&apos;s what is.
        </p>
      </div>
      {products.data?.length ? (
        <ul className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {products.data.map((p) => (
            <li key={p.id}>
              <Link href={productHref(p.handle)} className="group block">
                <Media
                  src={p.image ?? FALLBACK_IMAGE}
                  alt=""
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className={cn("aspect-[4/5]", isSoldOut(p) && "grayscale")}
                />
                <p className="t-display mt-3 text-[15px] [overflow-wrap:anywhere] group-hover:text-[var(--site-accent-text)]">
                  {p.title}
                </p>
                <p className="mt-1 text-[13px] text-white/60 tabular-nums">
                  {formatMoney(p.price, p.currencyCode)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** /merch/[handle], "Split": photo left, sticky purchase column right. */
export function MerchProduct({ handle }: { handle: string }) {
  const product = api.shopify.getProductByHandle.useQuery({
    handle: decodeURIComponent(handle),
  });
  return (
    <div className="px-5 pt-6 pb-20 md:px-10 md:pt-8">
      <BackLink />
      {product.isPending ? (
        <SplitSkeleton />
      ) : product.isError ? (
        <div className="mt-6 max-w-xl">
          <CatalogError
            title="Could not load this product."
            message={product.error.message}
            onRetry={() => void product.refetch()}
            retrying={product.isFetching}
          />
        </div>
      ) : product.data ? (
        <ProductBody key={product.data.id} product={product.data} />
      ) : (
        <NotFound />
      )}
    </div>
  );
}
