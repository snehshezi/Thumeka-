"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import type { OrderRow } from "@/lib/database.types";
import { computeEftConfirmDeadline } from "@/lib/sla";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Buyer signals they've sent the proof of payment via WhatsApp.
 *
 * Flips the order from `awaiting_buyer_eft` → `eft_submitted` and
 * stamps `eft_confirm_due_at` so the admin sees a countdown on their
 * operational queue. The action is idempotent — calling it again on
 * an already-submitted order is a no-op redirect.
 *
 * The actual money still has to land on the platform's bank account;
 * this just changes the bookkeeping state.
 */
export async function markEftSubmittedAction(formData: FormData) {
  const { profile } = await requireRole(["buyer"]);
  const orderId = readString(formData, "order_id");

  if (!orderId) {
    redirect("/buyer/orders");
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("buyer_id", profile.id)
    .maybeSingle();
  const order = data as OrderRow | null;

  if (!order) {
    redirect(
      `/buyer/orders?error=${encodeURIComponent("Order was not found")}`
    );
  }
  if (order.payment_status === "eft_submitted") {
    // Already marked; just bounce back.
    redirect(`/buyer/orders?pop_marked=${orderId}`);
  }
  if (order.payment_status !== "awaiting_buyer_eft") {
    redirect(
      `/buyer/orders?error=${encodeURIComponent(
        `Can't mark this order — payment status is ${order.payment_status.replaceAll("_", " ")}`
      )}`
    );
  }

  // Pull settings for the EFT-confirm window so the countdown reflects
  // whatever the admin configures.
  const { data: slaSettings } = await supabase
    .from("admin_settings")
    .select("eft_confirm_window_minutes")
    .limit(1)
    .maybeSingle();
  const dueAt = computeEftConfirmDeadline(new Date(), slaSettings);

  const { error } = await supabase
    .from("orders")
    .update({
      status: "eft_submitted",
      payment_status: "eft_submitted",
      eft_confirm_due_at: dueAt.toISOString()
    })
    .eq("id", orderId)
    .eq("buyer_id", profile.id)
    .eq("payment_status", "awaiting_buyer_eft");

  if (error) {
    redirect(
      `/buyer/orders?error=${encodeURIComponent(
        "Unable to mark proof of payment as sent."
      )}`
    );
  }

  await supabase.from("order_status_events").insert({
    order_id: orderId,
    old_status: order.status,
    new_status: "eft_submitted",
    changed_by: profile.id,
    note: "Buyer marked proof of payment as sent"
  });

  revalidatePath("/buyer/orders");
  revalidatePath("/admin/dashboard");
  redirect(`/buyer/orders?pop_marked=${orderId}`);
}
