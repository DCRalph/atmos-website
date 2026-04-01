"use client";

import Image from "next/image";
import { api } from "~/trpc/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useMerchCart } from "~/components/merch/merch-cart-provider";
import { toast } from "sonner";

type MerchCartDrawerProps = {
  triggerClassName?: string;
};

export function MerchCartDrawer({ triggerClassName }: MerchCartDrawerProps) {
  const {
    items,
    totalQuantity,
    subtotalAmount,
    currencyCode,
    isLoaded,
    updateItemQuantity,
    removeItem,
    clearCart,
  } = useMerchCart();
  const checkoutMutation = api.shopify.createCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => {
      window.location.assign(checkoutUrl);
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not start checkout");
    },
  });

  const formatMoney = (amount: number, code: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "group relative inline-flex items-center gap-2 rounded-none border-2 border-white/10 bg-black/80 px-4 py-2 text-sm font-black tracking-wider text-white uppercase backdrop-blur-sm transition-all hover:border-accent-muted/50 hover:bg-black/90 hover:shadow-[0_0_15px_var(--accent-muted)]",
            triggerClassName,
          )}
        >
          <ShoppingBag className="size-4" aria-hidden />
          <span>Cart</span>
          {totalQuantity > 0 && (
            <span className="bg-accent-muted ml-1 flex size-5 items-center justify-center text-[10px] font-bold text-white">
              {totalQuantity > 9 ? "9+" : totalQuantity}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col rounded-none border-l-2 border-white/10 bg-black p-0 text-white backdrop-blur-sm sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b-2 border-white/10 px-5 py-4">
          <SheetTitle className="text-lg font-black tracking-wider text-white uppercase">
            Your Cart
            {totalQuantity > 0 && (
              <span className="bg-accent-muted/80 ml-2 px-2 py-0.5 text-xs font-semibold tracking-wide text-white normal-case">
                {totalQuantity} {totalQuantity === 1 ? "item" : "items"}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {!isLoaded && (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="space-y-3 text-center">
                <div className="border-accent-muted mx-auto size-8 animate-spin rounded-none border-2 border-t-white" />
                <p className="text-xs font-semibold tracking-wider text-white/50 uppercase">
                  Loading...
                </p>
              </div>
            </div>
          )}

          {isLoaded && items.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
              <div className="flex size-20 items-center justify-center border-2 border-white/10 bg-black/80">
                <ShoppingBag className="size-8 text-white/20" />
              </div>
              <div className="space-y-1 text-center">
                <p className="font-black tracking-wider text-white/60 uppercase">
                  Cart is empty
                </p>
                <p className="text-xs text-white/40">
                  Add some merch to get started
                </p>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="divide-y-2 divide-white/10">
              {items.map((line) => (
                <div
                  key={line.merchandiseId}
                  className="flex gap-4 px-5 py-4"
                >
                  <div className="relative size-20 shrink-0 overflow-hidden border-2 border-white/10 bg-black/80">
                    {line.imageUrl ? (
                      <Image
                        src={line.imageUrl}
                        alt={line.productTitle}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <ShoppingBag className="size-6 text-white/20" />
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <p className="truncate text-sm font-black leading-tight tracking-tight text-white uppercase">
                        {line.productTitle}
                      </p>
                      {line.variantTitle && (
                        <p className="mt-0.5 text-[10px] font-semibold tracking-wider text-white/50 uppercase">
                          {line.variantTitle}
                        </p>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center border-2 border-white/10">
                        <button
                          type="button"
                          className="flex size-7 items-center justify-center text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
                          disabled={checkoutMutation.isPending || line.quantity <= 1}
                          onClick={() =>
                            updateItemQuantity(line.merchandiseId, line.quantity - 1)
                          }
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="flex w-8 items-center justify-center border-x-2 border-white/10 text-xs font-bold tabular-nums text-white">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          className="flex size-7 items-center justify-center text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
                          disabled={checkoutMutation.isPending || line.quantity >= 99}
                          onClick={() =>
                            updateItemQuantity(line.merchandiseId, line.quantity + 1)
                          }
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>

                      <p className="text-sm font-bold tracking-wide text-white">
                        {formatMoney(line.unitPrice * line.quantity, line.currencyCode)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center text-white/30 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:text-white/10"
                    disabled={checkoutMutation.isPending}
                    onClick={() => removeItem(line.merchandiseId)}
                    aria-label={`Remove ${line.productTitle}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="shrink-0 border-t-2 border-white/10 bg-black/95 px-5 py-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-[0.3em] text-white/50 uppercase">
                Subtotal
              </span>
              <span className="text-lg font-bold tracking-wide text-white">
                {formatMoney(subtotalAmount, currencyCode)}
              </span>
            </div>

            <button
              type="button"
              className="bg-accent-muted hover:bg-accent-muted/80 mb-2 flex h-11 w-full items-center justify-center rounded-none text-xs font-black tracking-wider text-white uppercase shadow-[0_0_15px_var(--accent-muted)] transition-all hover:shadow-[0_0_25px_var(--accent-muted)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
              disabled={checkoutMutation.isPending}
              onClick={() =>
                checkoutMutation.mutate({
                  lines: items.map((item) => ({
                    merchandiseId: item.merchandiseId,
                    quantity: item.quantity,
                    productHandle: item.productHandle,
                    variantTitle: item.variantTitle,
                  })),
                })
              }
            >
              {checkoutMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-none border-2 border-white/30 border-t-white" />
                  Preparing checkout...
                </span>
              ) : (
                "Checkout"
              )}
            </button>

            <button
              type="button"
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-none border-2 border-white/10 text-[10px] font-semibold tracking-wider text-white/50 uppercase transition-all hover:border-white/30 hover:bg-white/5 hover:text-white/80 disabled:cursor-not-allowed disabled:text-white/20"
              disabled={checkoutMutation.isPending}
              onClick={clearCart}
            >
              <Trash2 className="size-3" />
              Clear cart
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
