"use client";

import Image from "next/image";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { ShoppingBag } from "lucide-react";
import { cn } from "~/lib/utils";

type MerchCartDrawerProps = {
  triggerClassName?: string;
};

export function MerchCartDrawer({ triggerClassName }: MerchCartDrawerProps) {
  const utils = api.useUtils();
  const { data: cart, isLoading } = api.shopify.getCart.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  const updateLine = api.shopify.updateCartLine.useMutation({
    onSuccess: () => void utils.shopify.getCart.invalidate(),
  });

  const removeLines = api.shopify.removeCartLines.useMutation({
    onSuccess: () => void utils.shopify.getCart.invalidate(),
  });

  const count = cart?.totalQuantity ?? 0;
  const currency = cart?.currencyCode ?? "USD";

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
            "inline-flex items-center gap-2 rounded-none border-2 border-white/20 bg-black/70 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/40 hover:bg-black/90",
            triggerClassName,
          )}
        >
          <ShoppingBag className="size-4" aria-hidden />
          <span>Cart</span>
          {count > 0 && (
            <span className="bg-accent-muted/80 min-w-6 rounded-full px-1.5 text-center text-xs text-black">
              {count}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full flex-col bg-black text-white border-white/10 sm:max-w-md"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle className="text-white">Your cart</SheetTitle>
        </SheetHeader>

        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
          {isLoading && (
            <p className="text-sm text-white/60">Loading cart…</p>
          )}
          {!isLoading && (!cart || cart.lines.length === 0) && (
            <p className="text-sm text-white/60">Your cart is empty.</p>
          )}
          {cart &&
            cart.lines.map((line) => (
              <div
                key={line.id}
                className="flex gap-3 border-b border-white/10 pb-4"
              >
                <div className="relative size-16 shrink-0 overflow-hidden border border-white/10 bg-black/50">
                  {line.imageUrl ? (
                    <Image
                      src={line.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-white/40">
                      No img
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight text-white">
                    {line.productTitle}
                  </p>
                  {line.variantTitle ? (
                    <p className="mt-0.5 text-xs text-white/50">
                      {line.variantTitle}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-white/80">
                    {formatMoney(line.lineTotal, line.currencyCode)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 border border-white/20">
                      <button
                        type="button"
                        className="px-2 py-1 text-sm hover:bg-white/10 disabled:opacity-40"
                        disabled={updateLine.isPending || line.quantity <= 1}
                        onClick={() =>
                          updateLine.mutate({
                            lineId: line.id,
                            quantity: line.quantity - 1,
                          })
                        }
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center text-sm">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="px-2 py-1 text-sm hover:bg-white/10 disabled:opacity-40"
                        disabled={updateLine.isPending || line.quantity >= 99}
                        onClick={() =>
                          updateLine.mutate({
                            lineId: line.id,
                            quantity: line.quantity + 1,
                          })
                        }
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-300 underline hover:text-red-200"
                      disabled={removeLines.isPending}
                      onClick={() =>
                        removeLines.mutate({ lineIds: [line.id] })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {cart && cart.lines.length > 0 && (
          <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Subtotal</span>
              <span className="font-semibold text-white">
                {formatMoney(cart.subtotalAmount, currency)}
              </span>
            </div>
            {cart.checkoutUrl ? (
              <Button asChild className="w-full" size="lg">
                <a href={cart.checkoutUrl}>Checkout</a>
              </Button>
            ) : (
              <p className="text-center text-xs text-amber-200/90">
                Checkout link is not available yet. Add more items or try again.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
