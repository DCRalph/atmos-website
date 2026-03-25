import { createStorefrontApiClient } from "@shopify/storefront-api-client";
import { env } from "~/env";

export const SHOPIFY_API_VERSION = "2026-01";

const STOREFRONT_PAGE_SIZE = 50;
const MAX_STOREFRONT_PAGES = 200;

export type CachedVariant = {
  id: string;
  title: string;
  price: number;
  currencyCode: string;
  availableForSale: boolean;
  imageUrl: string | null;
};

export type StorefrontProduct = {
  id: string;
  title: string;
  description: string;
  price: number;
  currencyCode: string;
  image: string | null;
  handle: string;
  variantId: string | null;
  variants: CachedVariant[];
};

export type StorefrontCartLine = {
  id: string;
  quantity: number;
  merchandiseId: string;
  variantTitle: string;
  productTitle: string;
  imageUrl: string | null;
  lineTotal: number;
  unitPrice: number;
  currencyCode: string;
};

export type StorefrontCart = {
  id: string;
  checkoutUrl: string | null;
  totalQuantity: number;
  lines: StorefrontCartLine[];
  subtotalAmount: number;
  currencyCode: string;
};

type FetchProductsOptions = {
  collectionHandle?: string;
  limit?: number;
};

const productNodeFields = `
  id
  title
  description
  handle
  images(first: 1) {
    edges { node { url altText } }
  }
  variants(first: 250) {
    edges {
      node {
        id
        title
        availableForSale
        image { url }
        price {
          amount
          currencyCode
        }
      }
    }
  }
`;

const collectionProductsQuery = `
  query CollectionProducts($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      products(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            ${productNodeFields}
          }
        }
      }
    }
  }
`;

const productsQuery = `
  query Products($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          ${productNodeFields}
        }
      }
    }
  }
`;

function getStoreDomain(): string {
  return env.SHOPIFY_STORE_DOMAIN.trim();
}

export function getStorefrontClient() {
  return createStorefrontApiClient({
    storeDomain: `https://${getStoreDomain()}`,
    apiVersion: SHOPIFY_API_VERSION,
    publicAccessToken: env.NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN,
    retries: 2,
  });
}

function mapVariants(node: any): CachedVariant[] {
  const edges = node?.variants?.edges ?? [];
  const out: CachedVariant[] = [];
  for (const e of edges) {
    const v = e?.node;
    if (!v?.id) continue;
    out.push({
      id: v.id,
      title: v.title ?? "",
      price: v.price?.amount ? Number(v.price.amount) : 0,
      currencyCode: v.price?.currencyCode ?? "USD",
      availableForSale: Boolean(v.availableForSale),
      imageUrl: v.image?.url ?? null,
    });
  }
  return out;
}

const mapProduct = (node: any): StorefrontProduct => {
  const variants = mapVariants(node);
  const first = variants[0];
  const image = node?.images?.edges?.[0]?.node;

  return {
    id: node.id ?? "",
    title: node.title ?? "",
    description: node.description ?? "",
    price: first?.price ?? 0,
    currencyCode: first?.currencyCode ?? "USD",
    image: image?.url ?? first?.imageUrl ?? null,
    handle: node.handle ?? "",
    variantId: first?.id ?? null,
    variants,
  };
};

export function assertNoErrors(
  label: string,
  errors: { message?: string; graphQLErrors?: unknown[] } | undefined,
) {
  if (errors?.message || errors?.graphQLErrors?.length) {
    const msg =
      errors.message ??
      (errors.graphQLErrors?.[0] as { message?: string } | undefined)?.message ??
      "Unknown Shopify GraphQL error";
    throw new Error(`${label}: ${msg}`);
  }
}

function assertUserErrors(
  label: string,
  userErrors: { field?: string[] | null; message: string }[] | undefined,
) {
  if (userErrors?.length) {
    const msg = userErrors.map((e) => e.message).join("; ");
    throw new Error(`${label}: ${msg}`);
  }
}

/**
 * Fetches products from the Shopify Storefront API (paginated).
 * Uses SHOPIFY_COLLECTION_HANDLE when set, otherwise all products.
 * Omit `limit` to fetch every page (admin sync).
 */
export async function fetchStorefrontProducts(
  options: FetchProductsOptions = {},
): Promise<StorefrontProduct[]> {
  const collectionHandle =
    options.collectionHandle ?? env.SHOPIFY_COLLECTION_HANDLE;

  const client = getStorefrontClient();
  const maxProducts = options.limit;

  const out: StorefrontProduct[] = [];
  let after: string | null | undefined;

  for (let page = 0; page < MAX_STOREFRONT_PAGES; page++) {
    if (maxProducts !== undefined && out.length >= maxProducts) {
      break;
    }

    const first = Math.min(
      STOREFRONT_PAGE_SIZE,
      maxProducts !== undefined ? maxProducts - out.length : STOREFRONT_PAGE_SIZE,
    );
    if (first <= 0) break;

    if (collectionHandle) {
      const { data, errors } = await client.request<{
        collection?: {
          products?: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            edges: { node: unknown }[];
          };
        };
      }>(collectionProductsQuery, {
        variables: { handle: collectionHandle, first, after: after ?? null },
      });

      assertNoErrors("Shopify collection query", errors);

      const productsConn = data?.collection?.products;
      if (!productsConn) {
        break;
      }

      const nodes = productsConn.edges?.map((e) => e?.node).filter(Boolean) ?? [];
      for (const node of nodes) {
        out.push(mapProduct(node));
        if (maxProducts !== undefined && out.length >= maxProducts) {
          break;
        }
      }

      if (!productsConn.pageInfo.hasNextPage || !productsConn.pageInfo.endCursor) {
        break;
      }
      after = productsConn.pageInfo.endCursor;
    } else {
      const { data, errors } = await client.request<{
        products?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          edges: { node: unknown }[];
        };
      }>(productsQuery, {
        variables: { first, after: after ?? null },
      });

      assertNoErrors("Shopify products query", errors);

      const productsConn = data?.products;
      if (!productsConn) {
        break;
      }

      const nodes = productsConn.edges?.map((e) => e?.node).filter(Boolean) ?? [];
      for (const node of nodes) {
        out.push(mapProduct(node));
        if (maxProducts !== undefined && out.length >= maxProducts) {
          break;
        }
      }

      if (!productsConn.pageInfo.hasNextPage || !productsConn.pageInfo.endCursor) {
        break;
      }
      after = productsConn.pageInfo.endCursor;
    }
  }

  return out;
}

/* --- Cart (Storefront API) --- */

const cartFragment = `
  id
  checkoutUrl
  totalQuantity
  cost {
    totalAmount {
      amount
      currencyCode
    }
  }
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
        merchandise {
          ... on ProductVariant {
            id
            title
            product {
              title
              handle
            }
            image {
              url
            }
            price {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;

const getCartQuery = `
  query GetCart($cartId: ID!) {
    cart(id: $cartId) {
      ${cartFragment}
    }
  }
`;

const cartCreateMutation = `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        ${cartFragment}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const cartLinesAddMutation = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ${cartFragment}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const cartLinesUpdateMutation = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ${cartFragment}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const cartLinesRemoveMutation = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ${cartFragment}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function parseCart(data: any): StorefrontCart | null {
  const cart = data?.cart;
  if (!cart?.id) return null;

  const edges = cart.lines?.edges ?? [];
  const lines: StorefrontCartLine[] = [];
  for (const e of edges) {
    const node = e?.node;
    const m = node?.merchandise;
    if (!node?.id || !m?.id) continue;
    const lineAmt = node.cost?.totalAmount;
    const unit = m.price;
    lines.push({
      id: node.id,
      quantity: node.quantity ?? 0,
      merchandiseId: m.id,
      variantTitle: m.title ?? "",
      productTitle: m.product?.title ?? "",
      imageUrl: m.image?.url ?? null,
      lineTotal: lineAmt?.amount ? Number(lineAmt.amount) : 0,
      unitPrice: unit?.amount ? Number(unit.amount) : 0,
      currencyCode: lineAmt?.currencyCode ?? unit?.currencyCode ?? "USD",
    });
  }

  const total = cart.cost?.totalAmount;
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl ?? null,
    totalQuantity: cart.totalQuantity ?? 0,
    lines,
    subtotalAmount: total?.amount ? Number(total.amount) : 0,
    currencyCode: total?.currencyCode ?? "USD",
  };
}

export async function storefrontGetCart(
  cartId: string,
): Promise<StorefrontCart | null> {
  const client = getStorefrontClient();
  const { data, errors } = await client.request<{ cart: unknown }>(getCartQuery, {
    variables: { cartId },
  });
  assertNoErrors("Shopify get cart", errors);
  return parseCart(data);
}

export async function storefrontCreateCartWithLines(
  lines: { merchandiseId: string; quantity: number }[],
): Promise<StorefrontCart> {
  const client = getStorefrontClient();
  const { data, errors } = await client.request<{
    cartCreate?: {
      cart?: unknown;
      userErrors?: { field?: string[] | null; message: string }[];
    };
  }>(cartCreateMutation, {
    variables: {
      input: {
        lines: lines.map((l) => ({
          merchandiseId: l.merchandiseId,
          quantity: l.quantity,
        })),
      },
    },
  });
  assertNoErrors("Shopify cart create", errors);
  assertUserErrors("Shopify cart create", data?.cartCreate?.userErrors);
  const cart = parseCart({ cart: data?.cartCreate?.cart });
  if (!cart) {
    throw new Error("Shopify cart create returned no cart.");
  }
  return cart;
}

export async function storefrontCartLinesAdd(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[],
): Promise<StorefrontCart> {
  const client = getStorefrontClient();
  const { data, errors } = await client.request<{
    cartLinesAdd?: {
      cart?: unknown;
      userErrors?: { field?: string[] | null; message: string }[];
    };
  }>(cartLinesAddMutation, {
    variables: {
      cartId,
      lines: lines.map((l) => ({
        merchandiseId: l.merchandiseId,
        quantity: l.quantity,
      })),
    },
  });
  assertNoErrors("Shopify cart lines add", errors);
  assertUserErrors("Shopify cart lines add", data?.cartLinesAdd?.userErrors);
  const cart = parseCart({ cart: data?.cartLinesAdd?.cart });
  if (!cart) {
    throw new Error("Shopify cart lines add returned no cart.");
  }
  return cart;
}

export async function storefrontCartLinesUpdate(
  cartId: string,
  lines: { id: string; quantity: number }[],
): Promise<StorefrontCart> {
  const client = getStorefrontClient();
  const { data, errors } = await client.request<{
    cartLinesUpdate?: {
      cart?: unknown;
      userErrors?: { field?: string[] | null; message: string }[];
    };
  }>(cartLinesUpdateMutation, {
    variables: {
      cartId,
      lines: lines.map((l) => ({ id: l.id, quantity: l.quantity })),
    },
  });
  assertNoErrors("Shopify cart lines update", errors);
  assertUserErrors("Shopify cart lines update", data?.cartLinesUpdate?.userErrors);
  const cart = parseCart({ cart: data?.cartLinesUpdate?.cart });
  if (!cart) {
    throw new Error("Shopify cart lines update returned no cart.");
  }
  return cart;
}

export async function storefrontCartLinesRemove(
  cartId: string,
  lineIds: string[],
): Promise<StorefrontCart> {
  const client = getStorefrontClient();
  const { data, errors } = await client.request<{
    cartLinesRemove?: {
      cart?: unknown;
      userErrors?: { field?: string[] | null; message: string }[];
    };
  }>(cartLinesRemoveMutation, {
    variables: {
      cartId,
      lineIds,
    },
  });
  assertNoErrors("Shopify cart lines remove", errors);
  assertUserErrors("Shopify cart lines remove", data?.cartLinesRemove?.userErrors);
  const cart = parseCart({ cart: data?.cartLinesRemove?.cart });
  if (!cart) {
    throw new Error("Shopify cart lines remove returned no cart.");
  }
  return cart;
}
