"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { OrderCompletedEmail } from "@/emails/order-completed";
import { requireRole } from "@/lib/auth";
import type { DriverProfileRow, OrderRow } from "@/lib/database.types";
import { sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import { sendPush } from "@/lib/push";
import { pushEvents } from "@/lib/push-events";
import {
  completeDriverDelivery,
  markDriverOutForDelivery,
  markDriverPickedUp,
  type OrderForRules
} from "@/lib/order-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DeliveryTransition = "picked_up" | "out_for_delivery" | "completed";
type DriverAvailability = "available" | "unavailable";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(message: string): never {
  redirect(`/driver/dashboard?error=${encodeURIComponent(message)}`);
}

function readAvailability(formData: FormData): DriverAvailability {
  const value = readString(formData, "availability_status");
  return value === "unavailable" ? "unavailable" : "available";
}

function buildOrderUpdate(order: OrderForRules) {
  return {
    status: order.status,
    completed_at: order.completed_at ?? null
  };
}

async function updateDeliveryStatus(formData: FormData, transition: DeliveryTransition) {
  const { profile } = await requireRole(["driver"]);
  const orderId = readString(formData, "order_id");

  if (!orderId) {
    redirectWithError("Order is required");
  }

  const supabase = await createSupabaseServerClient();
  const { data: driver } = await supabase
    .from("driver_profiles")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!driver) {
    redirectWithError("Driver profile was not found");
  }

  const driverProfile = driver as DriverProfileRow;
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("driver_id", driverProfile.id)
    .maybeSingle();

  if (!order) {
    redirectWithError("Assigned order was not found");
  }

  const existingOrder = order as OrderRow & OrderForRules;
  let updatedOrder: OrderForRules;

  try {
    if (transition === "picked_up") {
      updatedOrder = markDriverPickedUp(existingOrder);
    } else if (transition === "out_for_delivery") {
      updatedOrder = markDriverOutForDelivery(existingOrder);
    } else {
      updatedOrder = completeDriverDelivery(existingOrder);
    }
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Unable to update delivery");
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(buildOrderUpdate(updatedOrder))
    .eq("id", existingOrder.id)
    .eq("driver_id", driverProfile.id);

  if (updateError) {
    redirectWithError("Unable to update delivery");
  }

  await supabase.from("order_status_events").insert({
    order_id: existingOrder.id,
    old_status: existingOrder.status,
    new_status: updatedOrder.status,
    changed_by: profile.id,
    note: `Driver marked order ${updatedOrder.status.replaceAll("_", " ")}`
  });

  if (updatedOrder.status === "completed") {
    await supabase
      .from("driver_profiles")
      .update({ availability_status: "available" })
      .eq("id", driverProfile.id);

    // Notify buyer that order is delivered
    if (existingOrder.buyer_email) {
      sendEmail({
        to: existingOrder.buyer_email,
        subject: "Your order has been delivered — Thumeka",
        react: OrderCompletedEmail({
          buyerName: existingOrder.buyer_name ?? existingOrder.buyer_email,
          listingTitle: existingOrder.listing_id,
          buyerTotal: Number(existingOrder.buyer_total),
          orderId: existingOrder.id,
          appUrl: getAppUrl(),
          ordersUrl: `${getAppUrl()}/buyer/orders`,
        }),
      }).catch((err: Error) => console.warn("[email] Delivery completed email failed:", err.message));
    }
  }

  // Push the buyer at the two moments they care most about — order
  // heading out, and order delivered. Wrapped so push failures can't
  // break the delivery update.
  try {
    if (updatedOrder.status === "out_for_delivery") {
      await sendPush({
        userId: existingOrder.buyer_id,
        ...pushEvents.buyerOutForDelivery()
      });
    } else if (updatedOrder.status === "completed") {
      await sendPush({
        userId: existingOrder.buyer_id,
        ...pushEvents.buyerCompleted()
      });
    }
  } catch (err) {
    console.warn("[push] buyer delivery-update failed:", (err as Error).message);
  }

  revalidatePath("/driver/dashboard");
  revalidatePath("/admin/dashboard");
  redirect(
    `/driver/dashboard?delivery_updated=${existingOrder.id}&status=${updatedOrder.status}`
  );
}

export async function markPickedUpAction(formData: FormData) {
  await updateDeliveryStatus(formData, "picked_up");
}

export async function markOutForDeliveryAction(formData: FormData) {
  await updateDeliveryStatus(formData, "out_for_delivery");
}

export async function completeDeliveryAction(formData: FormData) {
  await updateDeliveryStatus(formData, "completed");
}

export async function updateDriverAvailabilityAction(formData: FormData) {
  const { profile } = await requireRole(["driver"]);
  const availabilityStatus = readAvailability(formData);
  const supabase = await createSupabaseServerClient();
  const { data: driver } = await supabase
    .from("driver_profiles")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!driver) {
    redirectWithError("Driver profile was not found");
  }

  const driverProfile = driver as DriverProfileRow;

  if (driverProfile.approval_status !== "approved") {
    redirectWithError("Driver approval is required before changing availability");
  }

  if (driverProfile.availability_status === "busy") {
    redirectWithError("Availability cannot be changed during an active delivery");
  }

  const { error } = await supabase
    .from("driver_profiles")
    .update({ availability_status: availabilityStatus })
    .eq("id", driverProfile.id);

  if (error) {
    redirectWithError("Unable to update availability");
  }

  revalidatePath("/driver/dashboard");
  revalidatePath("/admin/dashboard");
  redirect(`/driver/dashboard?availability=${availabilityStatus}`);
}
