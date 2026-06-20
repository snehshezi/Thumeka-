import { describe, expect, it } from "vitest";

import { haversineKm } from "@/lib/geo";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    const point = { lat: -29.8587, lng: 31.0218 };
    expect(haversineKm(point, point)).toBe(0);
  });

  it("computes a known Durban distance within tolerance", () => {
    // Durban CBD → Umhlanga is roughly 16 km straight-line.
    const durbanCbd = { lat: -29.8587, lng: 31.0218 };
    const umhlanga = { lat: -29.7264, lng: 31.0843 };
    const distance = haversineKm(durbanCbd, umhlanga);
    expect(distance).toBeGreaterThan(14);
    expect(distance).toBeLessThan(18);
  });

  it("is symmetric", () => {
    const a = { lat: -29.85, lng: 31.02 };
    const b = { lat: -29.9, lng: 30.98 };
    expect(haversineKm(a, b)).toBe(haversineKm(b, a));
  });

  it("rounds to two decimal places", () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 0, lng: 1 };
    const distance = haversineKm(a, b);
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBe(Math.round(distance * 100) / 100);
  });
});
