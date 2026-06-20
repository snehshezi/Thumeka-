"use client";

import { Minus, Plus, ShoppingCart } from "lucide-react";

import { useCart } from "@/components/cart-provider";
import type { CartItemInput } from "@/components/cart-provider";
import { CART_QUANTITY_MAX } from "@/lib/cart-types";

type AddToCartButtonProps = {
  item: CartItemInput;
  /**
   * Visual variant:
   *  - "fab": small round "+" floating action button on listing cards.
   *           Morphs into a compact [− N +] pill when in cart.
   *  - "label": full-width "Add to cart" button on the listing detail
   *           page. Morphs into a wider stepper "Remove   N   Add more"
   *           when in cart.
   */
  variant?: "fab" | "label";
  className?: string;
  "data-testid"?: string;
};

/**
 * Add-to-cart / quantity-stepper control. Behaves as Uber-Eats /
 * Mr-D-style: a round "+" until the item is in the cart, then morphs
 * into a stepper pill `[− N +]`. The "−" decrements (and removes the
 * line at N=1); the "+" increments up to CART_QUANTITY_MAX, after which
 * it's visually disabled.
 *
 * Inside a `<Link>` listing card the fab variant calls preventDefault +
 * stopPropagation on every click so taps don't fire the card's
 * navigation.
 */
export function AddToCartButton({
  item,
  variant = "fab",
  className,
  "data-testid": testId
}: AddToCartButtonProps) {
  const { addItem, decrementItem, getQuantity, ready } = useCart();

  const quantity = ready ? getQuantity(item.listingId) : 0;
  const inCart = quantity > 0;
  const atCap = quantity >= CART_QUANTITY_MAX;

  async function handleAdd(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    await addItem(item, {
      onConflict: (currentBusiness) =>
        window.confirm(
          `Your cart has items from ${currentBusiness}. Replace with this item from ${item.businessName ?? "this seller"}?`
        )
    });
  }

  function handleDecrement(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    decrementItem(item.listingId);
  }

  function swallowClick(event: React.MouseEvent) {
    // The pill wrapper sits inside a parent <Link> on listing cards.
    // Without this, taps on the gap between buttons would navigate.
    event.preventDefault();
    event.stopPropagation();
  }

  if (variant === "fab") {
    if (!inCart) {
      return (
        <button
          aria-label="Add to cart"
          className={`${STYLE_FAB_IDLE} ${className ?? ""}`}
          data-testid={testId ?? "add-to-cart-fab"}
          onClick={handleAdd}
          type="button"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
        </button>
      );
    }
    return (
      <div
        aria-label={`In cart: ${quantity}`}
        className={`${STYLE_STEPPER_FAB} ${className ?? ""}`}
        data-testid={testId ?? "add-to-cart-fab"}
        onClick={swallowClick}
        role="group"
      >
        <button
          aria-label={quantity === 1 ? "Remove from cart" : "Decrease quantity"}
          className={STYLE_STEP_BUTTON_FAB}
          data-testid="add-to-cart-fab-decrement"
          onClick={handleDecrement}
          type="button"
        >
          <Minus aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <span
          aria-live="polite"
          className="min-w-[1.25rem] text-center text-xs font-bold text-white"
          data-testid="add-to-cart-fab-quantity"
        >
          {quantity}
        </span>
        <button
          aria-disabled={atCap}
          aria-label={atCap ? "Maximum quantity reached" : "Add another"}
          className={atCap ? STYLE_STEP_BUTTON_FAB_DISABLED : STYLE_STEP_BUTTON_FAB}
          data-testid="add-to-cart-fab-increment"
          disabled={atCap}
          onClick={handleAdd}
          type="button"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // "label" variant — wider stepper for the listing detail page
  if (!inCart) {
    return (
      <button
        className={`${STYLE_LABEL_IDLE} ${className ?? ""}`}
        data-testid={testId ?? "add-to-cart-label"}
        onClick={handleAdd}
        type="button"
      >
        <ShoppingCart aria-hidden="true" className="h-4 w-4" />
        Add to cart
      </button>
    );
  }
  return (
    <div
      aria-label={`In cart: ${quantity}`}
      className={`${STYLE_STEPPER_LABEL} ${className ?? ""}`}
      data-testid={testId ?? "add-to-cart-label"}
      role="group"
    >
      <button
        aria-label={quantity === 1 ? "Remove from cart" : "Decrease quantity"}
        className={STYLE_STEP_BUTTON_LABEL}
        data-testid="add-to-cart-label-decrement"
        onClick={handleDecrement}
        type="button"
      >
        <Minus aria-hidden="true" className="h-4 w-4" />
      </button>
      <span
        aria-live="polite"
        className="px-2 text-sm font-semibold text-leaf"
        data-testid="add-to-cart-label-quantity"
      >
        {quantity} in cart
      </span>
      <button
        aria-disabled={atCap}
        aria-label={atCap ? "Maximum quantity reached" : "Add another"}
        className={atCap ? STYLE_STEP_BUTTON_LABEL_DISABLED : STYLE_STEP_BUTTON_LABEL}
        data-testid="add-to-cart-label-increment"
        disabled={atCap}
        onClick={handleAdd}
        type="button"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

// Idle states — round / full-width add buttons in coral.
const STYLE_FAB_IDLE =
  "inline-flex h-9 w-9 items-center justify-center rounded-full bg-coral text-white shadow-soft transition hover:bg-coral/90 active:scale-95";
const STYLE_LABEL_IDLE =
  "btn-secondary inline-flex items-center justify-center gap-2 w-full sm:w-auto";

// FAB stepper — compact pill that fits inside the card image corner.
const STYLE_STEPPER_FAB =
  "inline-flex items-center gap-0.5 rounded-full bg-leaf px-1 py-1 shadow-soft";
const STYLE_STEP_BUTTON_FAB =
  "inline-flex h-7 w-7 items-center justify-center rounded-full bg-leaf text-white transition hover:bg-leaf/85 active:scale-90";
const STYLE_STEP_BUTTON_FAB_DISABLED =
  "inline-flex h-7 w-7 items-center justify-center rounded-full bg-leaf text-white/40 cursor-not-allowed";

// Label stepper — wider, used on the listing detail page next to Checkout.
const STYLE_STEPPER_LABEL =
  "inline-flex items-center rounded-md border border-leaf bg-mint p-1 w-full justify-between sm:w-auto sm:justify-start";
const STYLE_STEP_BUTTON_LABEL =
  "inline-flex h-8 w-8 items-center justify-center rounded-md bg-white text-leaf transition hover:bg-leaf hover:text-white active:scale-95";
const STYLE_STEP_BUTTON_LABEL_DISABLED =
  "inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/60 text-leaf/40 cursor-not-allowed";
