import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { OrderRequestedEmail } from "@/emails/order-requested";
import { getDeliveryQuote } from "@/lib/delivery";
import { sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import { sendPush } from "@/lib/push";
import { orderRef, pushEvents } from "@/lib/push-events";
import type {
  AdminSettingsRow,
  ProfileRow
} from "@/lib/database.types";
import { computeAcceptanceDeadline } from "@/lib/sla";

export type CheckoutLineItemInput = {
  listingId: string;
  quantity: number;
};

export type CheckoutBuyerInput = {
  /** Visible display name. Used on the order + emails. */
  name: string;
  /** ZA phone, already normalised via `validateAndNormalizeZaPhone`. */
  phone: string;
  /** Silent — taken from `profile.email` by the caller. */
  email: string;
  /** ZA phone, already normalised. Used for the wa.me proof-of-payment flow. */
  whatsapp: string;
  notes: string | null;
  requestedDate: string | null;
  requestedTime: string | null;
};

export type CheckoutDeliveryInput = {
  address: string;
  suburb: string;
  /** Pre-resolved coordinates from Places Autocomplete, if available. */
  lat: number | null;
  lng: number | null;
};

export type CheckoutOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

/**
 * Shared order-creation helper used by both checkout entry points:
 *   - buy-now (`/checkout/[listingId]`) hands in a single-element items
 *     array.
 *   - cart checkout (`/checkout`) hands in the full cart.
 *
 * Validates every line server-side (live DB prices, all listings active
 * and from the same provider), prices delivery against the provider's
 * fulfilment_address, inserts `orders` + `order_items`, and fires the
 * provider's "new order request" email.
 *
 * Returns a discriminated union so callers can branch redirects on the
 * error message — keeps the action thin and the helper agnostic about
 * which URL to fall back to.
 */
export async function createOrderFromLineItems({
  supabase,
  profile,
  items,
  buyer,
  delivery
}: {
  supabase: SupabaseClient;
  profile: ProfileRow;
  items: CheckoutLineItemInput[];
  buyer: CheckoutBuyerInput;
  delivery: CheckoutDeliveryInput;
}): Promise<CheckoutOrderResult> {
  if (items.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  // Normalise + clamp quantities. The cart UI clamps to [1, 99]; this is
  // belt-and-braces against a forged form payload.
  const normalisedItems = items.map((item) => ({
    listingId: item.listingId,
    quantity: clampQuantity(item.quantity)
  }));

  // Fetch every listing in one round trip and verify them.
  const listingIds = normalisedItems.map((item) => item.listingId);
  const { data: listingRows, error: listingsError } = await supabase
    .from("listings")
    .select("id, provider_id, listing_type, price, title, is_active, admin_disabled")
    .in("id", listingIds);

  if (listingsError) {
    return { ok: false, error: "Unable to load your cart items." };
  }

  const listingsById = new Map(
    (listingRows ?? []).map((row) => [row.id as string, row])
  );

  // Verify every requested listing exists and is purchasable. Anything
  // that slipped out from under the buyer (deactivated, admin-disabled,
  // hard-deleted) blocks the whole order — better to surface a clear
  // "one item changed, refresh your cart" error than to partially fulfil.
  for (const { listingId } of normalisedItems) {
    const listing = listingsById.get(listingId);
    if (!listing || !listing.is_active || listing.admin_disabled) {
      return {
        ok: false,
        error:
          "One of your cart items is no longer available. Please refresh your cart and try again."
      };
    }
  }

  // Single-seller invariant — same as the cart UI enforces client-side.
  const providerIds = new Set(
    normalisedItems
      .map(({ listingId }) => listingsById.get(listingId)?.provider_id)
      .filter((id): id is string => typeof id === "string")
  );
  if (providerIds.size !== 1) {
    return {
      ok: false,
      error: "Cart items must be from a single seller."
    };
  }
  const providerId = [...providerIds][0];

  // Compute line subtotal from live DB prices. The cart's price snapshots
  // are informational only — never trusted for the actual order amount.
  let lineSubtotal = 0;
  const orderItemsToInsert = normalisedItems.map((item, position) => {
    const listing = listingsById.get(item.listingId)!;
    const unitPrice = Number(listing.price);
    const subtotal = roundMoney(unitPrice * item.quantity);
    lineSubtotal += subtotal;
    return {
      listingId: item.listingId,
      listing_title: listing.title ?? "Listing",
      listing_price: unitPrice,
      quantity: item.quantity,
      line_subtotal: subtotal,
      position,
      listing_type: listing.listing_type,
      listing_title_for_email: listing.title ?? "Listing"
    };
  });
  lineSubtotal = roundMoney(lineSubtotal);

  // Price delivery against the primary listing's fulfilment_address.
  // All cart items share a provider, so they share the address; the
  // delivery quote depends only on origin (provider) + destination (buyer),
  // not on which listing we pass.
  const primaryListing = listingsById.get(normalisedItems[0].listingId)!;
  const quote = await getDeliveryQuote({
    listingId: primaryListing.id as string,
    address: delivery.address,
    suburb: delivery.suburb,
    quantity: normalisedItems[0].quantity,
    lineSubtotalOverride: lineSubtotal,
    dest:
      delivery.lat !== null && delivery.lng !== null
        ? { lat: delivery.lat, lng: delivery.lng }
        : null
  });

  if (!quote) {
    return {
      ok: false,
      error:
        "We couldn't calculate a delivery fee for that address. Check it and try again."
    };
  }

  // Total qty across all lines — populates the back-compat `orders.quantity`
  // column. The per-order cap was dropped in migration 018; the per-line
  // cap of 99 still applies via the order_items constraint.
  const totalQuantity = normalisedItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // Provider acceptance deadline. Read the SLA window from admin_settings
  // (default 5 minutes per migration 001). When unset, the helper falls
  // back to SLA_DEFAULTS. The cron sweep (migration 020) flips
  // status -> 'expired' for any order_requested past expires_at.
  const { data: settingsRow } = await supabase
    .from("admin_settings")
    .select(
      "provider_acceptance_window_minutes, eft_confirm_window_minutes, driver_assign_window_minutes"
    )
    .limit(1)
    .maybeSingle();
  const expiresAt = computeAcceptanceDeadline(
    new Date(),
    settingsRow as Partial<AdminSettingsRow> | null
  );

  // Insert the orders row first so we have an id for order_items FKs.
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      buyer_id: profile.id,
      provider_id: providerId,
      // Primary line — informational at the order level, authoritative
      // list is in order_items.
      listing_id: primaryListing.id,
      order_type: primaryListing.listing_type,
      status: "order_requested",
      buyer_name: buyer.name,
      buyer_phone: buyer.phone,
      buyer_email: buyer.email,
      buyer_whatsapp: buyer.whatsapp,
      delivery_address: delivery.address || null,
      delivery_lat: quote.deliveryLat,
      delivery_lng: quote.deliveryLng,
      suburb: delivery.suburb || null,
      buyer_notes: buyer.notes,
      requested_date: buyer.requestedDate,
      requested_time: buyer.requestedTime,
      listing_price: Number(primaryListing.price), // primary line unit price
      quantity: totalQuantity,
      delivery_distance_km: quote.distanceKm,
      delivery_base_fee: quote.baseFee,
      delivery_price_per_km: quote.pricePerKm,
      delivery_fee: quote.deliveryFee,
      buyer_total: quote.buyerTotal,
      commission_percentage: quote.commissionPercentage,
      commission_amount: quote.commissionAmount,
      delivery_commission_amount: quote.deliveryCommissionAmount,
      provider_earning: quote.providerEarning,
      driver_earning: quote.driverEarning,
      payment_status: "not_requested",
      expires_at: expiresAt.toISOString()
    })
    .select("id")
    .single();

  if (orderError || !orderRow) {
    return { ok: false, error: "Unable to create order request." };
  }
  const orderId = orderRow.id as string;

  // Insert all line items. On failure we delete the order to avoid an
  // orphan with no items — RLS allows the buyer to delete their own row
  // immediately after creating it.
  const { error: itemsError } = await supabase.from("order_items").insert(
    orderItemsToInsert.map((row) => ({
      order_id: orderId,
      listing_id: row.listingId,
      listing_title: row.listing_title,
      listing_price: row.listing_price,
      quantity: row.quantity,
      line_subtotal: row.line_subtotal,
      position: row.position
    }))
  );

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", orderId);
    return { ok: false, error: "Unable to record your cart items." };
  }

  await supabase.from("order_status_events").insert({
    order_id: orderId,
    new_status: "order_requested",
    changed_by: profile.id,
    note: "Buyer submitted order request"
  });

  // Notify provider — fetch their email + business name once.
  const { data: providerProfile } = await supabase
    .from("provider_profiles")
    .select("user_id, business_name")
    .eq("id", providerId)
    .maybeSingle();

  if (providerProfile) {
    const { data: providerUserProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", providerProfile.user_id)
      .maybeSingle();

    if (providerUserProfile) {
      const emailLineItems = orderItemsToInsert.map((item) => ({
        title: item.listing_title_for_email,
        price: item.listing_price,
        quantity: item.quantity,
        subtotal: item.line_subtotal
      }));

      sendEmail({
        to: providerUserProfile.email,
        subject: "New order request — Thumeka",
        react: OrderRequestedEmail({
          providerName:
            providerProfile.business_name ??
            providerUserProfile.full_name ??
            providerUserProfile.email,
          buyerName: buyer.name,
          buyerPhone: buyer.phone,
          buyerEmail: buyer.email,
          // Single-line orders keep the old visual: one listing line.
          // Multi-line orders use the lineItems table render in the email.
          listingTitle: primaryListing.title ?? "Listing",
          listingPrice: Number(primaryListing.price),
          quantity: orderItemsToInsert[0].quantity,
          lineSubtotal: quote.lineSubtotal,
          lineItems: emailLineItems.length > 1 ? emailLineItems : undefined,
          deliveryAddress: delivery.address || null,
          suburb: delivery.suburb || null,
          buyerNotes: buyer.notes,
          requestedDate: buyer.requestedDate,
          requestedTime: buyer.requestedTime,
          orderId,
          appUrl: getAppUrl(),
          dashboardUrl: `${getAppUrl()}/provider/dashboard`,
        }),
      }).catch((err: Error) =>
        console.warn("[email] Order request email failed:", err.message)
      );
    }

    // Push the provider in parallel with the email — they see the order
    // land the moment the buyer submits. Wrapped so push failures can't
    // break order creation; we already have the orderId committed.
    try {
      await sendPush({
        userId: providerProfile.user_id,
        ...pushEvents.providerNewOrder(
          primaryListing.title ?? "an order",
          orderRef(orderId)
        )
      });
    } catch (err) {
      console.warn(
        "[push] provider new-order failed:",
        (err as Error).message
      );
    }
  }

  return { ok: true, orderId };
}

function clampQuantity(n: number): number {
  if (!Number.isInteger(n)) return 1;
  if (n < 1) return 1;
  if (n > 99) return 99;
  return n;
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
