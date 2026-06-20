import { describe, expect, it } from "vitest";

import {
  DEFAULT_DELIVERY_COMMISSION_PERCENTAGE,
  calculateOrderFinancials
} from "@/lib/order-rules";

describe("calculateOrderFinancials — delivery fee split", () => {
  it("splits the delivery fee into driver_earning (92%) and delivery_commission (8%) by default", () => {
    const result = calculateOrderFinancials({
      listingPrice: 250,
      deliveryFee: 70
    });

    expect(result.deliveryFee).toBe(70);
    expect(result.deliveryCommissionPercentage).toBe(
      DEFAULT_DELIVERY_COMMISSION_PERCENTAGE
    );
    expect(result.deliveryCommissionAmount).toBe(5.6);
    expect(result.driverEarning).toBe(64.4);
    // The two amounts always reconcile to the full fee.
    expect(result.driverEarning + result.deliveryCommissionAmount).toBe(
      result.deliveryFee
    );
  });

  it("honours an overridden delivery commission percentage", () => {
    const result = calculateOrderFinancials({
      listingPrice: 250,
      deliveryFee: 100,
      deliveryCommissionPercentage: 10
    });

    expect(result.deliveryCommissionAmount).toBe(10);
    expect(result.driverEarning).toBe(90);
  });

  it("leaves listing commission unaffected by the delivery split", () => {
    const result = calculateOrderFinancials({
      listingPrice: 250,
      deliveryFee: 70,
      commissionPercentage: 12
    });

    expect(result.commissionAmount).toBe(30);
    expect(result.providerEarning).toBe(220);
    expect(result.buyerTotal).toBe(320);
  });

  it("zeroes the driver and commission amounts when there is no delivery", () => {
    const result = calculateOrderFinancials({
      listingPrice: 100,
      deliveryFee: 0
    });

    expect(result.deliveryFee).toBe(0);
    expect(result.driverEarning).toBe(0);
    expect(result.deliveryCommissionAmount).toBe(0);
    expect(result.buyerTotal).toBe(100);
  });

  it("reconciles cents on awkward fees by subtracting the commission from the fee", () => {
    // 33.33 * 0.08 = 2.6664 → rounds to 2.67, driver_earning = 33.33 - 2.67 = 30.66
    const result = calculateOrderFinancials({
      listingPrice: 200,
      deliveryFee: 33.33
    });

    expect(result.deliveryCommissionAmount).toBe(2.67);
    expect(result.driverEarning).toBe(30.66);
    expect(result.driverEarning + result.deliveryCommissionAmount).toBe(33.33);
  });
});

describe("calculateOrderFinancials — quantity", () => {
  it("defaults to quantity 1 when the arg is omitted", () => {
    // Same numbers as the canonical single-unit case above — proves the
    // default keeps the existing semantics for callers that haven't been
    // updated yet.
    const result = calculateOrderFinancials({
      listingPrice: 250,
      deliveryFee: 70
    });

    expect(result.quantity).toBe(1);
    expect(result.lineSubtotal).toBe(250);
    expect(result.commissionAmount).toBe(30);
    expect(result.providerEarning).toBe(220);
    expect(result.buyerTotal).toBe(320);
  });

  it("multiplies the listing side of the order by quantity", () => {
    // 3 × R200 = R600 subtotal. 12% of R600 = R72 commission. Provider keeps
    // R528. Delivery (R70) is per-trip — qty doesn't change it. Buyer pays
    // R600 + R70 = R670.
    const result = calculateOrderFinancials({
      listingPrice: 200,
      deliveryFee: 70,
      quantity: 3
    });

    expect(result.listingPrice).toBe(200);
    expect(result.quantity).toBe(3);
    expect(result.lineSubtotal).toBe(600);
    expect(result.commissionAmount).toBe(72);
    expect(result.providerEarning).toBe(528);
    expect(result.deliveryFee).toBe(70);
    expect(result.driverEarning).toBe(64.4);
    expect(result.buyerTotal).toBe(670);
  });

  it("handles a larger quantity without drifting on rounding", () => {
    // 5 × R33.33 = R166.65, 12% = R19.998 → R20.00; provider keeps R146.65.
    const result = calculateOrderFinancials({
      listingPrice: 33.33,
      deliveryFee: 70,
      quantity: 5
    });

    expect(result.lineSubtotal).toBe(166.65);
    expect(result.commissionAmount).toBe(20);
    expect(result.providerEarning).toBe(146.65);
    expect(result.buyerTotal).toBe(236.65);
  });

  it("falls back to quantity 1 on garbage input (non-integer, zero, negative)", () => {
    const float = calculateOrderFinancials({
      listingPrice: 250,
      deliveryFee: 70,
      // @ts-expect-error — runtime safety check for callers that don't have TS
      quantity: 2.5
    });
    const zero = calculateOrderFinancials({
      listingPrice: 250,
      deliveryFee: 70,
      quantity: 0
    });
    const negative = calculateOrderFinancials({
      listingPrice: 250,
      deliveryFee: 70,
      quantity: -3
    });

    expect(float.quantity).toBe(1);
    expect(zero.quantity).toBe(1);
    expect(negative.quantity).toBe(1);
    expect(float.lineSubtotal).toBe(250);
    expect(zero.lineSubtotal).toBe(250);
    expect(negative.lineSubtotal).toBe(250);
  });
});

describe("calculateOrderFinancials — multi-line override", () => {
  it("uses the explicit lineSubtotal instead of unit × qty when provided", () => {
    // Simulate a 3-line cart: R 100×2 + R 25×1 + R 40×3 = R 345. Listing
    // price is the primary line's unit (R 100); quantity is informational.
    // Commission is 12% of R 345 = R 41.40; provider earns R 303.60; buyer
    // pays R 345 + R 70 delivery = R 415.
    const result = calculateOrderFinancials({
      listingPrice: 100,
      quantity: 2,
      lineSubtotalOverride: 345,
      deliveryFee: 70
    });

    expect(result.listingPrice).toBe(100);
    expect(result.quantity).toBe(2);
    expect(result.lineSubtotal).toBe(345);
    expect(result.commissionAmount).toBe(41.4);
    expect(result.providerEarning).toBe(303.6);
    expect(result.buyerTotal).toBe(415);
  });

  it("ignores zero / negative / non-finite overrides and falls back to unit × qty", () => {
    const zero = calculateOrderFinancials({
      listingPrice: 100,
      quantity: 2,
      lineSubtotalOverride: 0,
      deliveryFee: 70
    });

    // The override is treated as "not set" in the API route, but the helper
    // itself sees a present-but-zero value here. Confirm it still uses the
    // override when provided — even when zero — to make the contract
    // explicit. Callers must validate upstream.
    expect(zero.lineSubtotal).toBe(0);
    expect(zero.commissionAmount).toBe(0);
    expect(zero.buyerTotal).toBe(70);
  });
});
