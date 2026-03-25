"use client";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { toast } from "sonner";

export function ShopifyIntegrationManager() {
  const utils = api.useUtils();
  const { data: status, isLoading } = api.shopify.getCacheStatus.useQuery();

  const syncMutation = api.shopify.syncProducts.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Synced ${result.upserted} product(s) from Shopify${
          result.removed > 0
            ? `; removed ${result.removed} stale row(s) from the cache`
            : ""
        }.`,
      );
      void utils.shopify.getCacheStatus.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Sync failed.");
    },
  });

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Shopify storefront sync</CardTitle>
          <CardDescription>
            Pulls products from the Shopify Storefront API (using your{" "}
            <span className="text-foreground">*.myshopify.com</span> domain and
            Storefront access token) and stores them in the database. The public
            merch page reads from this cache.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
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
            {syncMutation.isPending ? "Syncing…" : "Sync now"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
