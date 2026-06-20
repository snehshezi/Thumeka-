import { describe, expect, it } from "vitest";

import {
  groupDriverPayables,
  isDriverPayoutEligible,
  type DriverPayoutOrder,
  type DriverProfileLike,
  type PaidPayoutItemLike
} from "@/lib/payouts";

const TODAY = "2026-06-01T10:00:00.000Z";

function makeOrder(overrides: Partial<DriverPayoutOrder> = {}): DriverPayoutOrder {
  return {
    id: "order-1",
    driver_id: "driver-profile-1",
    status: "completed",
    payment_status: "confirmed",
    delivery_fee: "70",
    delivery_commission_amount: "5.60",
    driver_earning: "64.40",
    completed_at: "2026-05-28T12:00:00.000Z",
    ...overrides
  };
}

const driverProfiles = new Map<string, DriverProfileLike>([
  [
    "driver-profile-1",
    {
      user_id: "driver-user-1",
      full_name: "Lerato Driver",
      email: "lerato@example.com"
    }
  ],
  [
    "driver-profile-2",
    {
      user_id: "driver-user-2",
      full_name: "Themba Driver",
      email: "themba@example.com"
    }
  ]
]);

describe("isDriverPayoutEligible", () => {
  it("accepts a completed, paid, assigned, earning, not-yet-paid order", () => {
    expect(isDriverPayoutEligible(makeOrder(), [])).toBe(true);
  });

  it("rejects orders that are not completed", () => {
    expect(isDriverPayoutEligible(makeOrder({ status: "driver_assigned" }), [])).toBe(
      false
    );
  });

  it("rejects orders without a driver", () => {
    expect(
      isDriverPayoutEligible(makeOrder({ driver_id: null }), [])
    ).toBe(false);
  });

  it("rejects orders with zero driver earning", () => {
    expect(
      isDriverPayoutEligible(makeOrder({ driver_earning: "0" }), [])
    ).toBe(false);
  });

  it("rejects orders already in a driver payout item", () => {
    const paid: PaidPayoutItemLike[] = [
      { order_id: "order-1", recipient_type: "driver" }
    ];
    expect(isDriverPayoutEligible(makeOrder(), paid)).toBe(false);
  });

  it("ignores provider payout items for the same order", () => {
    const paid: PaidPayoutItemLike[] = [
      { order_id: "order-1", recipient_type: "provider" }
    ];
    expect(isDriverPayoutEligible(makeOrder(), paid)).toBe(true);
  });
});

describe("groupDriverPayables", () => {
  it("aggregates many orders for one driver into a single bucket", () => {
    const orders = [
      makeOrder({ id: "a", driver_earning: "64.40", delivery_fee: "70", delivery_commission_amount: "5.60" }),
      makeOrder({ id: "b", driver_earning: "92", delivery_fee: "100", delivery_commission_amount: "8" }),
      makeOrder({ id: "c", driver_earning: "46", delivery_fee: "50", delivery_commission_amount: "4" })
    ];

    const result = groupDriverPayables(orders, driverProfiles, [], TODAY);

    expect(result).toHaveLength(1);
    expect(result[0].driverProfileId).toBe("driver-profile-1");
    expect(result[0].driverUserId).toBe("driver-user-1");
    expect(result[0].driverName).toBe("Lerato Driver");
    expect(result[0].orderCount).toBe(3);
    expect(result[0].netAmount).toBe(202.4);
    expect(result[0].grossAmount).toBe(220);
    expect(result[0].commissionAmount).toBe(17.6);
  });

  it("ranks drivers by net amount descending", () => {
    const orders = [
      makeOrder({ id: "a", driver_id: "driver-profile-1", driver_earning: "50" }),
      makeOrder({ id: "b", driver_id: "driver-profile-2", driver_earning: "300" })
    ];
    const result = groupDriverPayables(orders, driverProfiles, [], TODAY);
    expect(result.map((p) => p.driverProfileId)).toEqual([
      "driver-profile-2",
      "driver-profile-1"
    ]);
  });

  it("derives periodStart from the earliest completed_at and periodEnd from today", () => {
    const orders = [
      makeOrder({ id: "a", completed_at: "2026-05-20T08:00:00.000Z" }),
      makeOrder({ id: "b", completed_at: "2026-05-28T08:00:00.000Z" })
    ];
    const result = groupDriverPayables(orders, driverProfiles, [], TODAY);
    expect(result[0].periodStart).toBe("2026-05-20");
    expect(result[0].periodEnd).toBe("2026-06-01");
  });

  it("excludes already-paid driver orders from the totals", () => {
    const orders = [
      makeOrder({ id: "a", driver_earning: "50" }),
      makeOrder({ id: "b", driver_earning: "60" })
    ];
    const paid: PaidPayoutItemLike[] = [
      { order_id: "a", recipient_type: "driver" }
    ];

    const result = groupDriverPayables(orders, driverProfiles, paid, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].orderCount).toBe(1);
    expect(result[0].netAmount).toBe(60);
  });

  it("returns an empty array when no orders are eligible", () => {
    const orders = [
      makeOrder({ id: "x", status: "driver_assigned" }),
      makeOrder({ id: "y", driver_id: null })
    ];
    expect(groupDriverPayables(orders, driverProfiles, [], TODAY)).toEqual([]);
  });

  it("skips drivers we can't resolve to a profile (no user_id, no payout)", () => {
    const sparse = new Map<string, DriverProfileLike>([
      [
        "driver-profile-1",
        { user_id: "driver-user-1", email: "ghost@example.com" }
      ]
    ]);
    const orders = [
      makeOrder({ id: "a", driver_id: "driver-profile-1" }),
      makeOrder({ id: "b", driver_id: "driver-profile-2" })
    ];
    const result = groupDriverPayables(orders, sparse, [], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].driverProfileId).toBe("driver-profile-1");
    expect(result[0].driverName).toBe("ghost@example.com");
  });
});
