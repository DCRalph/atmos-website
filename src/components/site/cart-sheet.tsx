"use client";

import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { api } from "~/trpc/react";
import { useMerchCart } from "~/components/merch/merch-cart-provider";
import { DialogClose, SiteDialog } from "./overlays";
import { useSite } from "./site-provider";
import { Button, buttonVariants } from "./ui";

export const formatMoney = (amount: number, currency = "NZD") =>
  new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

/** The merch cart as a right-hand sheet. Checkout hands off to Shopify. */
export function CartSheet() {
  const { cartOpen, setCartOpen } = useSite();
  const {
    items,
    totalQuantity,
    subtotalAmount,
    currencyCode,
    updateItemQuantity,
    removeItem,
  } = useMerchCart();
  const checkout = api.shopify.createCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
    onError: (err) => toast.error(err.message ?? "Could not start checkout"),
  });

  return (
    <SiteDialog
      open={cartOpen}
      onOpenChange={setCartOpen}
      title="Cart"
      side="right"
      description={
        totalQuantity
          ? `${totalQuantity} ${totalQuantity === 1 ? "item" : "items"}`
          : undefined
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
          <ShoppingBag className="size-10 text-white/30" />
          <p className="t-display text-xl">Nothing in here yet</p>
          <p className="max-w-[30ch] text-[14px] text-white/60">
            Tees and drops live in Merch. Pick a size and it lands here.
          </p>
          <DialogClose asChild>
            <Link
              href="/merch"
              className={buttonVariants({ variant: "outline" })}
            >
              Browse merch
            </Link>
          </DialogClose>
        </div>
      ) : (
        <>
          <ul className="flex-1 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.merchandiseId}
                className="grid grid-cols-[72px_1fr_auto] gap-4 border-b border-white/10 p-5"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-white/5">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      fill
                      sizes="72px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/merch/${item.productHandle}`}
                    onClick={() => setCartOpen(false)}
                    className="t-display block truncate text-base hover:text-[var(--site-accent-text)]"
                  >
                    {item.productTitle}
                  </Link>
                  {item.variantTitle !== "Default" ? (
                    <p className="mt-1.5 text-[13px] text-white/60">
                      {item.variantTitle}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center gap-4">
                    <div className="inline-flex h-9 items-center rounded-full border border-white/20">
                      <button
                        type="button"
                        aria-label="One fewer"
                        onClick={() =>
                          updateItemQuantity(
                            item.merchandiseId,
                            item.quantity - 1,
                          )
                        }
                        className="flex size-9 items-center justify-center text-white/70 hover:text-white"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span
                        className="t-display w-5 text-center text-sm tabular-nums"
                        aria-live="polite"
                      >
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="One more"
                        disabled={item.quantity >= 99}
                        onClick={() =>
                          updateItemQuantity(
                            item.merchandiseId,
                            item.quantity + 1,
                          )
                        }
                        className="flex size-9 items-center justify-center text-white/70 hover:text-white disabled:opacity-30"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.merchandiseId)}
                      className="text-[13px] text-white/60 underline underline-offset-4 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <p className="t-display text-base tabular-nums">
                  {formatMoney(
                    item.unitPrice * item.quantity,
                    item.currencyCode,
                  )}
                </p>
              </li>
            ))}
          </ul>
          <div className="space-y-4 border-t border-white/10 p-5">
            <div className="flex items-baseline justify-between">
              <span className="t-label text-[12px] text-white/70">
                Subtotal
              </span>
              <span className="t-display text-2xl tabular-nums">
                {formatMoney(subtotalAmount, currencyCode)}
              </span>
            </div>
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              disabled={checkout.isPending}
              aria-busy={checkout.isPending}
              onClick={() =>
                checkout.mutate({
                  lines: items.map((i) => ({
                    merchandiseId: i.merchandiseId,
                    quantity: i.quantity,
                    productHandle: i.productHandle,
                    variantTitle: i.variantTitle,
                  })),
                })
              }
            >
              {checkout.isPending ? "Preparing checkout…" : "Checkout"}
            </Button>
            <p className="text-center text-[13px] text-white/55">
              Shipping calculated at checkout
            </p>
          </div>
        </>
      )}
    </SiteDialog>
  );
}
