import { describe, expect, it } from "vitest";

import { getOrderUrgency } from "@/lib/urgency";

const NOW = new Date("2026-06-03T12:00:00Z");

function isoMinutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

describe("getOrderUrgency", () => {
  it("returns normal for orders under 10 minutes old", () => {
    const u = getOrderUrgency(isoMinutesAgo(5), NOW);
    expect(u.level).toBe("normal");
    expect(u.label).toBe("5m");
    expect(u.ariaLabel).toBe("Waiting 5m");
  });

  it("escalates to warning between 10 and 30 minutes", () => {
    expect(getOrderUrgency(isoMinutesAgo(10), NOW).level).toBe("warning");
    expect(getOrderUrgency(isoMinutesAgo(20), NOW).level).toBe("warning");
    expect(getOrderUrgency(isoMinutesAgo(29), NOW).level).toBe("warning");
  });

  it("escalates to high between 30 minutes and 2 hours", () => {
    expect(getOrderUrgency(isoMinutesAgo(30), NOW).level).toBe("high");
    expect(getOrderUrgency(isoMinutesAgo(60), NOW).level).toBe("high");
    expect(getOrderUrgency(isoMinutesAgo(119), NOW).level).toBe("high");
  });

  it("escalates to critical after 2 hours", () => {
    expect(getOrderUrgency(isoMinutesAgo(120), NOW).level).toBe("critical");
    expect(getOrderUrgency(isoMinutesAgo(60 * 24), NOW).level).toBe("critical");
  });

  it("defends against invalid timestamps", () => {
    const u = getOrderUrgency("not-a-date", NOW);
    expect(u.level).toBe("normal");
    expect(u.label).toBe("—");
  });
});
