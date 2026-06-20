"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";

import { createCartOrderRequestAction } from "@/app/checkout/actions";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { useCart } from "@/components/cart-provider";
import { SubmittingButton } from "@/components/submitting-button";
import { formatMoney } from "@/lib/format";

type CartCheckoutFormProps = {
  defaultName: string;
  defaultPhone: string;
  defaultWhatsapp: string;
};

type Quote = {
  deliveryFee: number;
  buyerTotal: number;
  lineSubtotal: number;
};

/**
 * Cart-aware checkout form.
 *
 * Reads the cart via `useCart()`, serialises items into a hidden JSON
 * input (`cart_items`), and computes a live delivery-quote preview by
 * POSTing the cart's items + buyer address to `/api/delivery-quote`.
 *
 * Empty carts redirect back to `/cart` on mount.
 *
 * The form's hidden inputs carry everything the action needs; the
 * action re-validates the cart items server-side against live DB prices.
 */
export function CartCheckoutForm({
  defaultName,
  defaultPhone,
  defaultWhatsapp
}: CartCheckoutFormProps) {
  const router = useRouter();
  const { items, ready } = useCart();

  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quotedKey, setQuotedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Snapshot of the cart payload we submit. Server re-validates against
  // live prices — the client's snapshot is just for the request body.
  const cartPayload = useMemo(
    () =>
      items.map((item) => ({
        listingId: item.listingId,
        quantity: item.quantity
      })),
    [items]
  );

  const lineSubtotalPreview = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  // Empty cart → kick back to /cart.
  useEffect(() => {
    if (ready && items.length === 0) {
      router.replace("/cart");
    }
  }, [items.length, ready, router]);

  const currentKey = `${address.trim()}|${suburb.trim()}`;
  const quoteValid = quote !== null && quotedKey === currentKey;

  function invalidateQuote() {
    if (quote !== null) {
      setQuote(null);
      setQuotedKey(null);
    }
    if (quoteError) setQuoteError(null);
  }

  async function calculateQuote(override?: {
    address?: string;
    suburb?: string;
    lat?: number;
    lng?: number;
  }) {
    if (items.length === 0) return;
    const effectiveAddress = override?.address ?? address;
    const effectiveSuburb = override?.suburb ?? suburb;
    if (!effectiveAddress.trim()) {
      setQuoteError("Enter a delivery address first.");
      return;
    }

    setLoading(true);
    setQuoteError(null);
    try {
      const response = await fetch("/api/delivery-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Primary listing — used to look up the provider's fulfilment
          // address. All cart items share a seller, so any one will do.
          listingId: items[0].listingId,
          address: effectiveAddress,
          suburb: effectiveSuburb,
          // For the API's quantity clamp; the lineSubtotal override is
          // what actually drives the financials in multi-item carts.
          quantity: items[0].quantity,
          lineSubtotal: lineSubtotalPreview,
          lat: override?.lat,
          lng: override?.lng
        })
      });
      const data = await response.json();

      if (!response.ok) {
        setQuote(null);
        setQuotedKey(null);
        setQuoteError(data.error ?? "Could not calculate a delivery fee.");
        return;
      }

      setQuote({
        deliveryFee: data.deliveryFee,
        buyerTotal: data.buyerTotal,
        lineSubtotal: data.lineSubtotal
      });
      setQuotedKey(currentKey);
    } catch {
      setQuote(null);
      setQuotedKey(null);
      setQuoteError("Could not reach the delivery service. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // While hydrating from localStorage, render a neutral placeholder so
  // the SSR / first-paint HTML matches without flashing an empty form.
  if (!ready) {
    return (
      <div className="panel text-center text-body-sm text-black/55">
        Loading your cart…
      </div>
    );
  }

  if (items.length === 0) {
    // The useEffect above will redirect us to /cart; this fallback only
    // shows for the brief tick before the router swaps.
    return (
      <div className="panel text-center text-body-sm text-black/55">
        <ShoppingCart aria-hidden="true" className="mx-auto mb-3 h-6 w-6" />
        Your cart is empty.
      </div>
    );
  }

  return (
    <form
      action={createCartOrderRequestAction}
      className="panel space-y-4"
      data-testid="cart-checkout-form"
    >
      <input
        name="cart_items"
        type="hidden"
        value={JSON.stringify(cartPayload)}
      />

      <section
        className="rounded-lg border border-black/10 bg-white p-3"
        data-testid="cart-checkout-items"
      >
        <h2 className="text-sm font-semibold text-ink">Your order</h2>
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li
              className="flex items-center justify-between gap-2 text-sm"
              data-testid="cart-checkout-item"
              key={item.listingId}
            >
              <span className="line-clamp-1 text-ink">
                {item.title}
                {item.quantity > 1 ? (
                  <span className="ml-1 text-caption text-black/45">
                    × {item.quantity}
                  </span>
                ) : null}
              </span>
              <span className="font-medium text-ink">
                {formatMoney(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-black/10 pt-2 text-sm">
          <span className="text-black/55">Subtotal</span>
          <span className="font-semibold text-ink" data-testid="cart-checkout-preview-subtotal">
            {formatMoney(lineSubtotalPreview)}
          </span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="label">Name</span>
          <input
            className="input"
            data-testid="cart-checkout-buyer-name-input"
            defaultValue={defaultName}
            name="buyer_name"
            required
          />
        </label>
        <label className="space-y-1">
          <span className="label">Phone</span>
          <input
            autoComplete="tel"
            className="input"
            data-testid="cart-checkout-buyer-phone-input"
            defaultValue={defaultPhone}
            inputMode="tel"
            maxLength={20}
            name="buyer_phone"
            placeholder="071 234 5678"
            required
            type="tel"
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="label">WhatsApp number</span>
        <input
          autoComplete="tel"
          className="input"
          data-testid="cart-checkout-buyer-whatsapp-input"
          defaultValue={defaultWhatsapp}
          inputMode="tel"
          maxLength={20}
          name="buyer_whatsapp"
          placeholder="071 234 5678"
          required
          type="tel"
        />
        <span className="hint">
          We&apos;ll WhatsApp you to confirm the order and ask for your proof
          of payment.
        </span>
      </label>
      <label className="block space-y-1">
        <span className="label">Suburb / area</span>
        <input
          className="input"
          data-testid="cart-checkout-suburb-input"
          name="suburb"
          onChange={(event) => {
            setSuburb(event.target.value);
            invalidateQuote();
          }}
          placeholder="e.g. Berea"
          value={suburb}
        />
      </label>
      <label className="block space-y-1">
        <span className="label">Delivery or service address</span>
        <AddressAutocomplete
          coordsLatName="delivery_lat"
          coordsLngName="delivery_lng"
          data-testid="cart-checkout-delivery-address-input"
          name="delivery_address"
          onPlaceSelected={(place) => {
            setAddress(place.address);
            if (place.suburb) setSuburb(place.suburb);
            void calculateQuote({
              address: place.address,
              suburb: place.suburb ?? suburb,
              lat: place.lat,
              lng: place.lng
            });
          }}
          onValueChange={(value) => {
            setAddress(value);
            invalidateQuote();
          }}
        />
      </label>

      <div className="rounded-lg border border-black/10 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Delivery fee</p>
            <p className="text-xs text-black/55">
              Calculated from your address to the seller.
            </p>
          </div>
          <button
            className="btn-secondary py-1.5 text-xs"
            data-testid="cart-checkout-calculate-delivery-button"
            disabled={loading || !address.trim()}
            onClick={() => calculateQuote()}
            type="button"
          >
            {loading ? "Calculating…" : "Calculate delivery fee"}
          </button>
        </div>

        {quoteValid && quote ? (
          <dl className="mt-3 space-y-1 border-t border-black/10 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-black/55">Items</dt>
              <dd className="font-medium" data-testid="cart-checkout-line-subtotal">
                {formatMoney(quote.lineSubtotal)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-black/55">Delivery</dt>
              <dd className="font-medium" data-testid="cart-checkout-delivery-fee">
                {formatMoney(quote.deliveryFee)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-black/10 pt-1.5">
              <dt className="font-semibold text-ink">Total</dt>
              <dd className="font-bold text-leaf" data-testid="cart-checkout-order-total">
                {formatMoney(quote.buyerTotal)}
              </dd>
            </div>
          </dl>
        ) : null}

        {quoteError ? (
          <p
            className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700"
            data-testid="cart-checkout-delivery-error"
          >
            {quoteError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="label">Requested date</span>
          <input
            className="input"
            data-testid="cart-checkout-requested-date-input"
            name="requested_date"
            type="date"
          />
        </label>
        <label className="space-y-1">
          <span className="label">Requested time</span>
          <input
            className="input"
            data-testid="cart-checkout-requested-time-input"
            name="requested_time"
            type="time"
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="label">Notes</span>
        <textarea
          className="input min-h-28"
          data-testid="cart-checkout-buyer-notes-input"
          name="buyer_notes"
        />
      </label>

      <SubmittingButton
        busyLabel="Placing order…"
        className="btn-primary w-full"
        data-testid="cart-checkout-submit-button"
        disabled={!quoteValid}
      >
        Submit order request
      </SubmittingButton>
      {!quoteValid ? (
        <p className="text-center text-xs text-black/50">
          Calculate the delivery fee to see your total before submitting.
        </p>
      ) : null}
    </form>
  );
}
