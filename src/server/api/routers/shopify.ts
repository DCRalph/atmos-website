import { z } from "zod";
import type { CachedVariant } from "~/lib/shopify";
import {
  fetchStorefrontProducts,
  storefrontCartLinesAdd,
  storefrontCartLinesRemove,
  storefrontCartLinesUpdate,
  storefrontCreateCartWithLines,
  storefrontGetCart,
} from "~/lib/shopify";
import {
  clearCartCookie,
  parseCartIdFromHeaders,
  setCartCookie,
} from "~/server/shopify-cart-cookie";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";

function rowVariantsToCached(r: {
  variantsJson: string | null;
  variantId: string | null;
  price: number;
  currencyCode: string;
  imageUrl: string | null;
}): CachedVariant[] {
  if (r.variantsJson) {
    try {
      const parsed = JSON.parse(r.variantsJson) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as CachedVariant[];
      }
    } catch {
      // ignore bad JSON
    }
  }
  if (r.variantId) {
    return [
      {
        id: r.variantId,
        title: "Default",
        price: r.price,
        currencyCode: r.currencyCode,
        availableForSale: true,
        imageUrl: r.imageUrl,
      },
    ];
  }
  return [];
}

function mapCachedProductRow(r: {
  shopifyProductId: string;
  title: string;
  description: string;
  price: number;
  currencyCode: string;
  imageUrl: string | null;
  handle: string;
  variantId: string | null;
  variantsJson: string | null;
}) {
  const variants = rowVariantsToCached(r);
  return {
    id: r.shopifyProductId,
    title: r.title,
    description: r.description,
    price: r.price,
    currencyCode: r.currencyCode,
    image: r.imageUrl,
    handle: r.handle,
    variantId: r.variantId,
    variants,
  };
}

export const shopifyRouter = createTRPCRouter({
  getProducts: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;

      const rows = await ctx.db.shopifyProductCache.findMany({
        orderBy: [{ sortOrder: "asc" }, { syncedAt: "desc" }],
        take: limit,
      });

      return rows.map(mapCachedProductRow);
    }),

  getProductByHandle: publicProcedure
    .input(
      z.object({
        handle: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.shopifyProductCache.findFirst({
        where: { handle: input.handle },
        orderBy: [{ syncedAt: "desc" }],
      });
      if (!row) return null;
      return mapCachedProductRow(row);
    }),

  getCart: publicProcedure.query(async ({ ctx }) => {
    const cartId = parseCartIdFromHeaders(ctx.headers);
    if (!cartId) {
      return null;
    }
    const cart = await storefrontGetCart(cartId);
    if (!cart) {
      clearCartCookie(ctx.resHeaders);
      return null;
    }
    return cart;
  }),

  addCartLines: publicProcedure
    .input(
      z.object({
        merchandiseId: z.string(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const line = {
        merchandiseId: input.merchandiseId,
        quantity: input.quantity,
      };
      const existing = parseCartIdFromHeaders(ctx.headers);

      if (!existing) {
        const cart = await storefrontCreateCartWithLines([line]);
        setCartCookie(ctx.resHeaders, cart.id);
        return cart;
      }

      try {
        const cart = await storefrontCartLinesAdd(existing, [line]);
        setCartCookie(ctx.resHeaders, cart.id);
        return cart;
      } catch {
        clearCartCookie(ctx.resHeaders);
        const cart = await storefrontCreateCartWithLines([line]);
        setCartCookie(ctx.resHeaders, cart.id);
        return cart;
      }
    }),

  updateCartLine: publicProcedure
    .input(
      z.object({
        lineId: z.string(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cartId = parseCartIdFromHeaders(ctx.headers);
      if (!cartId) {
        throw new Error("No cart.");
      }
      try {
        const cart = await storefrontCartLinesUpdate(cartId, [
          { id: input.lineId, quantity: input.quantity },
        ]);
        setCartCookie(ctx.resHeaders, cart.id);
        return cart;
      } catch {
        clearCartCookie(ctx.resHeaders);
        throw new Error("Cart expired. Add items again.");
      }
    }),

  removeCartLines: publicProcedure
    .input(
      z.object({
        lineIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cartId = parseCartIdFromHeaders(ctx.headers);
      if (!cartId) {
        throw new Error("No cart.");
      }
      try {
        const cart = await storefrontCartLinesRemove(cartId, input.lineIds);
        setCartCookie(ctx.resHeaders, cart.id);
        return cart;
      } catch {
        clearCartCookie(ctx.resHeaders);
        throw new Error("Cart expired.");
      }
    }),

  getCacheStatus: adminProcedure.query(async ({ ctx }) => {
    const [agg, productCount] = await Promise.all([
      ctx.db.shopifyProductCache.aggregate({
        _max: { syncedAt: true },
      }),
      ctx.db.shopifyProductCache.count(),
    ]);

    return {
      lastSyncedAt: agg._max.syncedAt,
      productCount,
    };
  }),

  syncProducts: adminProcedure.mutation(async ({ ctx }) => {
    const products = await fetchStorefrontProducts({});
    const syncedAt = new Date();
    const ids = products.map((p) => p.id);

    const removed = await ctx.db.$transaction(async (tx) => {
      for (let i = 0; i < products.length; i++) {
        const p = products[i]!;
        const variantsJson = JSON.stringify(p.variants);
        const baseCreate = {
          shopifyProductId: p.id,
          handle: p.handle,
          variantId: p.variantId,
          title: p.title,
          description: p.description,
          price: p.price,
          currencyCode: p.currencyCode,
          imageUrl: p.image,
          sortOrder: i,
          syncedAt,
        };
        const baseUpdate = {
          handle: p.handle,
          variantId: p.variantId,
          title: p.title,
          description: p.description,
          price: p.price,
          currencyCode: p.currencyCode,
          imageUrl: p.image,
          sortOrder: i,
          syncedAt,
        };

        // Keep sync resilient if the running Prisma client is stale and does not
        // know about `variantsJson` yet.
        try {
          await tx.shopifyProductCache.upsert({
            where: { shopifyProductId: p.id },
            create: { ...baseCreate, variantsJson },
            update: { ...baseUpdate, variantsJson },
          });
        } catch {
          await tx.shopifyProductCache.upsert({
            where: { shopifyProductId: p.id },
            create: baseCreate,
            update: baseUpdate,
          });
          // Best-effort write via SQL when ORM types are stale.
          await tx.$executeRaw`
            UPDATE "shopify_product_cache"
            SET "variantsJson" = ${variantsJson}
            WHERE "shopifyProductId" = ${p.id}
          `;
        }
      }

      const deleteResult =
        ids.length === 0
          ? await tx.shopifyProductCache.deleteMany()
          : await tx.shopifyProductCache.deleteMany({
              where: { shopifyProductId: { notIn: ids } },
            });

      const afterCount = await tx.shopifyProductCache.count();
      return {
        deletedFromCache: deleteResult.count,
        afterCount,
      };
    });

    return {
      upserted: products.length,
      removed: removed.deletedFromCache,
      lastSyncedAt: syncedAt,
      productCount: removed.afterCount,
    };
  }),
});
