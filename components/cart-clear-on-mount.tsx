"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useCart } from "@/components/cart-provider";

/**
 * Empties the cart exactly once when the page loads with `?clear_cart=1`.
 *
 * The cart-aware checkout action redirects to
 * `/buyer/orders?created=<id>&clear_cart=1`. That URL hits this
 * component, which:
 *   1. Reads `clear_cart=1` via `useSearchParams`.
 *   2. Calls `useCart().clear()` once on mount (guarded by a ref to
 *      survive React 18 StrictMode double-invoking effects in dev).
 *   3. Strips the param via `router.replace` so a back-button visit
 *      doesn't re-trigger the clear.
 *
 * Buy-now flow at `/checkout/[listingId]` never sets the flag, so its
 * behaviour is unchanged.
 */
export function CartClearOnMount() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { clear, ready } = useCart();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    if (!ready) return;
    if (searchParams.get("clear_cart") !== "1") return;

    handledRef.current = true;
    clear();

    // Strip just the clear_cart param; preserve created / other params.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("clear_cart");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [clear, pathname, ready, router, searchParams]);

  return null;
}
