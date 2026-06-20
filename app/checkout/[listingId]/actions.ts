"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { createOrderFromLineItems } from "@/lib/checkout-order";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateAndNormalizeZaPhone } from "@/lib/validators";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readFiniteNumber(formData: FormData, key: string) {
  const raw = readString(formData, key);
  if (!raw) {
    return null;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Read + validate the quantity from FormData. Defaults to 1 and clamps
 * to [1, 99] — the upper bound matches the per-line cap on
 * `order_items.quantity`. Anything non-integer (e.g. "garbage", "2.5")
 * falls back to 1 silently rather than erroring; the cart + checkout
 * page both clamp client-side too.
 */
function readQuantity(formData: FormData): number {
  const raw = readString(formData, "quantity");
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  if (parsed > 99) return 99;
  return parsed;
}

/**
 * Buy-now action — single listing per order, kept on its own URL
 * (`/checkout/[listingId]`) so the listing-detail "Checkout" CTA stays
 * a one-click shortcut. Wraps the shared
 * `createOrderFromLineItems` helper with a one-element items array.
 */
export async function createOrderRequestAction(formData: FormData) {
  const { profile } = await requireRole(["buyer"]);
  const listingId = readString(formData, "listing_id");

  if (!listingId) {
    redirect("/listings");
  }

  const buyerName = readString(formData, "buyer_name") || profile.full_name || "";
  const buyerPhone = readString(formData, "buyer_phone") || profile.phone || "";
  const buyerWhatsapp = readString(formData, "buyer_whatsapp");
  // Silent — never asked at checkout. Falls back to profile.email so
  // backend emails (provider notification etc.) still have a target.
  const buyerEmail = profile.email;
  const deliveryAddress = readString(formData, "delivery_address");
  const suburb = readString(formData, "suburb");
  const buyerNotes = readString(formData, "buyer_notes") || null;
  const requestedDate = readString(formData, "requested_date") || null;
  const requestedTime = readString(formData, "requested_time") || null;
  const quantity = readQuantity(formData);

  if (!buyerName || !buyerPhone || !buyerWhatsapp) {
    redirect(
      `/checkout/${listingId}?error=${encodeURIComponent(
        "Name, phone and WhatsApp are required."
      )}`
    );
  }

  const phoneResult = validateAndNormalizeZaPhone(buyerPhone);
  if (!phoneResult.ok) {
    redirect(
      `/checkout/${listingId}?error=${encodeURIComponent(
        `Phone: ${phoneResult.error}`
      )}`
    );
  }
  const normalizedBuyerPhone = phoneResult.value;

  const whatsappResult = validateAndNormalizeZaPhone(buyerWhatsapp);
  if (!whatsappResult.ok) {
    redirect(
      `/checkout/${listingId}?error=${encodeURIComponent(
        `WhatsApp: ${whatsappResult.error}`
      )}`
    );
  }
  const normalizedBuyerWhatsapp = whatsappResult.value;

  const supabase = await createSupabaseServerClient();

  const result = await createOrderFromLineItems({
    supabase,
    profile,
    items: [{ listingId, quantity }],
    buyer: {
      name: buyerName,
      phone: normalizedBuyerPhone,
      email: buyerEmail,
      whatsapp: normalizedBuyerWhatsapp,
      notes: buyerNotes,
      requestedDate,
      requestedTime
    },
    delivery: {
      address: deliveryAddress,
      suburb,
      lat: readFiniteNumber(formData, "delivery_lat"),
      lng: readFiniteNumber(formData, "delivery_lng")
    }
  });

  if (!result.ok) {
    redirect(`/checkout/${listingId}?error=${encodeURIComponent(result.error)}`);
  }

  redirect(`/buyer/orders?created=${result.orderId}`);
}
