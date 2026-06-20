import { describe, expect, it } from "vitest";

import { isAuthPath, isProtectedPath, roleHomePath } from "@/lib/routes";

describe("route helpers", () => {
  it("maps roles to their default workspace", () => {
    expect(roleHomePath("buyer")).toBe("/buyer/orders");
    expect(roleHomePath("provider")).toBe("/provider/dashboard");
    expect(roleHomePath("driver")).toBe("/driver/status");
    expect(roleHomePath("admin")).toBe("/admin/dashboard");
  });

  it("detects protected app paths", () => {
    expect(isProtectedPath("/checkout/listing-1")).toBe(true);
    expect(isProtectedPath("/admin/dashboard")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/listings")).toBe(false);
    expect(isProtectedPath("/administrator")).toBe(false);
    expect(isProtectedPath("/provider-status")).toBe(false);
  });

  it("detects auth entry paths", () => {
    expect(isAuthPath("/auth/sign-in")).toBe(true);
    expect(isAuthPath("/auth/sign-in?next=/checkout/1")).toBe(false);
    expect(isAuthPath("/auth/register")).toBe(true);
    expect(isAuthPath("/auth/register/provider")).toBe(true);
    expect(isAuthPath("/auth/callback")).toBe(false);
    expect(isAuthPath("/auth/sign-invite")).toBe(false);
  });
});
