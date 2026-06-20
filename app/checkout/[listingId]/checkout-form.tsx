"use client";

import { useState } from "react";

import { createOrderRequestAction } from "@/app/checkout/[listingId]/actions";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { SubmittingButton } from "@/components/submitting-button";
import { formatMoney } from "@/lib/format";

type CheckoutFormProps = {
  listingId: string;
  listingPrice: string;
  defaultName: string;
  defaultPhone: string;
  /** Buyer's WhatsApp number — pre-filled from `profile.phone` so a
   *  buyer who uses the same number for calls and WhatsApp doesn't have
   *  to type it twice. They can still edit it. */
  defaultWhatsapp: string;
  quantity: number;
};

type Quote = { deliveryFee: number; buyerTotal: number; lineSubtotal: number };

export function CheckoutForm({
  listingId,
  listingPrice,
  defaultName,
  defaultPhone,
  defaultWhatsapp,
  quantity
}: CheckoutFormProps) {
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quotedKey, setQuotedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const currentKey = `${address.trim()}|${suburb.trim()}`;
  const quoteValid = quote !== null && quotedKey === currentKey;

  function invalidateQuote() {
    if (quote !== null) {
      setQuote(null);
      setQuotedKey(null);
    }
    if (quoteError) {
      setQuoteError(null);
    }
  }

  async function calculateQuote(override?: {
    address?: string;
    suburb?: string;
    lat?: number;
    lng?: number;
  }) {
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
          listingId,
          address: effectiveAddress,
          suburb: effectiveSuburb,
          quantity,
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
      setQuotedKey(`${effectiveAddress.trim()}|${effectiveSuburb.trim()}`);
    } catch {
      setQuote(null);
      setQuotedKey(null);
      setQuoteError("Could not reach the delivery service. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={createOrderRequestAction} className="panel space-y-4" data-testid="checkout-form">
      <input name="listing_id" type="hidden" value={listingId} />
      <input name="quantity" type="hidden" value={quantity} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="label">Name</span>
          <input
            className="input"
            data-testid="checkout-buyer-name-input"
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
            data-testid="checkout-buyer-phone-input"
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
          data-testid="checkout-buyer-whatsapp-input"
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
          data-testid="checkout-suburb-input"
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
          data-testid="checkout-delivery-address-input"
          name="delivery_address"
          onPlaceSelected={(place) => {
            setAddress(place.address);
            if (place.suburb) {
              setSuburb(place.suburb);
            }
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
            data-testid="checkout-calculate-delivery-button"
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
              <dt className="text-black/55">
                Item
                {quantity > 1 ? (
                  <span className="ml-1 text-caption text-black/45">
                    ({formatMoney(listingPrice)} × {quantity})
                  </span>
                ) : null}
              </dt>
              <dd className="font-medium" data-testid="checkout-line-subtotal">
                {formatMoney(quote.lineSubtotal)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-black/55">Delivery</dt>
              <dd className="font-medium" data-testid="checkout-delivery-fee">
                {formatMoney(quote.deliveryFee)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-black/10 pt-1.5">
              <dt className="font-semibold text-ink">Total</dt>
              <dd className="font-bold text-leaf" data-testid="checkout-order-total">
                {formatMoney(quote.buyerTotal)}
              </dd>
            </div>
          </dl>
        ) : null}

        {quoteError ? (
          <p
            className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700"
            data-testid="checkout-delivery-error"
          >
            {quoteError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="label">Requested date</span>
          <input className="input" data-testid="checkout-requested-date-input" name="requested_date" type="date" />
        </label>
        <label className="space-y-1">
          <span className="label">Requested time</span>
          <input className="input" data-testid="checkout-requested-time-input" name="requested_time" type="time" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="label">Notes</span>
        <textarea className="input min-h-28" data-testid="checkout-buyer-notes-input" name="buyer_notes" />
      </label>

      <SubmittingButton
        busyLabel="Placing order…"
        className="btn-primary w-full"
        data-testid="checkout-submit-button"
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
