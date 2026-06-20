import { describe, expect, it } from "vitest";

import {
  getProviderOrderBucket,
  PROVIDER_CLOSED_STATUSES,
  PROVIDER_NEEDS_ACTION_STATUSES
} from "@/lib/order-rules";

describe("getProviderOrderBucket", () => {
  it("buckets statuses the provider must act on as needs_action", () => {
    expect(getProviderOrderBucket("order_requested")).toBe("needs_action");
    expect(getProviderOrderBucket("awaiting_provider_acceptance")).toBe(
      "needs_action"
    );
    expect(getProviderOrderBucket("provider_location_warning")).toBe(
      "needs_action"
    );
  });

  it("buckets terminal statuses as closed", () => {
    expect(getProviderOrderBucket("completed")).toBe("closed");
    expect(getProviderOrderBucket("cancelled")).toBe("closed");
    expect(getProviderOrderBucket("provider_rejected")).toBe("closed");
  });

  it("buckets every other active status as in_progress", () => {
    for (const status of [
      "awaiting_buyer_eft",
      "eft_submitted",
      "payment_confirmed",
      "preparing_or_scheduled",
      "awaiting_driver_assignment",
      "driver_assigned",
      "picked_up",
      "out_for_delivery",
      "service_in_progress"
    ]) {
      expect(getProviderOrderBucket(status)).toBe("in_progress");
    }
  });

  it("defaults unknown statuses to in_progress", () => {
    expect(getProviderOrderBucket("some_future_status")).toBe("in_progress");
  });

  it("keeps needs_action and closed status sets disjoint", () => {
    for (const status of PROVIDER_NEEDS_ACTION_STATUSES) {
      expect(PROVIDER_CLOSED_STATUSES.has(status)).toBe(false);
    }
  });
});
