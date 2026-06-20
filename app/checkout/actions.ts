"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import {
  createOrderFromLineItems,
  type CheckoutLineItemInput
} from "@/lib/checkout-order";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateAndNormalizeZaPhone } from "@/lib/validators";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readFiniteNumber(formData: FormData, key: string) {
  const raw = readString(formData, key);
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse the `cart_items` hidden field — a JSON-encoded array of
 * `{ listingId, quantity }`. Returns the typed list or `null` if the
 * payload is malformed; caller treats null as "empty cart" and bounces.
 */
function parseCartItems(formData: FormData): CheckoutLineItemInput[] | null {
  const raw = readString(formData, "cart_items");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const items: CheckoutLineItemInput[] = [];
    for (const entry of parsed) {
      if (entry === null || typeof entry !== "object") return null;
      const obj = entry as Record<string, unknown>;
      if (
        typeof obj.listingId !== "string" ||
        typeof obj.quantity !== "number"
      ) {
        return null;
      }
      items.push({
        listingId: obj.listingId,
        quantity: obj.quantity
      });
    }
    return items;
  } catch {
    return null;
  }
}

/**
 * Cart-aware order action. Posts the buyer's full cart (via the
 * `cart_items` hidden input the client form serialises), validates
 * server-side against live DB prices, creates the order + its line
 * items, and redirects to `/buyer/orders` with `clear_cart=1` so the
 * mounted `<CartClearOnMount />` empties localStorage exactly once.
 */
export async function createCartOrderRequestAction(formData: FormData) {
  const { profile } = await requireRole(["buyer"]);

  const items = parseCartItems(formData);
  if (!items || items.length === 0) {
    redirect("/cart");
  }

  const buyerName = readString(formData, "buyer_name") || profile.full_name || "";
  const buyerPhone = readString(formData, "buyer_phone") || profile.phone || "";
  const buyerWhatsapp = readString(formData, "buyer_whatsapp");
  const buyerEmail = profile.email; // silent, from signup
  const deliveryAddress = readString(formData, "delivery_address");
  const suburb = readString(formData, "suburb");
  const buyerNotes = readString(formData, "buyer_notes") || null;
  const requestedDate = readString(formData, "requested_date") || null;
  const requestedTime = readString(formData, "requested_time") || null;

  if (!buyerName || !buyerPhone || !buyerWhatsapp) {
    redirect(
      `/checkout?error=${encodeURIComponent(
        "Name, phone and WhatsApp are required."
      )}`
    );
  }

  const phoneResult = validateAndNormalizeZaPhone(buyerPhone);
  if (!phoneResult.ok) {
    redirect(
      `/checkout?error=${encodeURIComponent(`Phone: ${phoneResult.error}`)}`
    );
  }
  const whatsappResult = validateAndNormalizeZaPhone(buyerWhatsapp);
  if (!whatsappResult.ok) {
    redirect(
      `/checkout?error=${encodeURIComponent(
        `WhatsApp: ${whatsappResult.error}`
      )}`
    );
  }

  const supabase = await createSupabaseServerClient();

  const result = await createOrderFromLineItems({
    supabase,
    profile,
    items,
    buyer: {
      name: buyerName,
      phone: phoneResult.value,
      email: buyerEmail,
      whatsapp: whatsappResult.value,
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
    redirect(`/checkout?error=${encodeURIComponent(result.error)}`);
  }

  redirect(`/buyer/orders?created=${result.orderId}&clear_cart=1`);
}
