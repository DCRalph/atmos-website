"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import posthog from "posthog-js";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { api } from "~/trpc/react";
import { StaticBackground } from "~/components/static-background";
import { MainPageSection } from "~/components/main-page-section";
import { AnimatedPageHeader } from "~/components/animated-page-header";
import { MerchCartDrawer } from "~/components/merch/merch-cart-drawer";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type MerchProductDetailProps = {
  handle: string;
};

export function MerchProductDetail({ handle }: MerchProductDetailProps) {
  const decodedHandle = decodeURIComponent(handle);
  const utils = api.useUtils();
  const { data: product, isLoading, isError, error } =
    api.shopify.getProductByHandle.useQuery({
      handle: decodedHandle,
    });
  const { data: cart } = api.shopify.getCart.useQuery();

  const [selectedId, setSelectedId] = useState<string>("");

  const variants = product?.variants ?? [];
  const selected = useMemo(() => {
    if (variants.length === 0) return undefined;
    const candidate =
      variants.find((v) => v.id === selectedId) ?? variants[0];
    return candidate;
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

  const price = selected?.price ?? product?.price ?? 0;
  const currency = selected?.currencyCode ?? product?.currencyCode ?? "USD";
  const displayImage =
    selected?.imageUrl ?? product?.image ?? "/home/atmos-46.jpg";
  const canAdd =
    !!selected?.id && selected.availableForSale && !addMutation.isPending;

  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);

  return (
    <main className="min-h-content bg-black text-white">
      <StaticBackground imageSrc="/home/atmos-46.jpg" />
      <MainPageSection>
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/merch"
            className="inline-flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back to merch
          </Link>
          <MerchCartDrawer />
        </div>

        <AnimatedPageHeader title="PRODUCT" subtitle="Variants and checkout" />

        {isLoading ? (
          <div className="rounded-none border-2 border-white/10 bg-black/70 p-6 text-white/70">
            Loading product...
          </div>
        ) : null}

        {!isLoading && isError ? (
          <div className="rounded-none border-2 border-red-500/40 bg-red-500/10 p-6 text-red-100">
            {error?.message ?? "Could not load this product."}
          </div>
        ) : null}

        {!isLoading && !isError && !product ? (
          <div className="rounded-none border-2 border-white/10 bg-black/70 p-6 text-white/70">
            Product not found in the synced catalog.
          </div>
        ) : null}

        {product ? (
          <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
            <div className="relative aspect-square overflow-hidden border-2 border-white/10 bg-black/70">
              <Image
                src={displayImage}
                alt={product.title}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>

            <div className="space-y-4 border-2 border-white/10 bg-black/70 p-5">
              <h1 className="text-3xl font-black uppercase tracking-tight">
                {product.title}
              </h1>
              <p className="text-sm text-white/70">{product.description}</p>

              {variants.length > 1 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-wider text-white/60 uppercase">
                    Variant
                  </p>
                  <Select
                    value={selectedId || (variants[0]?.id ?? "")}
                    onValueChange={setSelectedId}
                  >
                    <SelectTrigger className="w-full rounded-none border-white/20 bg-black/40 text-white">
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
                </div>
              ) : variants.length === 1 ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-wider text-white/60 uppercase">
                    Variant
                  </p>
                  <p className="text-sm text-white/90">{variants[0]!.title || "Default"}</p>
                </div>
              ) : (
                <p className="text-sm text-amber-200/90">
                  No variants are available for this product yet.
                </p>
              )}

              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-2xl font-bold">{formattedPrice}</span>
                <Button
                  type="button"
                  disabled={!canAdd}
                  onClick={() => {
                    if (!selected?.id) return;
                    addMutation.mutate({ merchandiseId: selected.id, quantity: 1 });
                    posthog.capture("merch_add_to_cart_detail", {
                      merch_item_id: product.id,
                      merch_item_name: product.title,
                      variant_id: selected.id,
                      price,
                      handle: product.handle,
                    });
                  }}
                >
                  {addMutation.isPending ? "Adding..." : "Add to cart"}
                </Button>
              </div>

              {cart?.checkoutUrl ? (
                <Button asChild variant="outline" className="w-full">
                  <a href={cart.checkoutUrl}>Checkout</a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </MainPageSection>
    </main>
  );
}
