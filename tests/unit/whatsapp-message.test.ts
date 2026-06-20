import { describe, expect, it } from "vitest";

import {
  buildBugReportMessage,
  buildPaymentProofMessage,
  buildUrgentOrderHelpMessage
} from "@/lib/whatsapp-message";

// Intl's ZA currency formatter separates "R" from the amount with a
// non-breaking space; use an explicit constant so assertions are unambiguous.
const NBSP = " ";

describe("buildPaymentProofMessage", () => {
  it("formats a stable pre-fill with ref, total, and buyer name", () => {
    const message = buildPaymentProofMessage({
      id: "60000000-0000-4000-8000-000000000100",
      buyer_name: "Andile",
      buyer_total: 320
    });

    expect(message).toBe(
      `Hi Thumeka, here is my proof of payment for order #60000000 (R${NBSP}320,00). — Andile`
    );
  });

  it("trims the order id to its first 8 chars and upper-cases", () => {
    const message = buildPaymentProofMessage({
      id: "abcdef12-0000-4000-8000-000000000001",
      buyer_name: "Sipho",
      buyer_total: 100
    });

    expect(message).toContain("#ABCDEF12");
  });

  it("drops the trailing name suffix when buyer_name is null or empty", () => {
    const blank = buildPaymentProofMessage({
      id: "00000000-0000-4000-8000-000000000001",
      buyer_name: null,
      buyer_total: 50
    });
    const empty = buildPaymentProofMessage({
      id: "00000000-0000-4000-8000-000000000002",
      buyer_name: "   ",
      buyer_total: 50
    });

    expect(blank.endsWith(").")).toBe(true);
    expect(empty.endsWith(").")).toBe(true);
  });

  it("accepts a string buyer_total (Supabase numeric column shape)", () => {
    const message = buildPaymentProofMessage({
      id: "00000000-0000-4000-8000-000000000003",
      buyer_name: "Lerato",
      buyer_total: "445.50"
    });

    expect(message).toContain(`R${NBSP}445,50`);
  });
});

describe("buildBugReportMessage", () => {
  it("produces the expected labelled template", () => {
    const message = buildBugReportMessage();
    expect(message).toContain("I'd like to report a bug");
    expect(message).toContain("What I was doing:");
    expect(message).toContain("What went wrong:");
    expect(message).toContain("Device / browser:");
  });
});

describe("buildUrgentOrderHelpMessage", () => {
  it("includes the order ref when one is provided", () => {
    const message = buildUrgentOrderHelpMessage(
      "abcdef12-0000-4000-8000-000000000001"
    );
    expect(message).toContain("Order ref: #ABCDEF12");
    expect(message).toContain("Issue:");
  });

  it("renders an empty ref when no order id is provided", () => {
    const message = buildUrgentOrderHelpMessage();
    expect(message).toContain("Order ref: ");
    expect(message).toContain("Issue:");
  });
});
