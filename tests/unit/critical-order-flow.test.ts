import { describe, expect, it } from "vitest";

import {
  acceptProviderOrder,
  assignDriver,
  calculateCommission,
  calculateDeliveryFee,
  canBuyerSeeEftInstructions,
  completeDriverDelivery,
  confirmEftPayment,
  getPayoutEligibleOrders,
  isPayoutEligible,
  markDriverOutForDelivery,
  markDriverPickedUp
} from "@/lib/order-rules";
import {
  createCriticalOrderFixture,
  createPayoutItemForOrder,
  criticalDriver,
  criticalOrderSettings
} from "@/tests/fixtures/critical-order-flow";
import {
  createAcceptedCriticalOrder,
  createAssignedCriticalOrder,
  createCompletedCriticalOrder,
  createPaidCriticalOrder
} from "@/tests/helpers/critical-order-flow";
import { testUsers } from "@/tests/fixtures/users";

describe("critical order flow rules", () => {
  it("calculates commission at 12%", () => {
    expect(calculateCommission(250, 12)).toEqual({
      commissionPercentage: 12,
      commissionAmount: 30,
      providerEarning: 220
    });
  });

  it("calculates delivery fee using R36 plus distance times price per km", () => {
    expect(
      calculateDeliveryFee({
        baseFee: 36,
        distanceKm: 4,
        pricePerKm: 8.5
      })
    ).toBe(70);
  });

  it("prevents buyer from seeing EFT instructions before provider accepts", () => {
    const order = createCriticalOrderFixture();

    expect(
      canBuyerSeeEftInstructions(
        order,
        criticalOrderSettings.eft_payment_instructions
      )
    ).toBe(false);
  });

  it("allows buyer to see EFT instructions after provider accepts", () => {
    const acceptedOrder = acceptProviderOrder(
      createCriticalOrderFixture(),
      "2026-05-25T08:00:00.000Z"
    );

    expect(acceptedOrder.status).toBe("awaiting_buyer_eft");
    expect(acceptedOrder.payment_status).toBe("awaiting_buyer_eft");
    expect(acceptedOrder.delivery_fee).toBe(70);
    expect(acceptedOrder.buyer_total).toBe(320);
    expect(
      canBuyerSeeEftInstructions(
        acceptedOrder,
        criticalOrderSettings.eft_payment_instructions
      )
    ).toBe(true);
  });

  it("preserves the checkout-locked fee exactly — acceptance never recalculates", () => {
    const quoted = createCriticalOrderFixture({
      delivery_distance_km: 10,
      delivery_fee: 200,
      buyer_total: 450,
      commission_amount: 30,
      provider_earning: 220,
      driver_earning: 184,
      delivery_commission_amount: 16
    });

    const acceptedOrder = acceptProviderOrder(quoted, "2026-05-25T08:00:00.000Z");

    expect(acceptedOrder.status).toBe("awaiting_buyer_eft");
    expect(acceptedOrder.delivery_fee).toBe(200);
    expect(acceptedOrder.buyer_total).toBe(450);
    expect(acceptedOrder.driver_earning).toBe(184);
    expect(acceptedOrder.delivery_commission_amount).toBe(16);
  });

  it("refuses to accept an order that arrived without a delivery quote", () => {
    const unpriced = createCriticalOrderFixture({
      delivery_fee: 0,
      buyer_total: 250,
      driver_earning: 0,
      delivery_commission_amount: 0
    });

    expect(() =>
      acceptProviderOrder(unpriced, "2026-05-25T08:00:00.000Z")
    ).toThrow(/missing a delivery quote/i);
  });

  it("refuses to accept an order that's priced but missing the distance", () => {
    const malformed = createCriticalOrderFixture({
      delivery_distance_km: null
    });

    expect(() =>
      acceptProviderOrder(malformed, "2026-05-25T08:00:00.000Z")
    ).toThrow(/missing a delivery quote/i);
  });

  it("creates transaction records when admin confirms EFT", () => {
    const { order, transactions } = confirmEftPayment({
      order: createAcceptedCriticalOrder(),
      adminProfileId: testUsers.admin.profileId,
      paymentReference: "EFT-TEST-001"
    });

    expect(order.status).toBe("payment_confirmed");
    expect(order.payment_status).toBe("confirmed");
    expect(order.payment_reference).toBe("EFT-TEST-001");
    expect(transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transaction_type: "buyer_eft_confirmed",
          amount: 320
        }),
        expect.objectContaining({
          transaction_type: "platform_commission",
          amount: 30
        }),
        expect.objectContaining({
          transaction_type: "provider_earning",
          amount: 220
        }),
        // 8% of the 70 delivery fee — kept by the platform.
        expect.objectContaining({
          transaction_type: "delivery_commission",
          amount: 5.6
        }),
        // Remaining 92% — owed to the driver.
        expect.objectContaining({
          transaction_type: "driver_earning",
          amount: 64.4
        })
      ])
    );
    expect(transactions).toHaveLength(5);
  });

  it("lets admin assign an approved driver after EFT confirmation", () => {
    const { order: paidOrder } = createPaidCriticalOrder();
    const assignedOrder = assignDriver(paidOrder, criticalDriver);

    expect(assignedOrder.driver_id).toBe(criticalDriver.id);
    expect(assignedOrder.status).toBe("driver_assigned");
  });

  it("lets the assigned driver complete delivery", () => {
    const { order } = createAssignedCriticalOrder();
    const completedOrder = createCompletedCriticalOrder().order;

    expect(order.status).toBe("driver_assigned");
    expect(completedOrder.status).toBe("completed");
    expect(completedOrder.completed_at).toBe("2026-05-25T10:30:00.000Z");
  });

  it("marks completed paid orders as payout eligible", () => {
    const { order } = createCompletedCriticalOrder();

    expect(isPayoutEligible(order)).toBe(true);
    expect(getPayoutEligibleOrders([order])).toEqual([order]);
  });

  it("prevents the same order from being paid out twice", () => {
    const { order } = createCompletedCriticalOrder();
    const existingPayoutItem = createPayoutItemForOrder(order.id);

    expect(isPayoutEligible(order, [existingPayoutItem])).toBe(false);
    expect(getPayoutEligibleOrders([order], [existingPayoutItem])).toEqual([]);
  });

  it("rejects EFT confirmation before provider acceptance", () => {
    expect(() =>
      confirmEftPayment({
        order: createCriticalOrderFixture(),
        adminProfileId: testUsers.admin.profileId,
        paymentReference: "EFT-EARLY"
      })
    ).toThrow("EFT can only be confirmed after provider acceptance");
  });

  it("rejects driver assignment before payment confirmation", () => {
    expect(() => assignDriver(createAcceptedCriticalOrder(), criticalDriver)).toThrow(
      "Driver can only be assigned after EFT is confirmed"
    );
  });

  it("rejects suspended drivers during assignment", () => {
    const { order } = createPaidCriticalOrder();

    expect(() =>
      assignDriver(order, {
        ...criticalDriver,
        availability_status: "suspended"
      })
    ).toThrow("Suspended driver cannot be assigned");
  });

  it("enforces driver delivery status order", () => {
    const { order: paidOrder } = createPaidCriticalOrder();
    const { order: assignedOrder } = createAssignedCriticalOrder();

    expect(() => markDriverPickedUp(paidOrder)).toThrow(
      "Order cannot be picked up without an assigned driver"
    );
    expect(() => markDriverOutForDelivery(assignedOrder)).toThrow(
      "Order must be picked up before going out for delivery"
    );
    expect(() =>
      completeDriverDelivery({
        ...assignedOrder,
        payment_status: "awaiting_buyer_eft"
      })
    ).toThrow("Delivery cannot be completed before payment is confirmed");
  });
});
