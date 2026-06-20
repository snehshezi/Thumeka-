import "server-only";

import {
  geocodeAddress,
  getDrivingDistanceKm,
  haversineKm,
  type LatLng
} from "@/lib/maps";
import {
  calculateDeliveryFee,
  calculateOrderFinancials
} from "@/lib/order-rules";
import { toLatLng } from "@/lib/geo";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DeliveryQuote = {
  distanceKm: number;
  deliveryFee: number;
  buyerTotal: number;
  /** Unit price snapshot — for `orders.listing_price`. */
  listingPrice: number;
  /** Units of the listing being quoted. */
  quantity: number;
  /** `listingPrice * quantity`. The buyer's subtotal before delivery. */
  lineSubtotal: number;
  baseFee: number;
  pricePerKm: number;
  commissionPercentage: number;
  commissionAmount: number;
  deliveryCommissionPercentage: number;
  deliveryCommissionAmount: number;
  providerEarning: number;
  driverEarning: number;
  deliveryLat: number | null;
  deliveryLng: number | null;
};

type QuoteInput = {
  listingId: string;
  address: string;
  suburb?: string;
  /** Units of the listing being ordered. Defaults to 1. Clamped to
   *  [1, 99] — anything else is treated as 1 (caller validates upstream). */
  quantity?: number;
  /** Multi-item override. When set, the financials use this as the
   *  buyer's subtotal across the cart instead of `unitPrice × quantity`.
   *  The caller (cart-checkout) computes it server-side from the live
   *  prices of all listings in the cart. */
  lineSubtotalOverride?: number;
  /** Pre-resolved destination coordinates (e.g. from Places Autocomplete). When
   * present and valid, the server skips its own geocoding call and uses them
   * directly. */
  dest?: { lat: number; lng: number } | null;
};

/**
 * Authoritative delivery-fee quote: geocodes the buyer's address, measures the
 * driving distance to the listing's fulfilment location, and prices the order.
 *
 * Returns null when the fee cannot be determined (listing missing, or no
 * distance could be resolved) so callers block rather than guess. Both the
 * preview API and order submission call this so the displayed fee and the
 * stored fee always agree, and the client-sent value is never trusted.
 */
export async function getDeliveryQuote({
  listingId,
  address,
  suburb,
  quantity,
  lineSubtotalOverride,
  dest: clientDest
}: QuoteInput): Promise<DeliveryQuote | null> {
  const trimmedAddress = address.trim();
  if (!listingId || !trimmedAddress) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: listing }, { data: settings }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, price, fulfillment_lat, fulfillment_lng")
      .eq("id", listingId)
      .eq("is_active", true)
      .eq("admin_disabled", false)
      .maybeSingle(),
    supabase
      .from("admin_settings")
      .select(
        "driver_base_rate, driver_per_km_rate, commission_percentage, delivery_commission_percentage"
      )
      .limit(1)
      .maybeSingle()
  ]);

  if (!listing) {
    return null;
  }

  const origin = toLatLng(listing.fulfillment_lat, listing.fulfillment_lng);
  const trustedDest =
    clientDest && Number.isFinite(clientDest.lat) && Number.isFinite(clientDest.lng)
      ? { lat: clientDest.lat, lng: clientDest.lng }
      : null;
  const resolved = await resolveDistance(origin, trimmedAddress, suburb, trustedDest);
  if (resolved === null) {
    return null;
  }
  const { distanceKm, dest } = resolved;

  const baseFee = Number(settings?.driver_base_rate ?? 36);
  const pricePerKm = Number(settings?.driver_per_km_rate ?? 0);
  const commissionPercentage = Number(settings?.commission_percentage ?? 12);
  const deliveryCommissionPercentage = Number(
    settings?.delivery_commission_percentage ?? 8
  );

  const deliveryFee = calculateDeliveryFee({
    baseFee,
    distanceKm,
    pricePerKm
  });
  const financials = calculateOrderFinancials({
    listingPrice: listing.price,
    deliveryFee,
    commissionPercentage,
    deliveryCommissionPercentage,
    quantity,
    lineSubtotalOverride
  });

  return {
    distanceKm,
    deliveryFee: financials.deliveryFee,
    buyerTotal: financials.buyerTotal,
    listingPrice: financials.listingPrice,
    quantity: financials.quantity,
    lineSubtotal: financials.lineSubtotal,
    baseFee,
    pricePerKm,
    commissionPercentage: financials.commissionPercentage,
    commissionAmount: financials.commissionAmount,
    deliveryCommissionPercentage: financials.deliveryCommissionPercentage,
    deliveryCommissionAmount: financials.deliveryCommissionAmount,
    providerEarning: financials.providerEarning,
    driverEarning: financials.driverEarning,
    deliveryLat: dest?.lat ?? null,
    deliveryLng: dest?.lng ?? null
  };
}

async function resolveDistance(
  origin: LatLng | null,
  address: string,
  suburb?: string,
  preResolvedDest: LatLng | null = null
): Promise<{ distanceKm: number; dest: LatLng | null } | null> {
  if (origin) {
    const dest =
      preResolvedDest ??
      (await geocodeAddress(`${address}, ${suburb ?? ""}, Durban, South Africa`));
    if (dest) {
      const distanceKm =
        (await getDrivingDistanceKm(origin, dest)) ?? haversineKm(origin, dest);
      return { distanceKm, dest };
    }
  }

  // Test/dev seam: lets checkout produce a deterministic quote without a live
  // Google key. Never set DELIVERY_FALLBACK_KM in production.
  const fallback = process.env.DELIVERY_FALLBACK_KM;
  if (fallback) {
    const parsed = Number.parseFloat(fallback);
    return Number.isFinite(parsed) ? { distanceKm: parsed, dest: null } : null;
  }

  return null;
}
