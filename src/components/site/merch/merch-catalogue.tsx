"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { formatMoney } from "../cart-sheet";
import { Button, Media, Skeleton } from "../ui";
import {
  Bone,
  CartSummary,
  CatalogEmpty,
  CatalogError,
  FALLBACK_IMAGE,
  hasSizes,
  isSoldOut,
  productHref,
  SizeChips,
  soldOutNote,
  useAddVariant,
  type Product,
} from "./merch-kit";

// Cuts are read off the product title ("Guys staple tee Black").
const cuts = ["Guys", "Girls"] as const;
type Cut = (typeof cuts)[number] | "All";
const isCut = (p: Product, cut: Cut) =>
  cut === "All" || p.title.toLowerCase().startsWith(cut.toLowerCase());

/** Cut filter and product count. Only rendered when the catalog has more than one cut. */
function CutFilter({
  options,
  value,
  onChange,
  count,
}: {
  options: readonly Cut[];
  value: Cut;
  onChange: (c: Cut) => void;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-y border-white/10 px-5 py-3 md:px-10">
      <div className="flex gap-1" role="radiogroup" aria-label="Filter">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            onClick={() => onChange(c)}
            className={cn(
              "t-label h-8 rounded-full px-4 text-[10px] transition-colors",
              value === c
                ? "bg-white text-black"
                : "text-white/65 hover:text-white",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="t-label text-[10px] text-white/55 tabular-nums">
        {count} {count === 1 ? "product" : "products"}
      </p>
    </div>
  );
}

/** One product: photo, name, price, stock note, sizes and add. */
function CatalogueCard({ product }: { product: Product }) {
  const add = useAddVariant("merch_add_to_cart");
  const sized = hasSizes(product);
  const [variantId, setVariantId] = useState<string | null>(null);
  const variant = sized
    ? product.variants.find((v) => v.id === variantId)
    : product.variants[0];
  const out = isSoldOut(product);
  const note = soldOutNote(product);
  const href = productHref(product.handle);

  return (
    <article className="flex min-w-0 flex-col">
      <Link
        href={href}
        className="group relative block overflow-hidden"
        aria-label={product.title}
      >
        <Media
          src={product.image ?? FALLBACK_IMAGE}
          alt={product.title}
          sizes="(min-width: 1024px) 25vw, 50vw"
          className={cn(
            "aspect-[4/5] transition-transform duration-500 ease-out group-hover:scale-[1.03]",
            out && "grayscale",
          )}
        />
        {out ? (
          <span className="t-label absolute top-3 left-3 rounded-[var(--site-r-chip)] bg-white px-2 py-1.5 text-[10px] text-black">
            Sold out
          </span>
        ) : null}
      </Link>
      <div className="flex flex-col gap-1.5 pt-4 xl:flex-row xl:items-baseline xl:justify-between xl:gap-3">
        <h2 className="t-display min-w-0 text-[15px] [overflow-wrap:anywhere] md:text-lg">
          <Link href={href} className="hover:text-[var(--site-accent-text)]">
            {product.title}
          </Link>
        </h2>
        <p className="t-display shrink-0 text-[15px] tabular-nums md:text-lg">
          {formatMoney(variant?.price ?? product.price, product.currencyCode)}
        </p>
      </div>
      {note && !out ? (
        <p className="mt-1.5 text-[13px] text-white/60">{note}</p>
      ) : null}
      <div className="mt-auto pt-4">
        {sized && !out ? (
          <SizeChips
            small
            variants={product.variants}
            value={variantId}
            onChange={setVariantId}
          />
        ) : null}
        <Button
          className="mt-4 w-full px-3"
          variant={variant && !out ? "solid" : "outline"}
          disabled={out || !variant?.availableForSale}
          onClick={() => {
            if (!variant?.availableForSale) return;
            add(product, variant);
            setVariantId(null);
          }}
        >
          {out
            ? "Sold out"
            : !sized
              ? "Add to cart"
              : variant
                ? `Add ${variant.title}`
                : "Pick a size"}
        </Button>
      </div>
    </article>
  );
}

function CatalogueSkeleton() {
  return (
    <div
      aria-busy
      className="grid grid-cols-2 gap-x-4 gap-y-10 px-5 pt-8 md:px-10 lg:grid-cols-4 lg:gap-x-6"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[4/5]" />
          <Bone className="h-5 w-3/4" />
          <Bone className="h-3.5 w-1/3" />
          <div className="flex gap-1.5 pt-2">
            {Array.from({ length: 4 }, (_, j) => (
              <Bone key={j} className="h-8 w-10" />
            ))}
          </div>
          <Bone className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}

/** /merch, "Catalogue": title row with cart total, cut filter, four-up grid with sizes on every card. */
export function MerchCatalogue() {
  const products = api.shopify.getProducts.useQuery();
  const [cut, setCut] = useState<Cut>("All");
  const all = products.data ?? [];
  const presentCuts = cuts.filter((c) => all.some((p) => isCut(p, c)));
  const shown = all.filter((p) => isCut(p, cut));

  return (
    <div className="pb-20">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 px-5 pt-12 pb-8 md:px-10 md:pt-20 md:pb-12">
        <div>
          <h1 className="t-heading text-[clamp(2.75rem,9vw,7rem)]">Merch</h1>
          <p className="mt-5 text-[16px] text-white/65 md:text-[17px]">
            Limited drops and Atmos staples
          </p>
        </div>
        <CartSummary />
      </div>

      {products.isPending ? (
        <CatalogueSkeleton />
      ) : products.isError ? (
        <div className="px-5 md:px-10">
          <CatalogError
            onRetry={() => void products.refetch()}
            retrying={products.isFetching}
            message={products.error.message}
          />
        </div>
      ) : all.length === 0 ? (
        <CatalogEmpty />
      ) : (
        <>
          {presentCuts.length > 1 ? (
            <CutFilter
              options={["All", ...presentCuts]}
              value={cut}
              onChange={setCut}
              count={shown.length}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-x-4 gap-y-12 px-5 pt-8 md:px-10 lg:grid-cols-4 lg:gap-x-6">
            {shown.map((p) => (
              <CatalogueCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
