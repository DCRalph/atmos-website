"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import posthog from "posthog-js";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { CachedVariant } from "~/lib/shopify";
import { api } from "~/trpc/react";
import { toast } from "sonner";

interface MerchItemProps {
  id: string;
  name: string;
  description: string;
  image: string | null;
  handle: string;
  variants: CachedVariant[];
  defaultPrice: number;
  currencyCode: string;
  productHref?: string;
}

export function MerchItem({
  id,
  name,
  description,
  image,
  handle,
  variants,
  defaultPrice,
  currencyCode = "USD",
  productHref,
}: MerchItemProps) {
  const utils = api.useUtils();
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");

  const selected = useMemo(() => {
    if (variants.length === 0) return undefined;
    const v = variants.find((x) => x.id === selectedId);
    return v ?? variants[0];
  }, [variants, selectedId]);

  const addMutation = api.shopify.addCartLines.useMutation({
    onSuccess: () => {
      void utils.shopify.getCart.invalidate();
      toast.success("Added to cart");
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not add to cart");
    },
  });

  const displayImage = selected?.imageUrl ?? image ?? "/home/atmos-46.jpg";
  const price = selected?.price ?? defaultPrice;
  const cur = selected?.currencyCode ?? currencyCode;

  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);

  const canAdd =
    variants.length > 0 &&
    selected?.availableForSale &&
    !!selected?.id &&
    !addMutation.isPending;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-none border-2 border-white/10 bg-black/80 backdrop-blur-sm transition-all hover:border-accent-muted/50 hover:bg-black/90 hover:shadow-[0_0_15px_var(--accent-muted)]">
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden border-b-2 border-white/10 bg-black/70">
        <Image
          src={displayImage}
          alt={name}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-white/50 uppercase">
            Atmos Merch
          </p>
          <h3 className="mt-2 text-lg font-black tracking-tight text-white uppercase sm:text-xl">
            {name}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-white/60 sm:text-sm">
            {description}
          </p>
        </div>
        <div className="space-y-3 border-t-2 border-white/10 pt-4">
          {variants.length > 0 ? (
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold tracking-wider text-white/50 uppercase">
                Option
              </label>
              {variants.length > 1 ? (
                <Select
                  value={selectedId}
                  onValueChange={setSelectedId}
                >
                  <SelectTrigger className="w-full rounded-none border-white/20 bg-black/50 text-white">
                    <SelectValue placeholder="Choose variant" />
                  </SelectTrigger>
                  <SelectContent className="border-white/20 bg-zinc-950 text-white">
                    {variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.title || "Default"}
                        {!v.availableForSale ? " (Sold out)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-white/80">
                  {variants[0]?.title || "Default"}
                  {!variants[0]?.availableForSale ? " (Sold out)" : ""}
                </p>
              )}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-bold tracking-wide text-white sm:text-lg">
              {formattedPrice}
            </span>
            <Button
              type="button"
              variant="default"
              className="min-w-32"
              disabled={!canAdd}
              title={
                variants.length === 0
                  ? "No variants available"
                  : undefined
              }
              onClick={() => {
                if (!selected?.id) return;
                addMutation.mutate({
                  merchandiseId: selected.id,
                  quantity: 1,
                });
                posthog.capture("merch_add_to_cart", {
                  merch_item_id: id,
                  merch_item_name: name,
                  variant_id: selected.id,
                  price,
                  handle,
                });
              }}
            >
              {addMutation.isPending ? "Adding…" : "Add to cart"}
            </Button>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={productHref ?? `/merch/${encodeURIComponent(handle)}`}>
              View product details
            </Link>
          </Button>
          {selected && !selected.availableForSale ? (
            <p className="text-center text-xs text-amber-200/90">
              This option is currently unavailable.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
