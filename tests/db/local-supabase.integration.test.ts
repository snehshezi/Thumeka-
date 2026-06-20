import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  testPendingProviderProfile,
  testProviderProfile
} from "@/tests/fixtures/listings";
import { testOrders } from "@/tests/fixtures/orders";
import { testUsers } from "@/tests/fixtures/users";
import {
  type LocalSupabaseSeed,
  resetLocalSupabaseSeed,
  seedLocalSupabase
} from "@/tests/helpers/seed";
import {
  createAuthenticatedTestClient,
  createTestSupabaseAdminClient,
  createTestSupabaseAnonClient
} from "@/tests/helpers/supabase";
import { loadTestEnvFile } from "@/tests/helpers/supabase-env";

type ResultWithError = {
  error: {
    message: string;
  } | null;
};

function expectNoError(result: ResultWithError) {
  expect(result.error).toBeNull();
}

describe("local Supabase database policies", () => {
  let seed: LocalSupabaseSeed;
  let seeded = false;

  beforeAll(async () => {
    loadTestEnvFile();
    seed = await seedLocalSupabase();
    seeded = true;
  });

  afterAll(async () => {
    if (seeded) {
      await resetLocalSupabaseSeed();
    }
  });

  it("creates profiles from local auth users with expected roles", async () => {
    const admin = await createAuthenticatedTestClient(testUsers.admin);
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, role")
      .in(
        "email",
        Object.values(testUsers).map((user) => user.email)
      );

    expectNoError({ error });
    expect(data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: seed.users.buyer.profileId,
          email: testUsers.buyer.email,
          role: "buyer"
        }),
        expect.objectContaining({
          id: seed.users.provider.profileId,
          email: testUsers.provider.email,
          role: "provider"
        }),
        expect.objectContaining({
          id: seed.users.driver.profileId,
          email: testUsers.driver.email,
          role: "driver"
        }),
        expect.objectContaining({
          id: seed.users.admin.profileId,
          email: testUsers.admin.email,
          role: "admin"
        })
      ])
    );
  });

  it("only exposes active listings from approved providers to the public", async () => {
    const anon = createTestSupabaseAnonClient();
    const { data, error } = await anon
      .from("listings")
      .select("id, title")
      .order("id");

    expectNoError({ error });
    const ids = (data ?? []).map((listing) => listing.id);

    expect(ids).toContain(seed.listings[0].id);
    expect(ids).not.toContain(seed.listings[1].id);
    expect(ids).not.toContain(seed.listings[2].id);
  });

  it("lets a buyer create and read an own order while another buyer cannot read it", async () => {
    const buyer = await createAuthenticatedTestClient(testUsers.buyer);
    const otherBuyer = await createAuthenticatedTestClient(testUsers.otherBuyer);
    const orderId = "60000000-0000-4000-8000-000000000101";
    const createdOrder = {
      id: orderId,
      buyer_id: seed.users.buyer.profileId,
      provider_id: testProviderProfile.id,
      listing_id: seed.listings[0].id,
      order_type: "product",
      status: "order_requested",
      buyer_name: testUsers.buyer.fullName,
      buyer_phone: testUsers.buyer.phone,
      buyer_email: testUsers.buyer.email,
      suburb: "Berea",
      listing_price: 85,
      buyer_total: 85,
      commission_percentage: 12,
      payment_status: "not_requested"
    };

    const insertResult = await buyer.from("orders").insert(createdOrder);
    expectNoError(insertResult);

    const ownerRead = await buyer
      .from("orders")
      .select("id, buyer_id")
      .eq("id", orderId)
      .single();
    expectNoError(ownerRead);
    expect(ownerRead.data).toEqual(
      expect.objectContaining({
        id: orderId,
        buyer_id: seed.users.buyer.profileId
      })
    );

    const blockedRead = await otherBuyer
      .from("orders")
      .select("id")
      .eq("id", orderId);
    expectNoError(blockedRead);
    expect(blockedRead.data).toEqual([]);
  });

  it("allows approved providers to create listings and blocks pending providers", async () => {
    const provider = await createAuthenticatedTestClient(testUsers.provider);
    const pendingProvider = await createAuthenticatedTestClient(
      testUsers.pendingProvider
    );

    const approvedInsert = await provider.from("listings").insert({
      id: "50000000-0000-4000-8000-000000000101",
      provider_id: testProviderProfile.id,
      category_id: seed.listings[0].category_id,
      title: "Provider-created DB test listing",
      description: "Created through RLS by an approved provider.",
      listing_type: "product",
      price: 110,
      pricing_type: "fixed",
      suburb: "Berea",
      is_active: true,
      admin_disabled: false
    });
    expectNoError(approvedInsert);

    const pendingInsert = await pendingProvider.from("listings").insert({
      id: "50000000-0000-4000-8000-000000000102",
      provider_id: testPendingProviderProfile.id,
      category_id: seed.listings[0].category_id,
      title: "Pending provider DB test listing",
      description: "This should be blocked by provider approval RLS.",
      listing_type: "product",
      price: 90,
      pricing_type: "fixed",
      suburb: "Glenwood",
      is_active: true,
      admin_disabled: false
    });

    expect(pendingInsert.error?.message).toMatch(/row-level security|policy/i);
  });

  it("keeps orders invisible to drivers until assignment", async () => {
    const driver = await createAuthenticatedTestClient(testUsers.driver);
    const admin = createTestSupabaseAdminClient();
    const orderId = testOrders[0].id;

    const beforeAssignment = await driver
      .from("orders")
      .select("id")
      .eq("id", orderId);
    expectNoError(beforeAssignment);
    expect(beforeAssignment.data).toEqual([]);

    const assignment = await admin
      .from("orders")
      .update({
        driver_id: seed.driverProfile.id,
        status: "driver_assigned"
      })
      .eq("id", orderId);
    expectNoError(assignment);

    const afterAssignment = await driver
      .from("orders")
      .select("id, driver_id")
      .eq("id", orderId)
      .single();
    expectNoError(afterAssignment);
    expect(afterAssignment.data).toEqual(
      expect.objectContaining({
        id: orderId,
        driver_id: seed.driverProfile.id
      })
    );
  });

  it("allows admins to read audit logs while buyers cannot", async () => {
    const serviceRole = createTestSupabaseAdminClient();
    const admin = await createAuthenticatedTestClient(testUsers.admin);
    const buyer = await createAuthenticatedTestClient(testUsers.buyer);
    const auditLogId = "a0000000-0000-4000-8000-000000000001";

    const insertResult = await serviceRole.from("audit_logs").insert({
      id: auditLogId,
      actor_user_id: seed.users.admin.profileId,
      actor_role: "admin",
      action: "provider_approved",
      entity_type: "provider_profile",
      entity_id: testProviderProfile.id,
      note: "DB policy test"
    });
    expectNoError(insertResult);

    const adminRead = await admin
      .from("audit_logs")
      .select("id, action")
      .eq("id", auditLogId)
      .single();
    expectNoError(adminRead);
    expect(adminRead.data).toEqual(
      expect.objectContaining({
        id: auditLogId,
        action: "provider_approved"
      })
    );

    const buyerRead = await buyer
      .from("audit_logs")
      .select("id")
      .eq("id", auditLogId);
    expectNoError(buyerRead);
    expect(buyerRead.data).toEqual([]);
  });

  it("blocks buyers from creating orders for another buyer profile", async () => {
    const buyer = await createAuthenticatedTestClient(testUsers.buyer);
    const orderId = "60000000-0000-4000-8000-000000000201";

    const insertResult = await buyer.from("orders").insert({
      id: orderId,
      buyer_id: seed.users.otherBuyer.profileId,
      provider_id: testProviderProfile.id,
      listing_id: seed.listings[0].id,
      order_type: "product",
      status: "order_requested",
      buyer_name: testUsers.otherBuyer.fullName,
      buyer_phone: testUsers.otherBuyer.phone,
      buyer_email: testUsers.otherBuyer.email,
      suburb: "Berea",
      listing_price: 85,
      buyer_total: 85,
      commission_percentage: 12,
      payment_status: "not_requested"
    });

    expect(insertResult.error?.message).toMatch(/row-level security|policy/i);
  });

  it("blocks non-admin users from writing financial and audit records", async () => {
    const buyer = await createAuthenticatedTestClient(testUsers.buyer);
    const provider = await createAuthenticatedTestClient(testUsers.provider);

    const transactionWrite = await buyer.from("transactions").insert({
      order_id: testOrders[0].id,
      transaction_type: "buyer_eft_confirmed",
      amount: 85,
      direction: "credit",
      status: "recorded",
      created_by: seed.users.buyer.profileId
    });
    expect(transactionWrite.error?.message).toMatch(/row-level security|policy/i);

    const payoutWrite = await provider.from("payouts").insert({
      recipient_user_id: seed.users.provider.profileId,
      recipient_type: "provider",
      period_start: "2026-05-19",
      period_end: "2026-05-25",
      gross_amount: 85,
      commission_amount: 10.2,
      net_amount: 74.8,
      status: "pending"
    });
    expect(payoutWrite.error?.message).toMatch(/row-level security|policy/i);

    const auditWrite = await buyer.from("audit_logs").insert({
      actor_user_id: seed.users.buyer.profileId,
      actor_role: "buyer",
      action: "forbidden_audit_write",
      entity_type: "order",
      entity_id: testOrders[0].id,
      note: "This should be blocked"
    });
    expect(auditWrite.error?.message).toMatch(/row-level security|policy/i);
  });

  it("lets payout recipients read their payouts while other buyers cannot", async () => {
    const serviceRole = createTestSupabaseAdminClient();
    const provider = await createAuthenticatedTestClient(testUsers.provider);
    const otherBuyer = await createAuthenticatedTestClient(testUsers.otherBuyer);
    const payoutId = "80000000-0000-4000-8000-000000000101";

    const insertResult = await serviceRole.from("payouts").insert({
      id: payoutId,
      recipient_user_id: seed.users.provider.profileId,
      recipient_type: "provider",
      period_start: "2026-05-19",
      period_end: "2026-05-25",
      gross_amount: 85,
      commission_amount: 10.2,
      net_amount: 74.8,
      status: "pending"
    });
    expectNoError(insertResult);

    const recipientRead = await provider
      .from("payouts")
      .select("id, recipient_user_id")
      .eq("id", payoutId)
      .single();
    expectNoError(recipientRead);
    expect(recipientRead.data).toEqual(
      expect.objectContaining({
        id: payoutId,
        recipient_user_id: seed.users.provider.profileId
      })
    );

    const blockedRead = await otherBuyer.from("payouts").select("id").eq("id", payoutId);
    expectNoError(blockedRead);
    expect(blockedRead.data).toEqual([]);
  });

  it("prevents drivers from updating unassigned orders", async () => {
    const serviceRole = createTestSupabaseAdminClient();
    const driver = await createAuthenticatedTestClient(testUsers.driver);
    const orderId = "60000000-0000-4000-8000-000000000202";

    const createOrder = await serviceRole.from("orders").insert({
      id: orderId,
      buyer_id: seed.users.buyer.profileId,
      provider_id: testProviderProfile.id,
      listing_id: seed.listings[0].id,
      order_type: "product",
      status: "payment_confirmed",
      buyer_name: testUsers.buyer.fullName,
      buyer_phone: testUsers.buyer.phone,
      buyer_email: testUsers.buyer.email,
      suburb: "Berea",
      listing_price: 85,
      buyer_total: 85,
      commission_percentage: 12,
      payment_status: "confirmed"
    });
    expectNoError(createOrder);

    const driverUpdate = await driver
      .from("orders")
      .update({ status: "picked_up" })
      .eq("id", orderId)
      .select("id");
    expectNoError(driverUpdate);
    expect(driverUpdate.data).toEqual([]);

    const unchangedOrder = await serviceRole
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    expectNoError(unchangedOrder);
    expect(unchangedOrder.data?.status).toBe("payment_confirmed");
  });

  it("prevents the same completed order from being added to payouts twice", async () => {
    const serviceRole = createTestSupabaseAdminClient();
    const orderId = testOrders[0].id;

    const completedOrder = await serviceRole
      .from("orders")
      .update({
        status: "completed",
        payment_status: "confirmed",
        completed_at: "2026-05-25T10:30:00.000Z"
      })
      .eq("id", orderId);
    expectNoError(completedOrder);

    const firstPayout = await serviceRole.from("payouts").insert({
      id: "80000000-0000-4000-8000-000000000001",
      recipient_user_id: seed.users.provider.profileId,
      recipient_type: "provider",
      period_start: "2026-05-19",
      period_end: "2026-05-25",
      gross_amount: 85,
      commission_amount: 10.2,
      net_amount: 74.8,
      status: "pending"
    });
    expectNoError(firstPayout);

    const firstItem = await serviceRole.from("payout_items").insert({
      id: "90000000-0000-4000-8000-000000000001",
      payout_id: "80000000-0000-4000-8000-000000000001",
      order_id: orderId,
      amount: 74.8
    });
    expectNoError(firstItem);

    const secondPayout = await serviceRole.from("payouts").insert({
      id: "80000000-0000-4000-8000-000000000002",
      recipient_user_id: seed.users.provider.profileId,
      recipient_type: "provider",
      period_start: "2026-05-19",
      period_end: "2026-05-25",
      gross_amount: 85,
      commission_amount: 10.2,
      net_amount: 74.8,
      status: "pending"
    });
    expectNoError(secondPayout);

    const duplicateItem = await serviceRole.from("payout_items").insert({
      id: "90000000-0000-4000-8000-000000000002",
      payout_id: "80000000-0000-4000-8000-000000000002",
      order_id: orderId,
      amount: 74.8
    });

    expect(duplicateItem.error?.message).toMatch(/duplicate|unique/i);
  });
});
