import { describe, expect, it } from "vitest";

import { orderRef, pushEvents } from "@/lib/push-events";

describe("pushEvents copy", () => {
  it("providerNewOrder weaves in listing title and order ref", () => {
    const payload = pushEvents.providerNewOrder("Sourdough loaf", "ABC12345");
    expect(payload.title).toBe("New order request");
    expect(payload.body).toContain("Sourdough loaf");
    expect(payload.body).toContain("#ABC12345");
    expect(payload.url).toBe("/provider/dashboard");
  });

  it("providerPaymentConfirmed includes order ref", () => {
    const payload = pushEvents.providerPaymentConfirmed("XYZ99999");
    expect(payload.body).toContain("#XYZ99999");
    expect(payload.body.toLowerCase()).toContain("paid");
    expect(payload.url).toBe("/provider/dashboard");
  });

  it("buyerOrderAccepted names the provider", () => {
    const payload = pushEvents.buyerOrderAccepted("Bakery on 7th");
    expect(payload.body).toContain("Bakery on 7th");
    expect(payload.body.toLowerCase()).toContain("whatsapp");
    expect(payload.url).toBe("/buyer/orders");
  });

  it("buyerOrderRejected names the provider", () => {
    const payload = pushEvents.buyerOrderRejected("Bakery on 7th");
    expect(payload.body).toContain("Bakery on 7th");
    expect(payload.url).toBe("/listings");
  });

  it("buyerPaymentConfirmed/OutForDelivery/Completed point at buyer orders", () => {
    expect(pushEvents.buyerPaymentConfirmed().url).toBe("/buyer/orders");
    expect(pushEvents.buyerOutForDelivery().url).toBe("/buyer/orders");
    expect(pushEvents.buyerCompleted().url).toBe("/buyer/orders");
  });

  it("driverNewAssignment formats the distance to one decimal", () => {
    const numeric = pushEvents.driverNewAssignment("Berea", 3.14159);
    expect(numeric.body).toContain("Berea");
    expect(numeric.body).toContain("3.1 km");

    const stringed = pushEvents.driverNewAssignment("Glenwood", "4.2");
    expect(stringed.body).toContain("4.2 km");
  });
});

describe("orderRef", () => {
  it("returns the first 8 chars uppercase", () => {
    expect(orderRef("60000000-0000-4000-8000-000000000100")).toBe("60000000");
    expect(orderRef("abcdef12-0000-4000-8000-000000000001")).toBe("ABCDEF12");
  });
});
