"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { OrderAcceptedEftEmail } from "@/emails/order-accepted-eft";
import { createWhatsAppUrl } from "@/lib/support";
import { buildPaymentProofMessage } from "@/lib/whatsapp-message";
import { requireRole } from "@/lib/auth";
import type {
  OrderRow,
  ProviderProfileRow
} from "@/lib/database.types";
import type { ListingType } from "@/lib/constants";
import { sendEmail } from "@/lib/email";
import { sendPush } from "@/lib/push";
import { pushEvents } from "@/lib/push-events";
import { computeResponseRatePct } from "@/lib/sla";
import { getAppUrl } from "@/lib/env";
import { toLatLng } from "@/lib/geo";
import { isValidListingImageStoragePath } from "@/lib/listing-images";
import { geocodeAddress } from "@/lib/maps";
import {
  acceptProviderOrder,
  type OrderForRules
} from "@/lib/order-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveNumber(formData: FormData, key: string) {
  const parsed = Number.parseFloat(readString(formData, key));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function redirectWithError(message: string): never {
  redirect(`/provider/dashboard?error=${encodeURIComponent(message)}`);
}

function readListingType(formData: FormData): ListingType {
  const listingType = readString(formData, "listing_type");
  return ["product", "service", "errand"].includes(listingType)
    ? (listingType as ListingType)
    : "product";
}

async function getApprovedProviderProfile() {
  const { userId, profile } = await requireRole(["provider"]);
  const supabase = await createSupabaseServerClient();
  const { data: provider, error } = await supabase
    .from("provider_profiles")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (error || !provider) {
    redirectWithError("Provider profile was not found");
  }

  const providerProfile = provider as ProviderProfileRow;

  if (providerProfile.status !== "approved") {
    redirectWithError("Provider approval is required before using the dashboard");
  }

  return { userId, profile, supabase, providerProfile };
}

function buildOrderUpdate(order: OrderForRules) {
  return {
    status: order.status,
    payment_status: order.payment_status,
    accepted_at: order.accepted_at ?? null,
    delivery_distance_km: order.delivery_distance_km ?? null,
    delivery_base_fee: order.delivery_base_fee ?? 36,
    delivery_price_per_km: order.delivery_price_per_km ?? null,
    delivery_fee: order.delivery_fee ?? 0,
    buyer_total: order.buyer_total ?? order.listing_price,
    commission_percentage: order.commission_percentage ?? 12,
    commission_amount: order.commission_amount ?? 0,
    provider_earning: order.provider_earning ?? 0,
    driver_earning: order.driver_earning ?? 0
  };
}

export async function acceptProviderOrderAction(formData: FormData) {
  const orderId = readString(formData, "order_id");

  if (!orderId) {
    redirectWithError("Order is required");
  }

  const { profile, supabase, providerProfile } = await getApprovedProviderProfile();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("provider_id", providerProfile.id)
    .maybeSingle();

  if (orderError || !order) {
    redirectWithError("Order was not found");
  }

  const existingOrder = order as OrderRow & OrderForRules;

  if (!["order_requested", "awaiting_provider_acceptance"].includes(existingOrder.status)) {
    redirectWithError("Only new order requests can be accepted");
  }

  // Orders must arrive priced from checkout; defend against the legacy state.
  if (
    Number(existingOrder.delivery_fee ?? 0) <= 0 ||
    existingOrder.delivery_distance_km == null
  ) {
    redirectWithError(
      "This order has no delivery quote. The buyer needs to resubmit checkout."
    );
  }

  const acceptedOrder = acceptProviderOrder(existingOrder);

  // Atomic guard: restrict the update to orders still in the pre-acceptance
  // state. If the order was already accepted between the read and the write
  // (double-click, parallel admin/provider hit), the row is skipped and we
  // bail rather than recording two acceptance events.
  const { data: updatedRows, error: updateError } = await supabase
    .from("orders")
    .update(buildOrderUpdate(acceptedOrder))
    .eq("id", existingOrder.id)
    .eq("provider_id", providerProfile.id)
    .in("status", ["order_requested", "awaiting_provider_acceptance"])
    .select("id");

  if (updateError) {
    redirectWithError("Unable to accept this order");
  }

  if (!updatedRows || updatedRows.length === 0) {
    // Race lost — already accepted. Redirect to the success URL anyway since
    // the desired end state has been reached.
    redirect(`/provider/dashboard?accepted=${existingOrder.id}`);
  }

  await supabase.from("order_status_events").insert({
    order_id: existingOrder.id,
    old_status: existingOrder.status,
    new_status: acceptedOrder.status,
    changed_by: profile.id,
    note: "Provider accepted order"
  });

  // Send EFT instructions to buyer. The email includes an "Open
  // WhatsApp" CTA pre-filled with the order ref + total so the buyer
  // can WhatsApp the support number directly after paying.
  if (existingOrder.buyer_email && providerProfile.bank_account_number) {
    const whatsappPopUrl = createWhatsAppUrl(
      buildPaymentProofMessage({
        id: existingOrder.id,
        buyer_name: existingOrder.buyer_name,
        buyer_total: acceptedOrder.buyer_total ?? existingOrder.buyer_total ?? 0
      })
    );
    sendEmail({
      to: existingOrder.buyer_email,
      subject: "Your order has been accepted — EFT payment required — Thumeka",
      react: OrderAcceptedEftEmail({
        buyerName: existingOrder.buyer_name ?? existingOrder.buyer_email,
        listingTitle: existingOrder.listing_id,
        buyerTotal: Number(acceptedOrder.buyer_total),
        providerName: providerProfile.business_name ?? "Your provider",
        bankAccountName: providerProfile.bank_account_name ?? "",
        bankName: providerProfile.bank_name ?? "",
        bankAccountNumber: providerProfile.bank_account_number,
        bankBranchCode: providerProfile.bank_branch_code ?? "",
        orderId: existingOrder.id,
        appUrl: getAppUrl(),
        ordersUrl: `${getAppUrl()}/buyer/orders`,
        whatsappPopUrl,
      }),
    }).catch((err: Error) => console.warn("[email] Order accepted EFT email failed:", err.message));
  }

  // Push the buyer — wrapped so a push failure never blocks the action.
  try {
    await sendPush({
      userId: existingOrder.buyer_id,
      ...pushEvents.buyerOrderAccepted(providerProfile.business_name ?? "Your provider")
    });
  } catch (err) {
    console.warn("[push] buyer order-accepted failed:", (err as Error).message);
  }

  // Accountability: reset the consecutive-miss counter (this accept
  // proves the provider is responsive again) and recompute the rolling
  // 30-day response rate. Both cascade onto listings so the public
  // marketplace badge stays accurate without an extra refresh.
  //
  // Rate semantics: of all orders the provider had a chance to act on
  // in the last 30 days (= expired + anything past acceptance), what
  // fraction did they accept in time? Pre-acceptance states
  // (order_requested) are still in-flight and don't count yet.
  try {
    const { data: recentOrders } = await supabase
      .from("orders")
      .select("status")
      .eq("provider_id", providerProfile.id)
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
      );
    const recent = (recentOrders ?? []) as Array<{ status: string }>;
    const inFlight = new Set([
      "order_requested",
      "awaiting_provider_acceptance"
    ]);
    const total = recent.filter((o) => !inFlight.has(o.status)).length;
    const accepted = recent.filter(
      (o) => !inFlight.has(o.status) && o.status !== "expired"
    ).length;
    const rate = computeResponseRatePct({ accepted, total });

    await supabase
      .from("provider_profiles")
      .update({
        consecutive_missed_orders: 0,
        response_rate_pct: rate
      })
      .eq("id", providerProfile.id);

    await supabase
      .from("listings")
      .update({
        provider_response_rate_pct: rate,
        updated_at: new Date().toISOString()
      })
      .eq("provider_id", providerProfile.id);
  } catch (err) {
    console.warn(
      "[provider-accept] response-rate update failed:",
      (err as Error).message
    );
  }

  revalidatePath("/provider/dashboard");
  revalidatePath("/buyer/orders");
  revalidatePath("/");
  redirect(`/provider/dashboard?accepted=${existingOrder.id}`);
}

/**
 * Update the seller's business_name. Updates provider_profiles.business_name
 * (the source of truth) and then cascade-syncs the denormalised copy on every
 * listing they own — so the public marketplace cards reflect the new name
 * immediately, without waiting for a per-listing edit (the previous behaviour
 * called out in migration 013's comment).
 */
export async function updateProviderBusinessNameAction(formData: FormData) {
  const { supabase, providerProfile } = await getApprovedProviderProfile();
  const businessName = readString(formData, "business_name");

  if (!businessName) {
    redirectWithError("Business name can't be empty");
  }
  if (businessName.length > 120) {
    redirectWithError("Business name must be 120 characters or fewer");
  }
  if (businessName === providerProfile.business_name) {
    // No-op edit — nothing to write, no need to revalidate.
    redirect("/provider/dashboard?tab=listings");
  }

  const { error: profileError } = await supabase
    .from("provider_profiles")
    .update({ business_name: businessName })
    .eq("id", providerProfile.id);

  if (profileError) {
    redirectWithError("Unable to update business name");
  }

  // Cascade-sync the denormalised copy on every listing. RLS already
  // restricts the provider to their own listings (the listings UPDATE policy
  // gates on provider_id = current_profile_id-equivalent), so the WHERE
  // clause is belt-and-braces.
  const { error: listingsError } = await supabase
    .from("listings")
    .update({ business_name: businessName, updated_at: new Date().toISOString() })
    .eq("provider_id", providerProfile.id);

  if (listingsError) {
    // The profile already moved — we can't roll it back without an RPC.
    // Surface the partial-update so the seller knows their cards are stale
    // and we can investigate from the log.
    redirectWithError(
      "Business name updated, but some listings may still show the old name. Refresh in a moment or contact support."
    );
  }

  revalidatePath("/provider/dashboard");
  revalidatePath("/listings");
  revalidatePath("/");
  redirect("/provider/dashboard?tab=listings&business_name_updated=1");
}

/**
 * Toggle the provider's store open/closed.
 *
 * - Closing: sets `is_open=false`, stamps `closed_at`, and cascade-
 *   syncs `listings.provider_is_open` so the marketplace immediately
 *   reflects the change.
 * - Opening: sets `is_open=true`, clears `closed_at`, and resets
 *   `consecutive_missed_orders=0` (this is the "fresh start" affordance
 *   for providers who were auto-closed by the SLA cron).
 *
 * Mirrors `updateProviderBusinessNameAction`'s cascade pattern.
 */
export async function updateProviderOpenStatusAction(formData: FormData) {
  const { supabase, providerProfile } = await getApprovedProviderProfile();
  const raw = readString(formData, "is_open");
  const nextIsOpen = raw === "true";

  if (nextIsOpen === providerProfile.is_open) {
    redirect("/provider/dashboard");
  }

  const profileUpdate: Record<string, unknown> = {
    is_open: nextIsOpen,
    closed_at: nextIsOpen ? null : new Date().toISOString()
  };
  if (nextIsOpen) {
    // Re-opening — give the provider a fresh accountability counter.
    profileUpdate.consecutive_missed_orders = 0;
  }

  const { error: profileError } = await supabase
    .from("provider_profiles")
    .update(profileUpdate)
    .eq("id", providerProfile.id);
  if (profileError) {
    redirectWithError("Unable to update your store status");
  }

  const { error: listingsError } = await supabase
    .from("listings")
    .update({
      provider_is_open: nextIsOpen,
      updated_at: new Date().toISOString()
    })
    .eq("provider_id", providerProfile.id);
  if (listingsError) {
    redirectWithError(
      "Status saved, but some listings may still show the old badge. Refresh in a moment or contact support."
    );
  }

  revalidatePath("/provider/dashboard");
  revalidatePath("/listings");
  revalidatePath("/");
  redirect(
    nextIsOpen
      ? "/provider/dashboard?store_opened=1"
      : "/provider/dashboard?store_closed=1"
  );
}

export async function createProviderListingAction(formData: FormData) {
  const { userId, supabase, providerProfile } = await getApprovedProviderProfile();
  const title = readString(formData, "title");
  const description = readString(formData, "description");
  const categoryId = readString(formData, "category_id");
  const price = readPositiveNumber(formData, "price");
  const imageStoragePath = readString(formData, "image_storage_path");

  if (!title || !description || !categoryId) {
    redirectWithError("Listing title, description, and category are required");
  }

  if (price === null) {
    redirectWithError("Listing price must be zero or more");
  }

  // Image is optional; validate only when provided so a forged path or a stray
  // external URL can't sneak into the listings table.
  if (
    imageStoragePath &&
    !isValidListingImageStoragePath({ path: imageStoragePath, userId })
  ) {
    redirectWithError("Couldn't recognise the uploaded image. Try uploading again.");
  }

  const suburb = readString(formData, "suburb") || providerProfile.suburb;
  const fulfillmentAddress =
    readString(formData, "fulfillment_address") || providerProfile.address;

  // Default the listing's coordinates from the provider's geocoded address; if
  // the address was amended, geocode the new one so distance stays accurate.
  let fulfillmentCoords = toLatLng(
    providerProfile.provider_lat,
    providerProfile.provider_lng
  );
  if (fulfillmentAddress && fulfillmentAddress !== providerProfile.address) {
    fulfillmentCoords = await geocodeAddress(
      `${fulfillmentAddress}, ${suburb ?? ""}, Durban, South Africa`
    );
  }

  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      provider_id: providerProfile.id,
      category_id: categoryId,
      title,
      description,
      listing_type: readListingType(formData),
      price,
      pricing_type: readString(formData, "pricing_type") || "fixed",
      // Snapshot business name on the listing so the public marketplace
      // can show "Sold by ..." without joining provider_profiles (which is
      // RLS-gated to owner/admin to keep bank details private).
      business_name: providerProfile.business_name,
      suburb,
      fulfillment_address: fulfillmentAddress,
      fulfillment_lat: fulfillmentCoords?.lat ?? null,
      fulfillment_lng: fulfillmentCoords?.lng ?? null,
      image_url: imageStoragePath || null,
      is_active: true,
      admin_disabled: false
    })
    .select("id")
    .single();

  if (error || !listing) {
    redirectWithError("Unable to create listing");
  }

  revalidatePath("/provider/dashboard");
  revalidatePath("/listings");
  revalidatePath("/");
  // Preserve the Listings tab on the redirect — without ?tab=listings the page
  // falls back to the Orders tab and the success banner appears without the
  // listings panel where the new card belongs.
  redirect(`/provider/dashboard?tab=listings&listing_created=${listing.id}`);
}

/**
 * Update an existing listing. Same field shape as create. The provider must
 * own the listing — RLS would also block writes to other providers' rows but
 * we check explicitly so we can return a friendly error.
 *
 * If the seller renamed their business between creating the listing and
 * editing it, we re-snapshot business_name here so the public card stays in
 * sync. We also re-geocode the fulfillment address only if it changed, to
 * avoid burning a Google API call on every edit.
 */
export async function updateProviderListingAction(formData: FormData) {
  const { userId, supabase, providerProfile } = await getApprovedProviderProfile();
  const listingId = readString(formData, "listing_id");
  const title = readString(formData, "title");
  const description = readString(formData, "description");
  const categoryId = readString(formData, "category_id");
  const price = readPositiveNumber(formData, "price");
  const imageStoragePath = readString(formData, "image_storage_path");

  if (!listingId) {
    redirectWithError("Listing reference is missing");
  }
  if (!title || !description || !categoryId) {
    redirectWithError("Listing title, description, and category are required");
  }
  if (price === null) {
    redirectWithError("Listing price must be zero or more");
  }

  const { data: existing } = await supabase
    .from("listings")
    .select("id, provider_id, image_url, fulfillment_address, suburb")
    .eq("id", listingId)
    .maybeSingle();

  if (!existing) {
    redirectWithError("Listing was not found");
  }
  if (existing.provider_id !== providerProfile.id) {
    redirectWithError("You can only edit your own listings");
  }

  if (
    imageStoragePath &&
    !isValidListingImageStoragePath({ path: imageStoragePath, userId })
  ) {
    redirectWithError("Couldn't recognise the uploaded image. Try uploading again.");
  }

  const suburb = readString(formData, "suburb") || providerProfile.suburb;
  const fulfillmentAddress =
    readString(formData, "fulfillment_address") || providerProfile.address;

  // Only re-geocode when the address actually changed; the existing
  // coordinates stay accurate otherwise and we save a Google API call.
  let geocoded:
    | { lat: number | string | null; lng: number | string | null }
    | null = null;
  if (
    fulfillmentAddress &&
    fulfillmentAddress !== existing.fulfillment_address
  ) {
    const coords = await geocodeAddress(
      `${fulfillmentAddress}, ${suburb ?? ""}, Durban, South Africa`
    );
    if (coords) {
      geocoded = { lat: coords.lat, lng: coords.lng };
    }
  }

  // Keep the previously-uploaded image if the seller didn't pick a new one.
  const nextImageUrl = imageStoragePath || existing.image_url;

  const updatePayload: Record<string, unknown> = {
    category_id: categoryId,
    title,
    description,
    listing_type: readListingType(formData),
    price,
    pricing_type: readString(formData, "pricing_type") || "fixed",
    business_name: providerProfile.business_name,
    suburb,
    fulfillment_address: fulfillmentAddress,
    image_url: nextImageUrl,
    updated_at: new Date().toISOString()
  };
  if (geocoded) {
    updatePayload.fulfillment_lat = geocoded.lat;
    updatePayload.fulfillment_lng = geocoded.lng;
  }

  const { error } = await supabase
    .from("listings")
    .update(updatePayload)
    .eq("id", listingId)
    .eq("provider_id", providerProfile.id);

  if (error) {
    redirectWithError("Unable to update listing");
  }

  revalidatePath("/provider/dashboard");
  revalidatePath("/listings");
  revalidatePath("/");
  revalidatePath(`/listings/${listingId}`);
  redirect(`/provider/dashboard?tab=listings&listing_updated=${listingId}`);
}

/**
 * Soft-delete / restore a listing. Sellers don't get a hard delete — the
 * `orders.listing_id` foreign key would block it whenever there's order
 * history, and even when it wouldn't, history pages need the row to render.
 * Toggling `is_active` removes it from the marketplace + listing detail page
 * while keeping everything in the database.
 */
export async function setProviderListingActiveAction(formData: FormData) {
  const { supabase, providerProfile } = await getApprovedProviderProfile();
  const listingId = readString(formData, "listing_id");
  const isActive = readString(formData, "is_active") === "true";

  if (!listingId) {
    redirectWithError("Listing reference is missing");
  }

  const { data: existing } = await supabase
    .from("listings")
    .select("id, provider_id, is_active")
    .eq("id", listingId)
    .maybeSingle();

  if (!existing) {
    redirectWithError("Listing was not found");
  }
  if (existing.provider_id !== providerProfile.id) {
    redirectWithError("You can only change your own listings");
  }

  const { error } = await supabase
    .from("listings")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("provider_id", providerProfile.id);

  if (error) {
    redirectWithError(
      isActive ? "Unable to reactivate listing" : "Unable to deactivate listing"
    );
  }

  revalidatePath("/provider/dashboard");
  revalidatePath("/listings");
  revalidatePath("/");
  revalidatePath(`/listings/${listingId}`);
  const param = isActive ? "listing_reactivated" : "listing_deactivated";
  redirect(`/provider/dashboard?tab=listings&${param}=${listingId}`);
}

/**
 * Hard-delete a listing. The `orders.listing_id` FK is RESTRICT, so any
 * listing with order history is blocked at the database level — Supabase
 * surfaces the failure as Postgres error code 23503 (foreign_key_violation).
 * When that happens, redirect the seller to a clear message pointing them
 * at the Deactivate flow instead of throwing a cryptic "Unable to delete"
 * error.
 *
 * If the row is genuinely removable (no orders, no payouts, nothing
 * pointing at it), the cascade on `listings → provider_id` doesn't apply in
 * reverse so this leaves the provider, profile, and storage image
 * untouched. The Supabase Storage bucket retains the image; we accept that
 * stranded file for now — cleaning storage is its own batch.
 */
export async function deleteProviderListingAction(formData: FormData) {
  const { supabase, providerProfile } = await getApprovedProviderProfile();
  const listingId = readString(formData, "listing_id");

  if (!listingId) {
    redirectWithError("Listing reference is missing");
  }

  const { data: existing } = await supabase
    .from("listings")
    .select("id, provider_id")
    .eq("id", listingId)
    .maybeSingle();

  if (!existing) {
    redirectWithError("Listing was not found");
  }
  if (existing.provider_id !== providerProfile.id) {
    redirectWithError("You can only delete your own listings");
  }

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("provider_id", providerProfile.id);

  if (error) {
    // Postgres FK violation. The seller has order history pinned to this
    // listing — guide them to the visibility toggle instead.
    if (error.code === "23503") {
      redirectWithError(
        "This listing has order history and can't be deleted. Deactivate it instead to hide it from the marketplace."
      );
    }
    redirectWithError("Unable to delete listing");
  }

  // Defensive verify: Supabase RLS denies DELETE silently — the call
  // returns { error: null, count: 0 } when no policy permits the row.
  // Without this check we'd redirect with a "Listing deleted." banner
  // while the row is still in the database. Reading the row back
  // confirms whether the delete actually happened.
  const { data: stillThere } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .maybeSingle();

  if (stillThere) {
    redirectWithError(
      "Delete didn't take effect. Database policy may not allow it — please contact support."
    );
  }

  revalidatePath("/provider/dashboard");
  revalidatePath("/listings");
  revalidatePath("/");
  redirect("/provider/dashboard?tab=listings&listing_deleted=1");
}
