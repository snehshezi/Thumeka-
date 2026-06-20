"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { CART_QUANTITY_MAX, type CartItem } from "@/lib/cart-types";

const STORAGE_KEY = "thumeka.cart.v2";

type AddResult = "added" | "skipped";

/** Shape a caller hands to addItem — quantity is owned by the provider. */
export type CartItemInput = Omit<CartItem, "quantity">;

type CartContextValue = {
  items: CartItem[];
  /** Provider/business of the cart's current items, if any. */
  providerId: string | null;
  businessName: string | null;
  /** Total units across all lines — `sum(item.quantity)`. */
  count: number;
  total: number;
  /** Has the localStorage hydration finished? Use to avoid SSR/CSR flash. */
  ready: boolean;
  isInCart: (listingId: string) => boolean;
  /** Returns the line's current quantity, or 0 if absent. */
  getQuantity: (listingId: string) => number;
  /**
   * Add an item to the cart, or increment its quantity if already present.
   *
   *  - returns `"added"` if the line was added or its quantity bumped
   *  - returns `"skipped"` if the cart had items from a different seller
   *    and the user declined to clear it (via the `onConflict` callback),
   *    or if the line is already at CART_QUANTITY_MAX
   *
   * `onConflict` is async-friendly — pass an async function that resolves
   * to `true` to clear the cart and add the new item. If omitted the
   * conflict is always skipped.
   */
  addItem: (
    item: CartItemInput,
    options?: {
      onConflict?: (currentBusiness: string) => Promise<boolean> | boolean;
    }
  ) => Promise<AddResult>;
  /**
   * Smart decrement used by the cart stepper "−". Drops the quantity by 1;
   * if the line was at 1, removes the line entirely.
   */
  decrementItem: (listingId: string) => void;
  /**
   * Set the line's quantity directly. Clamped to [1, CART_QUANTITY_MAX].
   * If the line isn't in the cart, this is a no-op. To remove, call
   * `removeItem` instead.
   */
  setItemQuantity: (listingId: string, quantity: number) => void;
  /** Remove the entire line regardless of its quantity. */
  removeItem: (listingId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function isCartItem(entry: unknown): entry is CartItem {
  if (entry === null || typeof entry !== "object") return false;
  const record = entry as Record<string, unknown>;
  return (
    typeof record.listingId === "string" &&
    typeof record.providerId === "string" &&
    typeof record.quantity === "number" &&
    record.quantity >= 1
  );
}

function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartItem);
  } catch {
    return [];
  }
}

function writeStoredCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota or storage disabled — swallow; cart state will just be
    // session-local until the next interaction.
  }
}

function clampQuantity(n: number): number {
  if (!Number.isFinite(n)) return 1;
  const intN = Math.floor(n);
  if (intN < 1) return 1;
  if (intN > CART_QUANTITY_MAX) return CART_QUANTITY_MAX;
  return intN;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Empty until hydration so SSR + CSR markup agree.
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(readStoredCart());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeStoredCart(items);
  }, [items, ready]);

  // Keep multiple tabs in sync — a storage event fires in OTHER tabs
  // when localStorage changes. Without this, two browser tabs would drift.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      setItems(readStoredCart());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const providerId = items[0]?.providerId ?? null;
  const businessName = items[0]?.businessName ?? null;
  const count = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );
  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.price ?? 0) * item.quantity,
        0
      ),
    [items]
  );

  const isInCart = useCallback(
    (listingId: string) => items.some((item) => item.listingId === listingId),
    [items]
  );

  const getQuantity = useCallback(
    (listingId: string) =>
      items.find((item) => item.listingId === listingId)?.quantity ?? 0,
    [items]
  );

  const addItem = useCallback<CartContextValue["addItem"]>(
    async (item, options) => {
      const existing = items.find(
        (existingItem) => existingItem.listingId === item.listingId
      );
      if (existing) {
        if (existing.quantity >= CART_QUANTITY_MAX) {
          return "skipped";
        }
        setItems((current) =>
          current.map((entry) =>
            entry.listingId === item.listingId
              ? { ...entry, quantity: entry.quantity + 1 }
              : entry
          )
        );
        return "added";
      }

      if (providerId && providerId !== item.providerId) {
        const shouldReplace = options?.onConflict
          ? await options.onConflict(businessName ?? "another seller")
          : false;
        if (!shouldReplace) return "skipped";
        setItems([{ ...item, quantity: 1 }]);
        return "added";
      }

      setItems((current) => [...current, { ...item, quantity: 1 }]);
      return "added";
    },
    [items, providerId, businessName]
  );

  const decrementItem = useCallback((listingId: string) => {
    setItems((current) => {
      const next: CartItem[] = [];
      for (const entry of current) {
        if (entry.listingId !== listingId) {
          next.push(entry);
          continue;
        }
        if (entry.quantity > 1) {
          next.push({ ...entry, quantity: entry.quantity - 1 });
        }
        // else: drop the line entirely (quantity was 1)
      }
      return next;
    });
  }, []);

  const setItemQuantity = useCallback(
    (listingId: string, quantity: number) => {
      const clamped = clampQuantity(quantity);
      setItems((current) =>
        current.map((entry) =>
          entry.listingId === listingId
            ? { ...entry, quantity: clamped }
            : entry
        )
      );
    },
    []
  );

  const removeItem = useCallback((listingId: string) => {
    setItems((current) =>
      current.filter((item) => item.listingId !== listingId)
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      providerId,
      businessName,
      count,
      total,
      ready,
      isInCart,
      getQuantity,
      addItem,
      decrementItem,
      setItemQuantity,
      removeItem,
      clear
    }),
    [
      items,
      providerId,
      businessName,
      count,
      total,
      ready,
      isInCart,
      getQuantity,
      addItem,
      decrementItem,
      setItemQuantity,
      removeItem,
      clear
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>.");
  }
  return context;
}
