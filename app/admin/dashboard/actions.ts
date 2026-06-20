"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApplicationApprovedEmail } from "@/emails/application-approved";
import { ApplicationRejectedEmail } from "@/emails/application-rejected";
import { DriverAssignedEmail } from "@/emails/driver-assigned";
import { PaymentConfirmedEmail } from "@/emails/payment-confirmed";
import { PayoutCreatedEmail } from "@/emails/payout-created";
import { PayoutPaidEmail } from "@/emails/payout-paid";
import { requireRole } from "@/lib/auth";
import type {
  DriverProfileRow,
  OrderRow,
  PayoutRow,
  ProfileRow,
  ProviderProfileRow
} from "@/lib/database.types";
import { sendEmail } from "@/lib/email";
import { sendPush } from "@/lib/push";
import { orderRef, pushEvents } from "@/lib/push-events";
import { computeDriverAssignDeadline } from "@/lib/sla";
import { getAppUrl } from "@/lib/env";
import {
  assignDriver,
  confirmEftPayment,
  isPayoutEligible,
  type DriverForAssignment,
  type OrderForRules
} from "@/lib/order-rules";
import {
  groupDriverPayables,
  type DriverPayoutOrder,
  type PaidPayoutItemLike
} from "@/lib/payouts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(message: string): never {
  redirect(`/admin/dashboard?error=${encodeURIComponent(message)}`);
}

function buildOrderUpdate(order: OrderForRules) {
  return {
    driver_id: order.driver_id ?? null,
    status: order.status,
    payment_status: order.payment_status,
    payment_reference: order.payment_reference ?? null
  };
}

function completedDateForOrder(order: OrderForRules) {
  return (order.completed_at ?? new Date().toISOString()).slice(0, 10);
}

async function writeAdminAuditLog({
  action,
  entityType,
  entityId,
  note,
  oldValue,
  newValue
}: {
  action: string;
  entityType:
    | "provider_profile"
    | "driver_profile"
    | "order"
    | "admin_settings"
    | "document";
  entityId: string | null;
  note: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}) {
  const { profile } = await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();

  await supabase.from("audit_logs").insert({
    actor_user_id: profile.id,
    actor_role: "admin",
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    note
  });
}

async function getProfileForProviderProfile(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, providerUserId: string): Promise<ProfileRow | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", providerUserId)
    .maybeSingle();
  return (data as ProfileRow | null);
}

async function getProfileForDriverProfile(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, driverUserId: string): Promise<ProfileRow | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", driverUserId)
    .maybeSingle();
  return (data as ProfileRow | null);
}

export async function approveProviderAction(formData: FormData) {
  await requireRole(["admin"]);
  const providerId = readString(formData, "provider_profile_id");

  if (!providerId) {
    redirectWithError("Provider profile is required");
  }

  const supabase = await createSupabaseServerClient();
  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("id, status, user_id")
    .eq("id", providerId)
    .maybeSingle();

  if (!provider) {
    redirectWithError("Provider profile was not found");
  }

  const update = {
    status: "approved",
    rejection_reason: null,
    approved_at: new Date().toISOString()
  };
  const { error } = await supabase
    .from("provider_profiles")
    .update(update)
    .eq("id", providerId);

  if (error) {
    redirectWithError("Unable to approve provider");
  }

  await writeAdminAuditLog({
    action: "provider_approved",
    entityType: "provider_profile",
    entityId: providerId,
    note: "Admin approved provider application",
    oldValue: { status: provider.status },
    newValue: { status: update.status }
  });

  const userProfile = await getProfileForProviderProfile(supabase, provider.user_id);
  if (userProfile) {
    sendEmail({
      to: userProfile.email,
      subject: "Your provider application has been approved — Thumeka",
      react: ApplicationApprovedEmail({
        fullName: userProfile.full_name ?? userProfile.email,
        applicantType: "provider",
        appUrl: getAppUrl(),
        dashboardUrl: `${getAppUrl()}/provider/dashboard`,
      }),
    }).catch((err: Error) => console.warn("[email] Provider approved email failed:", err.message));
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/provider/status");
  redirect(`/admin/dashboard?provider_approved=${providerId}`);
}

export async function rejectProviderAction(formData: FormData) {
  await requireRole(["admin"]);
  const providerId = readString(formData, "provider_profile_id");
  const reason = readString(formData, "rejection_reason") || "Application rejected";

  if (!providerId) {
    redirectWithError("Provider profile is required");
  }

  const supabase = await createSupabaseServerClient();
  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("id, status, user_id")
    .eq("id", providerId)
    .maybeSingle();

  if (!provider) {
    redirectWithError("Provider profile was not found");
  }

  const update = {
    status: "rejected",
    rejection_reason: reason,
    approved_at: null
  };
  const { error } = await supabase
    .from("provider_profiles")
    .update(update)
    .eq("id", providerId);

  if (error) {
    redirectWithError("Unable to reject provider");
  }

  await writeAdminAuditLog({
    action: "provider_rejected",
    entityType: "provider_profile",
    entityId: providerId,
    note: reason,
    oldValue: { status: provider.status },
    newValue: { status: update.status }
  });

  const userProfile = await getProfileForProviderProfile(supabase, provider.user_id);
  if (userProfile) {
    sendEmail({
      to: userProfile.email,
      subject: "Update on your provider application — Thumeka",
      react: ApplicationRejectedEmail({
        fullName: userProfile.full_name ?? userProfile.email,
        applicantType: "provider",
        reason,
        appUrl: getAppUrl(),
        applyUrl: `${getAppUrl()}/provider/apply`,
      }),
    }).catch((err: Error) => console.warn("[email] Provider rejected email failed:", err.message));
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/provider/status");
  redirect(`/admin/dashboard?provider_rejected=${providerId}`);
}

export async function approveDriverAction(formData: FormData) {
  await requireRole(["admin"]);
  const driverId = readString(formData, "driver_profile_id");

  if (!driverId) {
    redirectWithError("Driver profile is required");
  }

  const supabase = await createSupabaseServerClient();
  const { data: driver } = await supabase
    .from("driver_profiles")
    .select("id, approval_status, user_id")
    .eq("id", driverId)
    .maybeSingle();

  if (!driver) {
    redirectWithError("Driver profile was not found");
  }

  const update = {
    approval_status: "approved",
    rejection_reason: null,
    approved_at: new Date().toISOString()
  };
  const { error } = await supabase
    .from("driver_profiles")
    .update(update)
    .eq("id", driverId);

  if (error) {
    redirectWithError("Unable to approve driver");
  }

  await writeAdminAuditLog({
    action: "driver_approved",
    entityType: "driver_profile",
    entityId: driverId,
    note: "Admin approved driver application",
    oldValue: { approval_status: driver.approval_status },
    newValue: { approval_status: update.approval_status }
  });

  const driverUserProfile = await getProfileForDriverProfile(supabase, driver.user_id);
  if (driverUserProfile) {
    sendEmail({
      to: driverUserProfile.email,
      subject: "Your driver application has been approved — Thumeka",
      react: ApplicationApprovedEmail({
        fullName: driverUserProfile.full_name ?? driverUserProfile.email,
        applicantType: "driver",
        appUrl: getAppUrl(),
        dashboardUrl: `${getAppUrl()}/driver/dashboard`,
      }),
    }).catch((err: Error) => console.warn("[email] Driver approved email failed:", err.message));
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/driver/status");
  redirect(`/admin/dashboard?driver_approved=${driverId}`);
}

export async function rejectDriverAction(formData: FormData) {
  await requireRole(["admin"]);
  const driverId = readString(formData, "driver_profile_id");
  const reason = readString(formData, "rejection_reason") || "Application rejected";

  if (!driverId) {
    redirectWithError("Driver profile is required");
  }

  const supabase = await createSupabaseServerClient();
  const { data: driver } = await supabase
    .from("driver_profiles")
    .select("id, approval_status, user_id")
    .eq("id", driverId)
    .maybeSingle();

  if (!driver) {
    redirectWithError("Driver profile was not found");
  }

  const update = {
    approval_status: "rejected",
    availability_status: "unavailable",
    rejection_reason: reason,
    approved_at: null
  };
  const { error } = await supabase
    .from("driver_profiles")
    .update(update)
    .eq("id", driverId);

  if (error) {
    redirectWithError("Unable to reject driver");
  }

  await writeAdminAuditLog({
    action: "driver_rejected",
    entityType: "driver_profile",
    entityId: driverId,
    note: reason,
    oldValue: { approval_status: driver.approval_status },
    newValue: { approval_status: update.approval_status }
  });

  const driverUserProfile = await getProfileForDriverProfile(supabase, driver.user_id);
  if (driverUserProfile) {
    sendEmail({
      to: driverUserProfile.email,
      subject: "Update on your driver application — Thumeka",
      react: ApplicationRejectedEmail({
        fullName: driverUserProfile.full_name ?? driverUserProfile.email,
        applicantType: "driver",
        reason,
        appUrl: getAppUrl(),
        applyUrl: `${getAppUrl()}/driver/apply`,
      }),
    }).catch((err: Error) => console.warn("[email] Driver rejected email failed:", err.message));
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/driver/status");
  redirect(`/admin/dashboard?driver_rejected=${driverId}`);
}

export async function confirmEftPaymentAction(formData: FormData) {
  const { profile } = await requireRole(["admin"]);
  const orderId = readString(formData, "order_id");
  const paymentReference =
    readString(formData, "payment_reference") || `EFT-${orderId.slice(0, 8)}`;

  if (!orderId) {
    redirectWithError("Order is required");
  }

  const supabase = await createSupabaseServerClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    redirectWithError("Order was not found");
  }

  const existingOrder = order as OrderRow & OrderForRules;
  let result: ReturnType<typeof confirmEftPayment>;

  try {
    result = confirmEftPayment({
      order: existingOrder,
      adminProfileId: profile.id,
      paymentReference
    });
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Unable to confirm EFT");
  }

  // Driver-assign SLA starts now (payment confirmed). Read the admin
  // settings window so future changes flow through without a code edit.
  const { data: slaSettings } = await supabase
    .from("admin_settings")
    .select(
      "provider_acceptance_window_minutes, eft_confirm_window_minutes, driver_assign_window_minutes"
    )
    .limit(1)
    .maybeSingle();
  const driverAssignDueAt = computeDriverAssignDeadline(
    new Date(),
    slaSettings
  );

  // Atomic guard against double-click races. Restrict the update to orders
  // still in the pre-confirmation state — if another admin (or the same admin
  // double-clicking) already confirmed it, the row is skipped and we bail
  // before writing transactions or events twice.
  const { data: updatedRows, error: updateError } = await supabase
    .from("orders")
    .update({
      ...buildOrderUpdate(result.order),
      // EFT-confirm done; driver-assign window starts.
      eft_confirm_due_at: null,
      driver_assign_due_at: driverAssignDueAt.toISOString()
    })
    .eq("id", existingOrder.id)
    .in("payment_status", ["awaiting_buyer_eft", "eft_submitted"])
    .select("id");

  if (updateError) {
    redirectWithError("Unable to update order payment status");
  }

  if (!updatedRows || updatedRows.length === 0) {
    // Race lost — another admin already confirmed this EFT. Treat as success
    // (the desired state has been reached) but skip the side-effects.
    redirect(`/admin/dashboard?eft_confirmed=${existingOrder.id}`);
  }

  const transactions = result.transactions.map((transaction) => ({
    order_id: transaction.order_id,
    transaction_type: transaction.transaction_type,
    amount: transaction.amount,
    direction: transaction.direction,
    status: transaction.status,
    reference: transaction.reference ?? null,
    created_by: transaction.created_by
  }));
  const { error: transactionError } = await supabase
    .from("transactions")
    .insert(transactions);

  if (transactionError) {
    redirectWithError("Unable to create transaction records");
  }

  await supabase.from("order_status_events").insert({
    order_id: existingOrder.id,
    old_status: existingOrder.status,
    new_status: result.order.status,
    changed_by: profile.id,
    note: "Admin confirmed EFT"
  });

  await supabase.from("audit_logs").insert({
    actor_user_id: profile.id,
    actor_role: "admin",
    action: "eft_payment_confirmed",
    entity_type: "order",
    entity_id: existingOrder.id,
    note: `Reference ${paymentReference}`
  });

  // Notify buyer that payment is confirmed
  if (existingOrder.buyer_email) {
    sendEmail({
      to: existingOrder.buyer_email,
      subject: "Your payment has been confirmed — Thumeka",
      react: PaymentConfirmedEmail({
        recipientName: existingOrder.buyer_name ?? existingOrder.buyer_email,
        role: "buyer",
        listingTitle: existingOrder.listing_id,
        buyerTotal: Number(existingOrder.buyer_total),
        paymentReference,
        orderId: existingOrder.id,
        appUrl: getAppUrl(),
        dashboardUrl: `${getAppUrl()}/buyer/orders`,
      }),
    }).catch((err: Error) => console.warn("[email] EFT confirmed email failed:", err.message));
  }

  // Push the buyer + provider. We push the provider via their
  // `user_id` from provider_profiles. Wrapped so a push failure can't
  // break payment confirmation.
  try {
    await sendPush({
      userId: existingOrder.buyer_id,
      ...pushEvents.buyerPaymentConfirmed()
    });
  } catch (err) {
    console.warn("[push] buyer payment-confirmed failed:", (err as Error).message);
  }

  try {
    const { data: providerProfile } = await supabase
      .from("provider_profiles")
      .select("user_id")
      .eq("id", existingOrder.provider_id)
      .maybeSingle();
    if (providerProfile) {
      await sendPush({
        userId: providerProfile.user_id,
        ...pushEvents.providerPaymentConfirmed(orderRef(existingOrder.id))
      });
    }
  } catch (err) {
    console.warn("[push] provider payment-confirmed failed:", (err as Error).message);
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/buyer/orders");
  redirect(`/admin/dashboard?eft_confirmed=${existingOrder.id}`);
}

export async function assignDriverAction(formData: FormData) {
  const { profile } = await requireRole(["admin"]);
  const orderId = readString(formData, "order_id");
  const driverId = readString(formData, "driver_id");

  if (!orderId || !driverId) {
    redirectWithError("Order and driver are required");
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: order }, { data: driver }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
    supabase
      .from("driver_profiles")
      .select("*")
      .eq("id", driverId)
      .maybeSingle()
  ]);

  if (!order || !driver) {
    redirectWithError("Order or driver was not found");
  }

  const existingOrder = order as OrderRow & OrderForRules;
  const driverProfile = driver as DriverProfileRow;
  const driverForAssignment = {
    id: driverProfile.id,
    approval_status: driverProfile.approval_status,
    availability_status: driverProfile.availability_status
  } satisfies DriverForAssignment;
  let assignedOrder: OrderForRules;

  try {
    assignedOrder = assignDriver(existingOrder, driverForAssignment);
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Unable to assign driver");
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      ...buildOrderUpdate(assignedOrder),
      // Driver assigned — clear the admin's driver-assign SLA window.
      driver_assign_due_at: null
    })
    .eq("id", existingOrder.id);

  if (updateError) {
    redirectWithError("Unable to assign driver");
  }

  await supabase
    .from("driver_profiles")
    .update({ availability_status: "busy" })
    .eq("id", driverProfile.id);

  await supabase.from("order_status_events").insert({
    order_id: existingOrder.id,
    old_status: existingOrder.status,
    new_status: assignedOrder.status,
    changed_by: profile.id,
    note: "Admin assigned driver"
  });

  await supabase.from("audit_logs").insert({
    actor_user_id: profile.id,
    actor_role: "admin",
    action: "driver_assigned",
    entity_type: "order",
    entity_id: existingOrder.id,
    note: `Driver ${driverProfile.id}`
  });

  // Notify buyer and driver
  const driverUserProfile = await getProfileForDriverProfile(supabase, driverProfile.user_id);
  const emailPromises: Promise<void>[] = [];

  if (existingOrder.buyer_email) {
    emailPromises.push(
      sendEmail({
        to: existingOrder.buyer_email,
        subject: "A driver has been assigned to your order — Thumeka",
        react: DriverAssignedEmail({
          recipientName: existingOrder.buyer_name ?? existingOrder.buyer_email,
          role: "buyer",
          listingTitle: existingOrder.listing_id,
          deliveryAddress: existingOrder.delivery_address ?? null,
          suburb: existingOrder.suburb ?? null,
          orderId: existingOrder.id,
          appUrl: getAppUrl(),
          dashboardUrl: `${getAppUrl()}/buyer/orders`,
        }),
      })
    );
  }

  if (driverUserProfile) {
    emailPromises.push(
      sendEmail({
        to: driverUserProfile.email,
        subject: "New delivery assigned to you — Thumeka",
        react: DriverAssignedEmail({
          recipientName: driverUserProfile.full_name ?? driverUserProfile.email,
          role: "driver",
          listingTitle: existingOrder.listing_id,
          deliveryAddress: existingOrder.delivery_address ?? null,
          suburb: existingOrder.suburb ?? null,
          driverEarning: Number(assignedOrder.driver_earning ?? 0),
          orderId: existingOrder.id,
          appUrl: getAppUrl(),
          dashboardUrl: `${getAppUrl()}/driver/dashboard`,
        }),
      })
    );
  }

  Promise.all(emailPromises).catch((err: Error) =>
    console.warn("[email] Driver assignment email failed:", err.message)
  );

  // Push the driver — they need to know about new deliveries even when
  // the tab is closed. Wrapped so push failures can't break assignment.
  try {
    await sendPush({
      userId: driverProfile.user_id,
      ...pushEvents.driverNewAssignment(
        existingOrder.suburb ?? "your area",
        Number(existingOrder.delivery_distance_km ?? 0)
      )
    });
  } catch (err) {
    console.warn("[push] driver new-assignment failed:", (err as Error).message);
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/driver/dashboard");
  redirect(`/admin/dashboard?driver_assigned=${existingOrder.id}`);
}

export async function createProviderPayoutAction(formData: FormData) {
  const { profile } = await requireRole(["admin"]);
  const orderId = readString(formData, "order_id");

  if (!orderId) {
    redirectWithError("Order is required");
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: order }, { data: existingPayoutItems }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
    supabase.from("payout_items").select("id, order_id").eq("order_id", orderId)
  ]);

  if (!order) {
    redirectWithError("Order was not found");
  }

  const payoutOrder = order as OrderRow & OrderForRules;

  if (!isPayoutEligible(payoutOrder, existingPayoutItems ?? [])) {
    redirectWithError("Order is not payout eligible");
  }

  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("*")
    .eq("id", payoutOrder.provider_id)
    .maybeSingle();

  if (!provider) {
    redirectWithError("Provider profile was not found");
  }

  const providerProfile = provider as ProviderProfileRow;
  const payoutDate = completedDateForOrder(payoutOrder);
  const providerEarning = Number(payoutOrder.provider_earning);
  const commissionAmount = Number(payoutOrder.commission_amount);
  const grossAmount = providerEarning + commissionAmount;

  if (!Number.isFinite(providerEarning) || providerEarning <= 0) {
    redirectWithError("Provider earning must be greater than zero");
  }

  const { data: payout, error: payoutError } = await supabase
    .from("payouts")
    .insert({
      recipient_user_id: providerProfile.user_id,
      recipient_type: "provider",
      period_start: payoutDate,
      period_end: payoutDate,
      gross_amount: grossAmount,
      commission_amount: commissionAmount,
      net_amount: providerEarning,
      status: "pending"
    })
    .select("id")
    .single();

  if (payoutError || !payout) {
    redirectWithError("Unable to create payout");
  }

  const { error: payoutItemError } = await supabase.from("payout_items").insert({
    payout_id: payout.id,
    order_id: payoutOrder.id,
    recipient_type: "provider",
    amount: providerEarning
  });

  if (payoutItemError) {
    await supabase.from("payouts").update({ status: "cancelled" }).eq("id", payout.id);
    redirectWithError("Order has already been added to a payout");
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: profile.id,
    actor_role: "admin",
    action: "provider_payout_created",
    entity_type: "order",
    entity_id: payoutOrder.id,
    note: `Payout ${payout.id}`
  });

  // Notify provider of payout
  const providerUserProfile = await getProfileForProviderProfile(supabase, providerProfile.user_id);
  if (providerUserProfile) {
    sendEmail({
      to: providerUserProfile.email,
      subject: "Your payout has been created — Thumeka",
      react: PayoutCreatedEmail({
        recipientName: providerUserProfile.full_name ?? providerUserProfile.email,
        recipientType: "provider",
        netAmount: providerEarning,
        grossAmount,
        commissionAmount,
        periodStart: payoutDate,
        payoutId: payout.id,
        appUrl: getAppUrl(),
        dashboardUrl: `${getAppUrl()}/provider/dashboard`,
      }),
    }).catch((err: Error) => console.warn("[email] Payout email failed:", err.message));
  }

  revalidatePath("/admin/dashboard");
  redirect(`/admin/dashboard?payout_created=${payoutOrder.id}`);
}

// ---------------------------------------------------------------------------
// Driver payouts
// ---------------------------------------------------------------------------

export async function createDriverPayoutAction(formData: FormData) {
  await requireRole(["admin"]);
  // The form sends the driver_profiles.id (matches orders.driver_id). We
  // resolve to the user_id for payouts.recipient_user_id.
  const driverProfileId = readString(formData, "driver_profile_id");

  if (!driverProfileId) {
    redirectWithError("Driver is required");
  }

  const supabase = await createSupabaseServerClient();
  const todayIso = new Date().toISOString();

  const { data: driverProfileRow } = await supabase
    .from("driver_profiles")
    .select("id, user_id")
    .eq("id", driverProfileId)
    .maybeSingle();

  if (!driverProfileRow) {
    redirectWithError("Driver profile was not found");
  }

  const driverUserId = driverProfileRow.user_id as string;

  const [{ data: orders }, { data: paidItems }, { data: userProfile }] =
    await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, driver_id, status, payment_status, delivery_fee, delivery_commission_amount, driver_earning, completed_at"
        )
        .eq("driver_id", driverProfileId)
        .eq("status", "completed")
        .eq("payment_status", "confirmed"),
      supabase
        .from("payout_items")
        .select("order_id, recipient_type")
        .eq("recipient_type", "driver"),
      supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", driverUserId)
        .maybeSingle()
    ]);

  const payables = groupDriverPayables(
    (orders ?? []) as DriverPayoutOrder[],
    new Map([
      [
        driverProfileId,
        {
          user_id: driverUserId,
          full_name: userProfile?.full_name ?? null,
          email: userProfile?.email ?? null
        }
      ]
    ]),
    (paidItems ?? []) as PaidPayoutItemLike[],
    todayIso
  );

  const payable = payables.find((p) => p.driverProfileId === driverProfileId);
  if (!payable || payable.orderCount === 0) {
    redirectWithError("Driver has no payout-eligible orders");
  }

  const { data: payout, error: payoutError } = await supabase
    .from("payouts")
    .insert({
      recipient_user_id: driverUserId,
      recipient_type: "driver",
      period_start: payable.periodStart,
      period_end: payable.periodEnd,
      gross_amount: payable.grossAmount,
      commission_amount: payable.commissionAmount,
      net_amount: payable.netAmount,
      status: "pending"
    })
    .select("id")
    .single();

  if (payoutError || !payout) {
    redirectWithError("Unable to create driver payout");
  }

  const items = payable.orders.map((order) => ({
    payout_id: payout.id,
    order_id: order.id,
    recipient_type: "driver" as const,
    amount: Number(order.driver_earning)
  }));

  const { error: itemError } = await supabase.from("payout_items").insert(items);

  if (itemError) {
    // Roll back the empty payout so we don't leave orphans behind.
    await supabase.from("payouts").update({ status: "cancelled" }).eq("id", payout.id);
    redirectWithError("Unable to attach orders to the driver payout");
  }

  await writeAdminAuditLog({
    action: "driver_payout_created",
    entityType: "driver_profile",
    entityId: driverProfileId,
    note: `Driver payout ${payout.id} for ${payable.orderCount} order(s)`,
    newValue: {
      payout_id: payout.id,
      net_amount: payable.netAmount,
      order_ids: payable.orders.map((o) => o.id)
    }
  });

  revalidatePath("/admin/dashboard");
  redirect(`/admin/dashboard?driver_payout_created=${payout.id}`);
}

export async function markPayoutPaidAction(formData: FormData) {
  await requireRole(["admin"]);
  const payoutId = readString(formData, "payout_id");
  const paymentReference = readString(formData, "payment_reference");

  if (!payoutId) {
    redirectWithError("Payout is required");
  }
  if (!paymentReference) {
    redirectWithError("Payment reference is required");
  }

  const supabase = await createSupabaseServerClient();
  const { data: payout } = await supabase
    .from("payouts")
    .select("*")
    .eq("id", payoutId)
    .maybeSingle();

  if (!payout) {
    redirectWithError("Payout was not found");
  }

  const payoutRow = payout as PayoutRow;
  if (payoutRow.status !== "pending") {
    redirectWithError(`Payout is already ${payoutRow.status}`);
  }

  const paidAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("payouts")
    .update({
      status: "paid",
      paid_at: paidAt,
      payment_reference: paymentReference
    })
    .eq("id", payoutId);

  if (updateError) {
    redirectWithError("Unable to mark payout as paid");
  }

  await writeAdminAuditLog({
    action: "payout_marked_paid",
    entityType: payoutRow.recipient_type === "driver" ? "driver_profile" : "provider_profile",
    entityId: payoutRow.recipient_user_id,
    note: `Payout ${payoutId} paid (ref ${paymentReference})`,
    oldValue: { status: payoutRow.status },
    newValue: { status: "paid", payment_reference: paymentReference }
  });

  const recipientProfile = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", payoutRow.recipient_user_id)
    .maybeSingle();

  if (recipientProfile.data) {
    const profileData = recipientProfile.data as Pick<
      ProfileRow,
      "email" | "full_name"
    >;
    const isDriver = payoutRow.recipient_type === "driver";
    sendEmail({
      to: profileData.email,
      subject: `Your payout has been paid — Thumeka`,
      react: PayoutPaidEmail({
        recipientName: profileData.full_name ?? profileData.email,
        netAmount: Number(payoutRow.net_amount),
        grossAmount: Number(payoutRow.gross_amount),
        commissionAmount: Number(payoutRow.commission_amount),
        paymentReference,
        paidAt,
        periodStart: payoutRow.period_start,
        periodEnd: payoutRow.period_end,
        payoutId,
        appUrl: getAppUrl(),
        dashboardUrl: `${getAppUrl()}/${isDriver ? "driver" : "provider"}/dashboard`
      })
    }).catch((err: Error) =>
      console.warn("[email] Payout paid email failed:", err.message)
    );
  }

  revalidatePath("/admin/dashboard");
  if (payoutRow.recipient_type === "driver") {
    revalidatePath("/driver/dashboard");
  }
  redirect(`/admin/dashboard?payout_paid=${payoutId}`);
}

export async function updatePayoutReferencePrefixAction(formData: FormData) {
  await requireRole(["admin"]);
  const raw = readString(formData, "payout_reference_prefix");

  // Cap length so a careless paste can't blow the column / banner UI. Allow an
  // empty string (admin opts out of any prefix); fall back to the SQL default
  // only via UPDATE … DEFAULT semantics by writing 'EFT-' on truly empty.
  if (raw.length > 20) {
    redirectWithError("Reference prefix must be 20 characters or fewer");
  }

  const prefix = raw || "EFT-";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("admin_settings")
    .update({ payout_reference_prefix: prefix })
    .not("id", "is", null);

  if (error) {
    redirectWithError("Unable to update reference prefix");
  }

  await writeAdminAuditLog({
    action: "payout_reference_prefix_updated",
    entityType: "admin_settings",
    entityId: null,
    note: `Payout reference prefix → ${prefix}`,
    newValue: { payout_reference_prefix: prefix }
  });

  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?tab=settings&prefix_updated=1");
}
