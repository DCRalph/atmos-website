import { z } from "zod";
import type { CachedVariant } from "~/lib/shopify";
import {
  fetchStorefrontProducts,
  fetchStorefrontProductByHandle,
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

type DbClient = typeof import("~/server/db").db;
type ShopifyCacheReader = Pick<DbClient, "shopifyProductCache">;
type ShopifyCacheWriter = Pick<DbClient, "shopifyProductCache" | "$executeRaw">;

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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isExpiredCartError(error: unknown): boolean {
  const msg = getErrorMessage(error).toLowerCase();
  return (
    msg.includes("cart") &&
    (msg.includes("expired") ||
      msg.includes("does not exist") ||
      msg.includes("not found") ||
      msg.includes("invalid"))
  );
}

function isInvalidMerchandiseError(error: unknown): boolean {
  const msg = getErrorMessage(error).toLowerCase();
  return (
    msg.includes("merchandise") ||
    msg.includes("product variant") ||
    msg.includes("variant") ||
    msg.includes("line is invalid")
  );
}

function pickVariantForRetry(
  variants: CachedVariant[],
  preferredTitle?: string | null,
): CachedVariant | undefined {
  const normalizedTitle = preferredTitle?.trim().toLowerCase();
  if (normalizedTitle) {
    const exactMatch = variants.find(
      (variant) => variant.title.trim().toLowerCase() === normalizedTitle,
    );
    if (exactMatch) {
      return exactMatch;
    }
  }

  return variants.find((variant) => variant.availableForSale) ?? variants[0];
}

async function persistCachedProduct(
  db: ShopifyCacheWriter,
  product: {
    id: string;
    handle: string;
    variantId: string | null;
    title: string;
    description: string;
    price: number;
    currencyCode: string;
    image: string | null;
    variants: CachedVariant[];
  },
  options?: { sortOrder?: number; syncedAt?: Date },
) {
  const syncedAt = options?.syncedAt ?? new Date();
  const sortOrder = options?.sortOrder ?? 0;
  const variantsJson = JSON.stringify(product.variants);
  const baseCreate = {
    shopifyProductId: product.id,
    handle: product.handle,
    variantId: product.variantId,
    title: product.title,
    description: product.description,
    price: product.price,
    currencyCode: product.currencyCode,
    imageUrl: product.image,
    sortOrder,
    syncedAt,
  };
  const baseUpdate = {
    handle: product.handle,
    variantId: product.variantId,
    title: product.title,
    description: product.description,
    price: product.price,
    currencyCode: product.currencyCode,
    imageUrl: product.image,
    sortOrder,
    syncedAt,
  };

  try {
    await db.shopifyProductCache.upsert({
      where: { shopifyProductId: product.id },
      create: { ...baseCreate, variantsJson },
      update: { ...baseUpdate, variantsJson },
    });
  } catch {
    await db.shopifyProductCache.upsert({
      where: { shopifyProductId: product.id },
      create: baseCreate,
      update: baseUpdate,
    });
    await db.$executeRaw`
      UPDATE "shopify_product_cache"
      SET "variantsJson" = ${variantsJson}
      WHERE "shopifyProductId" = ${product.id}
    `;
  }
}

async function refreshCachedProductByHandle(
  db: ShopifyCacheWriter,
  handle: string,
  options?: { sortOrder?: number; syncedAt?: Date },
) {
  const liveProduct = await fetchStorefrontProductByHandle(handle);
  if (!liveProduct) {
    return null;
  }

  await persistCachedProduct(db, liveProduct, options);
  return liveProduct;
}

async function findRecoveryTarget(
  db: ShopifyCacheReader,
  merchandiseId: string,
  productHandle?: string,
  variantTitle?: string,
) {
  if (productHandle) {
    const row = await db.shopifyProductCache.findFirst({
      where: { handle: productHandle },
      orderBy: [{ syncedAt: "desc" }],
    });

    return {
      handle: productHandle,
      variantTitle: variantTitle ?? null,
      sortOrder: row?.sortOrder ?? 0,
    };
  }

  const row = await db.shopifyProductCache.findFirst({
    where: {
      OR: [
        { variantId: merchandiseId },
        { variantsJson: { contains: merchandiseId } },
      ],
    },
    orderBy: [{ syncedAt: "desc" }],
  });

  if (!row) {
    return null;
  }

  const cached = mapCachedProductRow(row);
  const matchedVariant = cached.variants.find((variant) => variant.id === merchandiseId);

  return {
    handle: row.handle,
    variantTitle: variantTitle ?? matchedVariant?.title ?? null,
    sortOrder: row.sortOrder,
  };
}

type CheckoutLineInput = {
  merchandiseId: string;
  quantity: number;
  productHandle?: string;
  variantTitle?: string;
};

function pickVariantForCheckout(
  variants: CachedVariant[],
  line: CheckoutLineInput,
): CachedVariant | undefined {
  const exactMatch = variants.find((variant) => variant.id === line.merchandiseId);
  if (exactMatch) {
    return exactMatch;
  }

  return pickVariantForRetry(variants, line.variantTitle);
}

async function resolveCheckoutLinesFromLive(
  db: ShopifyCacheWriter,
  lines: CheckoutLineInput[],
) {
  const resolved: CheckoutLineInput[] = [];

  for (const line of lines) {
    if (!line.productHandle) {
      resolved.push(line);
      continue;
    }

    const cachedRow = await db.shopifyProductCache.findFirst({
      where: { handle: line.productHandle },
      orderBy: [{ syncedAt: "desc" }],
    });

    const liveProduct = await refreshCachedProductByHandle(db, line.productHandle, {
      sortOrder: cachedRow?.sortOrder ?? 0,
    });

    const liveVariant = liveProduct
      ? pickVariantForCheckout(liveProduct.variants, line)
      : undefined;

    resolved.push({
      ...line,
      merchandiseId: liveVariant?.id ?? line.merchandiseId,
      variantTitle: liveVariant?.title ?? line.variantTitle,
    });
  }

  const merged = new Map<string, CheckoutLineInput>();
  for (const line of resolved) {
    const existing = merged.get(line.merchandiseId);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + line.quantity);
      continue;
    }
    merged.set(line.merchandiseId, { ...line });
  }

  return [...merged.values()];
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
      const cached = row ? mapCachedProductRow(row) : null;

      if (!cached || cached.variants.length === 0) {
        const liveProduct = await refreshCachedProductByHandle(ctx.db, input.handle, {
          sortOrder: row?.sortOrder ?? 0,
        });
        return liveProduct ?? cached;
      }

      return cached;
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
        productHandle: z.string().min(1).optional(),
        variantTitle: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const line = (merchandiseId: string) => ({
        merchandiseId,
        quantity: input.quantity,
      });
      const existing = parseCartIdFromHeaders(ctx.headers);

      const finalizeCart = <T extends { id: string }>(cart: T) => {
        setCartCookie(ctx.resHeaders, cart.id);
        return cart;
      };

      const createCart = async (merchandiseId: string) => {
        const cart = await storefrontCreateCartWithLines([line(merchandiseId)]);
        return finalizeCart(cart);
      };

      const addToExistingCart = async (cartId: string, merchandiseId: string) => {
        const cart = await storefrontCartLinesAdd(cartId, [line(merchandiseId)]);
        return finalizeCart(cart);
      };

      const retryWithLiveVariant = async () => {
        const recoveryTarget = await findRecoveryTarget(
          ctx.db,
          input.merchandiseId,
          input.productHandle,
          input.variantTitle,
        );
        if (!recoveryTarget) {
          return null;
        }

        const liveProduct = await refreshCachedProductByHandle(
          ctx.db,
          recoveryTarget.handle,
          { sortOrder: recoveryTarget.sortOrder },
        );
        if (!liveProduct) {
          return null;
        }

        const liveVariant = pickVariantForRetry(
          liveProduct.variants,
          recoveryTarget.variantTitle,
        );
        if (!liveVariant?.id) {
          return null;
        }

        if (existing) {
          return addToExistingCart(existing, liveVariant.id);
        }

        return createCart(liveVariant.id);
      };

      if (!existing) {
        try {
          return await createCart(input.merchandiseId);
        } catch (error) {
          if (isInvalidMerchandiseError(error)) {
            const recoveredCart = await retryWithLiveVariant();
            if (recoveredCart) {
              return recoveredCart;
            }
          }

          throw error;
        }
      }

      try {
        return await addToExistingCart(existing, input.merchandiseId);
      } catch (error) {
        if (isInvalidMerchandiseError(error)) {
          const recoveredCart = await retryWithLiveVariant();
          if (recoveredCart) {
            return recoveredCart;
          }
        }

        if (!isExpiredCartError(error)) {
          throw error;
        }

        clearCartCookie(ctx.resHeaders);

        try {
          return await createCart(input.merchandiseId);
        } catch (recreateError) {
          if (isInvalidMerchandiseError(recreateError)) {
            const recoveredCart = await retryWithLiveVariant();
            if (recoveredCart) {
              return recoveredCart;
            }
          }

          throw recreateError;
        }
      }
    }),

  createCheckout: publicProcedure
    .input(
      z.object({
        lines: z
          .array(
            z.object({
              merchandiseId: z.string(),
              quantity: z.number().int().min(1).max(99),
              productHandle: z.string().min(1).optional(),
              variantTitle: z.string().optional(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const createCheckout = async (lines: CheckoutLineInput[]) => {
        const cart = await storefrontCreateCartWithLines(
          lines.map((line) => ({
            merchandiseId: line.merchandiseId,
            quantity: line.quantity,
          })),
        );

        if (!cart.checkoutUrl) {
          throw new Error("Checkout link is not available yet.");
        }

        return {
          checkoutUrl: cart.checkoutUrl,
        };
      };

      try {
        return await createCheckout(input.lines);
      } catch (error) {
        if (!isInvalidMerchandiseError(error)) {
          throw error;
        }

        const resolvedLines = await resolveCheckoutLinesFromLive(ctx.db, input.lines);
        return createCheckout(resolvedLines);
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
        await persistCachedProduct(tx, p, { sortOrder: i, syncedAt });
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
