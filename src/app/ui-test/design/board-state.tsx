"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Shared state for the mock board, so elements in different sections behave
 * like one site: adding merch updates the nav badge, opens toasts, and fills
 * the cart sheet. Overlays portal into `portalContainer` so they keep the
 * board's fonts and accent variables.
 */

export type CartItem = {
  id: string;
  name: string;
  colour: string;
  size: string;
  price: number;
  image: string;
  qty: number;
};

type CartAction =
  | { type: "add"; item: Omit<CartItem, "id" | "qty"> }
  | { type: "remove"; id: string }
  | { type: "qty"; id: string; qty: number };

function cartReducer(items: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case "add": {
      const id = `${action.item.name}-${action.item.colour}-${action.item.size}`;
      const existing = items.find((i) => i.id === id);
      return existing
        ? items.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i))
        : [...items, { ...action.item, id, qty: 1 }];
    }
    case "remove":
      return items.filter((i) => i.id !== action.id);
    case "qty":
      return action.qty <= 0
        ? items.filter((i) => i.id !== action.id)
        : items.map((i) =>
            i.id === action.id ? { ...i, qty: action.qty } : i,
          );
  }
}

export type Toast = {
  id: number;
  title: string;
  tone: "success" | "error" | "info";
  action?: { label: string; run: () => void };
};

type BoardState = {
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  addToCart: (item: Omit<CartItem, "id" | "qty">) => void;
  removeFromCart: (id: string) => void;
  setCartQty: (id: string, qty: number) => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  portalContainer: HTMLElement | null;
  setPortalContainer: (el: HTMLElement | null) => void;
};

const BoardContext = createContext<BoardState | null>(null);

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside <BoardProvider>");
  return ctx;
}

const TOAST_MS = 4500;

export function BoardProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, []);
  const [cartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const nextToastId = useRef(0);

  const dismissToast = useCallback(
    (id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)),
    [],
  );

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++nextToastId.current;
      // Newest first, three at most so the stack never covers the page.
      setToasts((ts) => [{ ...t, id }, ...ts].slice(0, 3));
      setTimeout(() => dismissToast(id), TOAST_MS);
    },
    [dismissToast],
  );

  const addToCart = useCallback(
    (item: Omit<CartItem, "id" | "qty">) => {
      dispatch({ type: "add", item });
      toast({
        title: `Added ${item.name}, ${item.size}`,
        tone: "success",
        action: { label: "View cart", run: () => setCartOpen(true) },
      });
    },
    [toast],
  );

  const value = useMemo<BoardState>(
    () => ({
      cart,
      cartCount: cart.reduce((n, i) => n + i.qty, 0),
      cartTotal: cart.reduce((sum, i) => sum + i.qty * i.price, 0),
      addToCart,
      removeFromCart: (id) => dispatch({ type: "remove", id }),
      setCartQty: (id, qty) => dispatch({ type: "qty", id, qty }),
      cartOpen,
      setCartOpen,
      toasts,
      toast,
      dismissToast,
      portalContainer,
      setPortalContainer,
    }),
    [cart, addToCart, cartOpen, toasts, toast, dismissToast, portalContainer],
  );

  return (
    <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
  );
}

export const formatPrice = (n: number) => `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
