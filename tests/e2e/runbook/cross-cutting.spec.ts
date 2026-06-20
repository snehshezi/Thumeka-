/**
 * Runbook section 8 — Cross-cutting checks.
 *
 * Header / footer presence, bottom-nav visibility per viewport, status-pill
 * icons, and the role-aware redirect guards.
 */

import { expect, test } from "@playwright/test";

import {
  forceSignOut,
  setupRunbookFixtures,
  signInAs,
  testUsers
} from "./_setup";

setupRunbookFixtures(test);

test.describe.serial("Section 8 — Cross-cutting", () => {
  test.beforeEach(async ({ page }) => {
    await forceSignOut(page).catch(() => undefined);
  });

  test("Header and footer render on every public page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("site-header")).toBeVisible();
    await expect(page.getByTestId("site-footer")).toBeVisible();
    await page.goto("/listings");
    await expect(page.getByTestId("site-header")).toBeVisible();
    await expect(page.getByTestId("site-footer")).toBeVisible();
  });

  test("Bottom nav only renders when signed in (mobile project only)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "mobile-only nav");
    // Unauthenticated: no bottom nav.
    await page.goto("/");
    await expect(page.getByTestId("bottom-nav")).toHaveCount(0);
    // After sign-in: bottom nav visible.
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    await expect(page.getByTestId("bottom-nav")).toBeVisible();
    await expect(page.getByTestId("bottom-nav-home")).toBeVisible();
    await expect(page.getByTestId("bottom-nav-browse")).toBeVisible();
    await expect(page.getByTestId("bottom-nav-dashboard")).toBeVisible();
    await expect(page.getByTestId("bottom-nav-account")).toBeVisible();
  });

  test("Every status pill renders with an icon (svg) in the buyer dashboard", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    const pills = page.getByTestId("status-pill");
    const count = await pills.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(pills.nth(i).locator("svg")).toBeVisible();
    }
  });

  test("Buyer trying to open /admin/dashboard lands on buyer orders", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    await page.goto("/admin/dashboard");
    await page.waitForURL(/\/buyer\/orders/);
    await expect(page.getByTestId("page-buyer-orders")).toBeVisible();
  });

  test("Driver trying to open /provider/dashboard lands on driver home", async ({ page }) => {
    await signInAs(page, testUsers.driver, "page-driver-status");
    await page.goto("/provider/dashboard");
    // requireRole redirects non-providers to their role home.
    await page.waitForURL(/\/(driver\/|dashboard)/);
    expect(page.url()).not.toContain("/provider/dashboard");
  });

  test("Unauthenticated dashboard redirects to sign-in", async ({ page }) => {
    await page.goto("/buyer/orders");
    await page.waitForURL(/\/auth\/sign-in/);
    await expect(page.getByTestId("page-sign-in")).toBeVisible();
  });
});
