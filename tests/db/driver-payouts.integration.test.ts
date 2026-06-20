import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { groupDriverPayables, type DriverPayoutOrder } from "@/lib/payouts";
import {
  type LocalSupabaseSeed,
  resetLocalSupabaseSeed,
  seedLocalSupabase
} from "@/tests/helpers/seed";
import {
  createProductDeliveryDbFlow,
  productDeliveryE2EListing
} from "@/tests/helpers/product-delivery-db-flow";
import { createTestSupabaseAdminClient } from "@/tests/helpers/supabase";
import { loadTestEnvFile } from "@/tests/helpers/supabase-env";

const TODAY = "2026-06-01T10:00:00.000Z";

async function walkOrderToCompleted(
  seed: LocalSupabaseSeed
): Promise<{ orderId: string }> {
  const flow = createProductDeliveryDbFlow(seed);
  await flow.preparePendingApprovals();
  await flow.approveProvider();
  const listing = await flow.createProductListingAsProvider();
  await flow.approveDriver();
  await flow.makeDriverAvailable();

  // Insert an order request directly via the service role so we can drive the
  // flow without the buyer-facing checkout server action.
  const serviceRole = createTestSupabaseAdminClient();
  const { data: orderRow } = await serviceRole
    .from("orders")
    .insert({
      buyer_id: seed.users.buyer.profileId,
      provider_id: seed.providerProfile.id,
      listing_id: listing.id,
      order_type: productDeliveryE2EListing.listing_type,
      status: "order_requested",
      buyer_name: "Driver Payout Test Buyer",
      buyer_phone: "0710000000",
      buyer_email: "buyer-test@example.com",
      delivery_address: "1 Driver Payout Lane",
      suburb: "Berea",
      listing_price: productDeliveryE2EListing.price,
      buyer_total: productDeliveryE2EListing.price,
      commission_percentage: 12,
      payment_status: "not_requested"
    })
    .select("id")
    .single();
  if (!orderRow) throw new Error("Failed to insert seed order");
  const orderId = orderRow.id as string;

  await flow.providerAcceptsOrder(orderId);
  await flow.adminConfirmsEft(orderId);
  await flow.adminAssignsDriver(orderId);
  await flow.driverMarksPickedUp(orderId);
  await flow.driverMarksOutForDelivery(orderId);
  await flow.driverCompletesDelivery(orderId);

  return { orderId };
}

describe("driver payout flow", () => {
  let seed: LocalSupabaseSeed;
  let seeded = false;
  let orderId: string;

  beforeAll(async () => {
    loadTestEnvFile();
    seed = await seedLocalSupabase();
    seeded = true;
    const r = await walkOrderToCompleted(seed);
    orderId = r.orderId;
  });

  afterAll(async () => {
    if (seeded) {
      await resetLocalSupabaseSeed();
    }
  });

  it("stores delivery_commission_amount alongside driver_earning and the two reconcile", async () => {
    const serviceRole = createTestSupabaseAdminClient();
    const { data, error } = await serviceRole
      .from("orders")
      .select("delivery_fee, delivery_commission_amount, driver_earning")
      .eq("id", orderId)
      .single();

    expect(error).toBeNull();
    const fee = Number(data?.delivery_fee);
    const commission = Number(data?.delivery_commission_amount);
    const driverEarning = Number(data?.driver_earning);

    expect(fee).toBeGreaterThan(0);
    expect(commission).toBeGreaterThan(0);
    expect(driverEarning).toBeGreaterThan(0);
    // The 8% split — driver_earning + delivery_commission_amount should equal
    // the delivery fee to the cent.
    expect(Math.round((driverEarning + commission) * 100) / 100).toBe(fee);
  });

  it("records a delivery_commission transaction row on EFT confirmation", async () => {
    const serviceRole = createTestSupabaseAdminClient();
    const { data, error } = await serviceRole
      .from("transactions")
      .select("transaction_type, amount")
      .eq("order_id", orderId);

    expect(error).toBeNull();
    const types = (data ?? []).map((r) => r.transaction_type as string);
    expect(types).toContain("buyer_eft_confirmed");
    expect(types).toContain("platform_commission");
    expect(types).toContain("delivery_commission");
    expect(types).toContain("driver_earning");
  });

  it("aggregates the completed order into a driver payable", async () => {
    const serviceRole = createTestSupabaseAdminClient();
    const driverProfileId = seed.driverProfile.id;
    const driverUserId = seed.users.driver.profileId;
    const [{ data: orders }, { data: profile }] = await Promise.all([
      serviceRole
        .from("orders")
        .select(
          "id, driver_id, status, payment_status, delivery_fee, delivery_commission_amount, driver_earning, completed_at"
        )
        .eq("driver_id", driverProfileId)
        .eq("status", "completed")
        .eq("payment_status", "confirmed"),
      serviceRole
        .from("profiles")
        .select("full_name, email")
        .eq("id", driverUserId)
        .single()
    ]);

    const payables = groupDriverPayables(
      (orders ?? []) as DriverPayoutOrder[],
      new Map([
        [
          driverProfileId,
          {
            user_id: driverUserId,
            full_name: profile?.full_name,
            email: profile?.email
          }
        ]
      ]),
      [],
      TODAY
    );

    expect(payables).toHaveLength(1);
    expect(payables[0].driverProfileId).toBe(driverProfileId);
    expect(payables[0].driverUserId).toBe(driverUserId);
    expect(payables[0].orderCount).toBeGreaterThan(0);
    expect(payables[0].netAmount).toBeGreaterThan(0);
  });

  it("inserts a driver payout + payout_item and enforces per-recipient uniqueness", async () => {
    const serviceRole = createTestSupabaseAdminClient();
    const driverUserId = seed.users.driver.profileId;

    const { data: payout, error: payoutErr } = await serviceRole
      .from("payouts")
      .insert({
        recipient_user_id: driverUserId,
        recipient_type: "driver",
        period_start: "2026-05-25",
        period_end: "2026-06-01",
        gross_amount: 70,
        commission_amount: 5.6,
        net_amount: 64.4,
        status: "pending"
      })
      .select("id")
      .single();

    expect(payoutErr).toBeNull();
    expect(payout).not.toBeNull();

    const { error: itemErr } = await serviceRole.from("payout_items").insert({
      payout_id: payout!.id,
      order_id: orderId,
      recipient_type: "driver",
      amount: 64.4
    });
    expect(itemErr).toBeNull();

    // Second insert for the SAME order + driver must fail (unique index).
    const { data: dupePayout } = await serviceRole
      .from("payouts")
      .insert({
        recipient_user_id: driverUserId,
        recipient_type: "driver",
        period_start: "2026-06-01",
        period_end: "2026-06-08",
        gross_amount: 0,
        commission_amount: 0,
        net_amount: 0,
        status: "pending"
      })
      .select("id")
      .single();

    const { error: dupeErr } = await serviceRole.from("payout_items").insert({
      payout_id: dupePayout!.id,
      order_id: orderId,
      recipient_type: "driver",
      amount: 64.4
    });
    expect(dupeErr).not.toBeNull();
    expect(dupeErr?.message).toMatch(/unique|duplicate/i);

    // But the same order CAN go into a provider payout — proving the relaxed
    // (order_id, recipient_type) constraint works.
    const { data: provPayout } = await serviceRole
      .from("payouts")
      .insert({
        recipient_user_id: seed.providerProfile.user_id,
        recipient_type: "provider",
        period_start: "2026-05-25",
        period_end: "2026-06-01",
        gross_amount: 250,
        commission_amount: 30,
        net_amount: 220,
        status: "pending"
      })
      .select("id")
      .single();
    const { error: provItemErr } = await serviceRole.from("payout_items").insert({
      payout_id: provPayout!.id,
      order_id: orderId,
      recipient_type: "provider",
      amount: 220
    });
    expect(provItemErr).toBeNull();
  });

  it("transitions a pending driver payout to paid and stamps the reference", async () => {
    const serviceRole = createTestSupabaseAdminClient();
    const driverUserId = seed.users.driver.profileId;

    const { data: pendingPayouts } = await serviceRole
      .from("payouts")
      .select("id")
      .eq("recipient_user_id", driverUserId)
      .eq("recipient_type", "driver")
      .eq("status", "pending")
      .limit(1);

    expect(pendingPayouts?.length).toBeGreaterThan(0);
    const payoutId = (pendingPayouts ?? [])[0].id as string;

    const { error: updateErr } = await serviceRole
      .from("payouts")
      .update({
        status: "paid",
        paid_at: TODAY,
        payment_reference: "FNB-RUNBOOK-001"
      })
      .eq("id", payoutId);

    expect(updateErr).toBeNull();

    const { data: paidPayout } = await serviceRole
      .from("payouts")
      .select("status, payment_reference, paid_at")
      .eq("id", payoutId)
      .single();

    expect(paidPayout?.status).toBe("paid");
    expect(paidPayout?.payment_reference).toBe("FNB-RUNBOOK-001");
    expect(paidPayout?.paid_at).not.toBeNull();
  });
});
