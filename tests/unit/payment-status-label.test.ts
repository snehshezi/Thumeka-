import { describe, expect, it } from "vitest";

import {
  paymentStatusLabelForBuyer,
  type PaymentStatus
} from "@/lib/order-rules";

describe("paymentStatusLabelForBuyer", () => {
  it("maps every PaymentStatus enum value to friendly buyer copy", () => {
    const cases: Array<[PaymentStatus, string]> = [
      ["not_requested", "Waiting for seller to accept"],
      ["awaiting_buyer_eft", "Ready to pay — see EFT details"],
      ["eft_submitted", "We're verifying your payment"],
      ["confirmed", "Payment confirmed"],
      ["failed", "Payment didn't go through"],
      ["refunded_manual", "Refund issued"]
    ];
    for (const [status, expected] of cases) {
      expect(paymentStatusLabelForBuyer(status)).toBe(expected);
    }
  });

  it("never returns the raw underscored enum to the user", () => {
    const statuses: PaymentStatus[] = [
      "not_requested",
      "awaiting_buyer_eft",
      "eft_submitted",
      "confirmed",
      "failed",
      "refunded_manual"
    ];
    for (const status of statuses) {
      const label = paymentStatusLabelForBuyer(status);
      expect(label).not.toMatch(/_/);
      // Labels are written as sentences, not enum names.
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
