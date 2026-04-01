"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "atmos_merch_cart";

export type MerchCartItem = {
  merchandiseId: string;
  productId: string;
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  imageUrl: string | null;
  unitPrice: number;
  currencyCode: string;
  quantity: number;
};

type MerchCartContextValue = {
  items: MerchCartItem[];
  totalQuantity: number;
  subtotalAmount: number;
  currencyCode: string;
  isLoaded: boolean;
  addItem: (item: MerchCartItem) => void;
  updateItemQuantity: (merchandiseId: string, quantity: number) => void;
  removeItem: (merchandiseId: string) => void;
  clearCart: () => void;
};

const MerchCartContext = createContext<MerchCartContextValue | null>(null);

function readStoredCart(): MerchCartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is MerchCartItem =>
        Boolean(
          item &&
            typeof item === "object" &&
            "merchandiseId" in item &&
            "productHandle" in item &&
            "productTitle" in item &&
            "quantity" in item,
        ),
    );
  } catch {
    return [];
  }
}

export function MerchCartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<MerchCartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setItems(readStoredCart());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [isLoaded, items]);

  const addItem = useCallback((item: MerchCartItem) => {
    setItems((current) => {
      const existing = current.find(
        (entry) => entry.merchandiseId === item.merchandiseId,
      );
      if (!existing) {
        return [...current, item];
      }

      return current.map((entry) =>
        entry.merchandiseId === item.merchandiseId
          ? {
              ...entry,
              ...item,
              quantity: Math.min(99, entry.quantity + item.quantity),
            }
          : entry,
      );
    });
  }, []);

  const updateItemQuantity = useCallback(
    (merchandiseId: string, quantity: number) => {
      setItems((current) =>
        current.flatMap((item) => {
          if (item.merchandiseId !== merchandiseId) {
            return [item];
          }

          if (quantity <= 0) {
            return [];
          }

          return [
            {
              ...item,
              quantity: Math.min(99, quantity),
            },
          ];
        }),
      );
    },
    [],
  );

  const removeItem = useCallback((merchandiseId: string) => {
    setItems((current) =>
      current.filter((item) => item.merchandiseId !== merchandiseId),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<MerchCartContextValue>(() => {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotalAmount = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    return {
      items,
      totalQuantity,
      subtotalAmount,
      currencyCode: items[0]?.currencyCode ?? "USD",
      isLoaded,
      addItem,
      updateItemQuantity,
      removeItem,
      clearCart,
    };
  }, [addItem, clearCart, isLoaded, items, removeItem, updateItemQuantity]);

  return (
    <MerchCartContext.Provider value={value}>
      {children}
    </MerchCartContext.Provider>
  );
}

export function useMerchCart() {
  const context = useContext(MerchCartContext);
  if (!context) {
    throw new Error("useMerchCart must be used within a MerchCartProvider");
  }
  return context;
}
