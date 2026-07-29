"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ImageOff,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
} from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import { toast } from "sonner";

type ShopifyProduct = RouterOutputs["shopify"]["getProducts"][number];

function formatPrice(price: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price}`;
  }
}

/**
 * Merge the admin's working order with the latest server product set:
 * keep locally-arranged items that still exist (in their current order),
 * append newly-synced products at the end, and drop removed ones. This lets a
 * background refetch refresh the catalog without discarding an in-progress drag.
 */
function reconcileOrder(prev: string[], serverIds: string[]): string[] {
  const serverSet = new Set(serverIds);
  const kept = prev.filter((id) => serverSet.has(id));
  const keptSet = new Set(kept);
  const added = serverIds.filter((id) => !keptSet.has(id));
  return [...kept, ...added];
}

function SortableProductRow({
  id,
  index,
  product,
}: {
  id: string;
  index: number;
  product: ShopifyProduct | undefined;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const variantCount = product?.variants.length ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-border bg-background flex items-center gap-3 rounded-md border px-3 py-2",
        isDragging && "opacity-70 shadow-lg",
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>Drag to reorder</TooltipContent>
      </Tooltip>

      <div className="bg-muted text-muted-foreground grid size-12 shrink-0 place-items-center overflow-hidden rounded border">
        {product?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.title}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImageOff className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {product?.title ?? "Unknown product"}
        </p>
        <p className="text-muted-foreground truncate text-sm">
          {product
            ? `${formatPrice(product.price, product.currencyCode)} · ${variantCount} variant${
                variantCount === 1 ? "" : "s"
              }`
            : "This product is no longer in the cache."}
        </p>
      </div>

      <Badge variant="outline">#{index + 1}</Badge>
    </div>
  );
}

export function ShopifyIntegrationManager() {
  const utils = api.useUtils();
  const { data: status, isLoading: isLoadingStatus } =
    api.shopify.getCacheStatus.useQuery();
  // Admin needs the full catalog to reorder; the public grid uses the default.
  const { data: products, isLoading: isLoadingProducts } =
    api.shopify.getProducts.useQuery({ limit: 250 });

  const [order, setOrder] = useState<string[]>([]);
  const [savedOrder, setSavedOrder] = useState<string[]>([]);

  useEffect(() => {
    if (!products) return;
    const serverIds = products.map((p) => p.id);
    setOrder((prev) => reconcileOrder(prev, serverIds));
    setSavedOrder(serverIds);
  }, [products]);

  const productMap = useMemo(() => {
    const map = new Map<string, ShopifyProduct>();
    for (const p of products ?? []) map.set(p.id, p);
    return map;
  }, [products]);

  const hasChanges = JSON.stringify(order) !== JSON.stringify(savedOrder);
  useUnsavedChangesWarning({ enabled: hasChanges });

  const reorderMutation = api.shopify.reorderProducts.useMutation({
    onSuccess: async () => {
      setSavedOrder(order);
      toast.success("Display order saved.");
      await Promise.all([
        utils.shopify.getProducts.invalidate(),
        utils.shopify.getCacheStatus.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not save the order.");
    },
  });

  const syncMutation = api.shopify.syncProducts.useMutation({
    onSuccess: async (result) => {
      toast.success(
        `Synced ${result.upserted} product(s) from Shopify${
          result.removed > 0
            ? `; removed ${result.removed} stale row(s) from the cache`
            : ""
        }.`,
      );
      await Promise.all([
        utils.shopify.getCacheStatus.invalidate(),
        utils.shopify.getProducts.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message ?? "Sync failed.");
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as string);
    const newIndex = order.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    setOrder(arrayMove(order, oldIndex, newIndex));
  };

  const isSaving = reorderMutation.isPending;

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Shopify storefront sync</CardTitle>
          <CardDescription>
            Pulls products from the Shopify Storefront API (using your{" "}
            <span className="text-foreground">*.myshopify.com</span> domain and
            Storefront access token) and stores them in the database. The public
            merch page reads from this cache. Your display order below is
            preserved across syncs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-muted-foreground text-sm">
            {isLoadingStatus ? (
              <p>Loading cache status…</p>
            ) : (
              <>
                <p>
                  <span className="text-foreground font-medium">
                    {status?.productCount ?? 0}
                  </span>{" "}
                  product(s) in cache
                </p>
                <p>
                  Last sync:{" "}
                  {status?.lastSyncedAt
                    ? new Date(status.lastSyncedAt).toLocaleString()
                    : "Never"}
                </p>
              </>
            )}
          </div>
          <Button
            type="button"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {syncMutation.isPending ? "Syncing…" : "Sync now"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Display order</CardTitle>
              <CardDescription>
                Drag products to set the order they appear on the merch page.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setOrder(savedOrder)}
                disabled={!hasChanges || isSaving}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Discard
              </Button>
              <Button
                onClick={() => reorderMutation.mutate({ ids: order })}
                disabled={!hasChanges || isSaving || order.length === 0}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save order
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {hasChanges ? (
              <Badge variant="secondary">Unsaved changes</Badge>
            ) : (
              <Badge variant="outline">Up to date</Badge>
            )}
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          {isLoadingProducts ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading products…
            </div>
          ) : order.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
              No products in the cache yet. Run a sync above to import products
              from Shopify.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={order}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {order.map((id, index) => (
                    <SortableProductRow
                      key={id}
                      id={id}
                      index={index}
                      product={productMap.get(id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
