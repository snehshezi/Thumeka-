"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { useCart } from "@/components/cart-provider";

type CartIconProps = {
  className?: string;
};

/**
 * Header cart entry-point. Renders the cart icon with a small count badge
 * when the cart has items. Until the localStorage hydration completes (the
 * `ready` flag flips on mount) the badge is hidden — that keeps the
 * server-rendered markup matching the first client render and avoids the
 * hydration warning.
 */
export function CartIcon({ className }: CartIconProps) {
  const { count, ready } = useCart();
  const showBadge = ready && count > 0;

  return (
    <Link
      aria-label={
        showBadge
          ? `Cart with ${count} item${count === 1 ? "" : "s"}`
          : "Cart"
      }
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink transition hover:text-leaf ${className ?? ""}`}
      data-testid="cart-icon"
      href="/cart"
    >
      <ShoppingCart aria-hidden="true" className="h-5 w-5" />
      {showBadge ? (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold leading-none text-white"
          data-testid="cart-icon-count"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
