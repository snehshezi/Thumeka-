import { describe, expect, it } from "vitest";

import {
  AUTO_CLOSE_MISS_THRESHOLD,
  computeAcceptanceDeadline,
  computeDriverAssignDeadline,
  computeEftConfirmDeadline,
  computeResponseRatePct,
  formatRemaining,
  getAcceptanceWindowMinutes,
  getDriverAssignWindowMinutes,
  getEftConfirmWindowMinutes,
  SLA_DEFAULTS,
  urgencyOf
} from "@/lib/sla";

const REFERENCE = new Date("2026-06-10T10:00:00.000Z");

describe("SLA window helpers", () => {
  it("uses the admin_settings value when provided", () => {
    expect(
      getAcceptanceWindowMinutes({ provider_acceptance_window_minutes: 7 })
    ).toBe(7);
    expect(
      getEftConfirmWindowMinutes({ eft_confirm_window_minutes: 45 })
    ).toBe(45);
    expect(
      getDriverAssignWindowMinutes({ driver_assign_window_minutes: 90 })
    ).toBe(90);
  });

  it("falls back to defaults when settings missing or invalid", () => {
    expect(getAcceptanceWindowMinutes(null)).toBe(SLA_DEFAULTS.providerAcceptMinutes);
    expect(getEftConfirmWindowMinutes(undefined)).toBe(SLA_DEFAULTS.eftConfirmMinutes);
    expect(
      getDriverAssignWindowMinutes({
        // @ts-expect-error — verifies the runtime fallback on bad input
        driver_assign_window_minutes: "abc"
      })
    ).toBe(SLA_DEFAULTS.driverAssignMinutes);
  });

  it("accepts strings (as Supabase numeric columns sometimes return)", () => {
    expect(
      getAcceptanceWindowMinutes({
        // @ts-expect-error — runtime tolerance for numeric→string coercion
        provider_acceptance_window_minutes: "12"
      })
    ).toBe(12);
  });

  it("rejects zero / negative windows and falls back to defaults", () => {
    expect(
      getAcceptanceWindowMinutes({ provider_acceptance_window_minutes: 0 })
    ).toBe(SLA_DEFAULTS.providerAcceptMinutes);
    expect(
      getAcceptanceWindowMinutes({ provider_acceptance_window_minutes: -5 })
    ).toBe(SLA_DEFAULTS.providerAcceptMinutes);
  });
});

describe("deadline math", () => {
  it("adds the acceptance window to the created_at timestamp", () => {
    const deadline = computeAcceptanceDeadline(REFERENCE, {
      provider_acceptance_window_minutes: 5
    });
    expect(deadline.toISOString()).toBe("2026-06-10T10:05:00.000Z");
  });

  it("EFT-confirm deadline uses the eft_confirm window", () => {
    const deadline = computeEftConfirmDeadline(REFERENCE, {
      eft_confirm_window_minutes: 30
    });
    expect(deadline.toISOString()).toBe("2026-06-10T10:30:00.000Z");
  });

  it("driver-assign deadline uses the driver_assign window", () => {
    const deadline = computeDriverAssignDeadline(REFERENCE, {
      driver_assign_window_minutes: 60
    });
    expect(deadline.toISOString()).toBe("2026-06-10T11:00:00.000Z");
  });

  it("falls back to SLA_DEFAULTS when no settings supplied", () => {
    expect(computeAcceptanceDeadline(REFERENCE).toISOString()).toBe(
      "2026-06-10T10:05:00.000Z"
    );
    expect(computeEftConfirmDeadline(REFERENCE).toISOString()).toBe(
      "2026-06-10T10:30:00.000Z"
    );
    expect(computeDriverAssignDeadline(REFERENCE).toISOString()).toBe(
      "2026-06-10T11:00:00.000Z"
    );
  });

  it("accepts ISO strings and ms timestamps as well as Date", () => {
    expect(
      computeAcceptanceDeadline("2026-06-10T10:00:00.000Z").toISOString()
    ).toBe("2026-06-10T10:05:00.000Z");
    expect(
      computeAcceptanceDeadline(REFERENCE.getTime()).toISOString()
    ).toBe("2026-06-10T10:05:00.000Z");
  });
});

describe("response rate", () => {
  it("returns 100 for a fresh provider (no orders)", () => {
    expect(computeResponseRatePct({ accepted: 0, total: 0 })).toBe(100);
  });

  it("returns 100 when every order was accepted", () => {
    expect(computeResponseRatePct({ accepted: 5, total: 5 })).toBe(100);
  });

  it("returns 0 when every order expired", () => {
    expect(computeResponseRatePct({ accepted: 0, total: 4 })).toBe(0);
  });

  it("rounds to two decimal places", () => {
    expect(computeResponseRatePct({ accepted: 2, total: 3 })).toBe(66.67);
    expect(computeResponseRatePct({ accepted: 1, total: 3 })).toBe(33.33);
  });

  it("clamps out-of-range inputs", () => {
    expect(computeResponseRatePct({ accepted: -1, total: 4 })).toBe(0);
    expect(computeResponseRatePct({ accepted: 10, total: 4 })).toBe(100);
    expect(
      computeResponseRatePct({
        accepted: Number.NaN,
        total: Number.POSITIVE_INFINITY
      })
    ).toBe(100);
  });

  it("auto-close threshold is the documented constant", () => {
    expect(AUTO_CLOSE_MISS_THRESHOLD).toBe(3);
  });
});

describe("formatRemaining", () => {
  it("renders MM:SS with leading zeros", () => {
    expect(formatRemaining(72_000)).toBe("01:12");
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(5_000)).toBe("00:05");
    expect(formatRemaining(310_000)).toBe("05:10");
  });

  it("renders --:-- for negative or non-finite values", () => {
    expect(formatRemaining(-1)).toBe("--:--");
    expect(formatRemaining(Number.NaN)).toBe("--:--");
  });
});

describe("urgencyOf", () => {
  it("returns expired when remaining <= 0", () => {
    expect(urgencyOf(0, 5 * 60_000)).toBe("expired");
    expect(urgencyOf(-1, 5 * 60_000)).toBe("expired");
  });

  it("returns red in the last 30 seconds regardless of window size", () => {
    expect(urgencyOf(29_000, 60 * 60_000)).toBe("red");
  });

  it("returns red below 25% of the window", () => {
    expect(urgencyOf(60_000, 5 * 60_000)).toBe("red"); // 20%
  });

  it("returns amber between 25% and 50%", () => {
    expect(urgencyOf(2 * 60_000, 5 * 60_000)).toBe("amber"); // 40%
  });

  it("returns neutral above 50%", () => {
    expect(urgencyOf(4 * 60_000, 5 * 60_000)).toBe("neutral"); // 80%
  });

  it("returns neutral when window is unknown / infinite", () => {
    expect(urgencyOf(10 * 60_000, Number.POSITIVE_INFINITY)).toBe("neutral");
  });
});
