import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "@/lib/constants";

/**
 * Minimal row the urgent-action banner needs. Less than OrderRow so
 * the server-side query stays cheap.
 */
export type UrgentOrderSummary = {
  id: string;
  status: string;
  payment_status: string;
  expires_at: string | null;
  eft_confirm_due_at: string | null;
  driver_assign_due_at: string | null;
};

export type UrgentDeadline = {
  order: UrgentOrderSummary;
  deadline: string;
  kind: "accept" | "confirm_eft" | "assign_driver" | "wait_for_seller";
  /** Count of total urgent orders for the role; the banner shows the
   *  most-urgent one but also surfaces "+2 more" when this is > 1. */
  totalCount: number;
};

/**
 * Resolve the *most-urgent* pending order for the signed-in user's
 * role. Returns null when there's nothing to act on.
 *
 *  - Provider: orders in `order_requested` (their `expires_at` is the
 *    deadline).
 *  - Buyer: orders in `order_requested` (waiting for seller — the same
 *    expires_at, but the banner copy is different).
 *  - Admin: orders past 50% of their EFT-confirm deadline OR past 50%
 *    of their driver-assign deadline, whichever is more urgent.
 */
export async function getUrgentDeadlineForRole(
  supabase: SupabaseClient,
  role: AppRole,
  profileId: string
): Promise<UrgentDeadline | null> {
  if (role === "provider") {
    // Get this user's provider_profile.id first; their orders are
    // keyed off it.
    const { data: provider } = await supabase
      .from("provider_profiles")
      .select("id")
      .eq("user_id", profileId)
      .maybeSingle();
    if (!provider) return null;

    const { data: rows } = await supabase
      .from("orders")
      .select(
        "id, status, payment_status, expires_at, eft_confirm_due_at, driver_assign_due_at"
      )
      .eq("provider_id", provider.id)
      .eq("status", "order_requested")
      .not("expires_at", "is", null)
      .order("expires_at", { ascending: true });

    const orders = (rows ?? []) as UrgentOrderSummary[];
    if (orders.length === 0) return null;
    const first = orders[0];
    if (!first.expires_at) return null;
    return {
      order: first,
      deadline: first.expires_at,
      kind: "accept",
      totalCount: orders.length
    };
  }

  if (role === "buyer") {
    // Buyer's "urgent" is just waiting on the seller — same deadline,
    // different copy.
    const { data: rows } = await supabase
      .from("orders")
      .select(
        "id, status, payment_status, expires_at, eft_confirm_due_at, driver_assign_due_at"
      )
      .eq("buyer_id", profileId)
      .eq("status", "order_requested")
      .not("expires_at", "is", null)
      .order("expires_at", { ascending: true });

    const orders = (rows ?? []) as UrgentOrderSummary[];
    if (orders.length === 0) return null;
    const first = orders[0];
    if (!first.expires_at) return null;
    return {
      order: first,
      deadline: first.expires_at,
      kind: "wait_for_seller",
      totalCount: orders.length
    };
  }

  if (role === "admin") {
    // Admin sees orders that need a confirm or driver-assign action.
    const { data: eftRows } = await supabase
      .from("orders")
      .select(
        "id, status, payment_status, expires_at, eft_confirm_due_at, driver_assign_due_at"
      )
      .eq("payment_status", "eft_submitted")
      .not("eft_confirm_due_at", "is", null)
      .order("eft_confirm_due_at", { ascending: true })
      .limit(5);

    const { data: assignRows } = await supabase
      .from("orders")
      .select(
        "id, status, payment_status, expires_at, eft_confirm_due_at, driver_assign_due_at"
      )
      .eq("payment_status", "confirmed")
      .is("driver_id", null)
      .not("driver_assign_due_at", "is", null)
      .order("driver_assign_due_at", { ascending: true })
      .limit(5);

    const candidates: UrgentDeadline[] = [];
    for (const o of (eftRows ?? []) as UrgentOrderSummary[]) {
      if (o.eft_confirm_due_at) {
        candidates.push({
          order: o,
          deadline: o.eft_confirm_due_at,
          kind: "confirm_eft",
          totalCount: (eftRows ?? []).length + (assignRows ?? []).length
        });
      }
    }
    for (const o of (assignRows ?? []) as UrgentOrderSummary[]) {
      if (o.driver_assign_due_at) {
        candidates.push({
          order: o,
          deadline: o.driver_assign_due_at,
          kind: "assign_driver",
          totalCount: (eftRows ?? []).length + (assignRows ?? []).length
        });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort(
      (a, b) =>
        new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    );
    return candidates[0];
  }

  return null;
}
