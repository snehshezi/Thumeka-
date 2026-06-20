/**
 * Runbook section 5 — Driver flows (DR-01..09).
 *
 * Uses the seeded `driver_assigned` / `picked_up` / `out_for_delivery` frozen
 * orders so we can walk the entire progression in one spec.
 */

import { expect, test } from "@playwright/test";

import {
  forceSignOut,
  frozenOrderId,
  setupRunbookFixtures,
  signInAs,
  testUsers
} from "./_setup";

setupRunbookFixtures(test);

test.describe.serial("Section 5 — Driver flows", () => {
  test.beforeEach(async ({ page }) => {
    await forceSignOut(page).catch(() => undefined);
  });

  test("DR-01 — greeting with today's earnings", async ({ page }) => {
    await signInAs(page, testUsers.driver, "page-driver-status");
    await page.getByTestId("driver-open-dashboard-link").click();
    await expect(page.getByTestId("page-driver-dashboard")).toBeVisible();
    await expect(page.getByText(/Good (morning|afternoon|evening)/i)).toBeVisible();
    await expect(page.getByTestId("driver-dashboard-greeting")).toContainText(
      /earned today/i
    );
  });

  test("DR-02 — availability card is present and labelled", async ({ page }) => {
    await signInAs(page, testUsers.driver, "page-driver-status");
    await page.getByTestId("driver-open-dashboard-link").click();
    await expect(page.getByTestId("driver-availability-card")).toBeVisible();
    // The seeded driver starts as available so the "Go available" button is disabled.
    await expect(page.getByTestId("driver-set-available-button")).toBeDisabled();
    await expect(page.getByTestId("driver-set-unavailable-button")).toBeEnabled();
  });

  test("DR-03 — deliveries list contains every assigned-driver seeded order", async ({ page }) => {
    await signInAs(page, testUsers.driver, "page-driver-status");
    await page.getByTestId("driver-open-dashboard-link").click();
    // Four orders end up assigned to this driver during seed: driver_assigned,
    // picked_up, out_for_delivery and completed.
    const cards = page.getByTestId("driver-delivery-card");
    await expect(cards).toHaveCount(4);
    await expect(cards.filter({ hasText: frozenOrderId("driver_assigned").slice(0, 8) })).toHaveCount(1);
    await expect(cards.filter({ hasText: frozenOrderId("picked_up").slice(0, 8) })).toHaveCount(1);
    await expect(cards.filter({ hasText: frozenOrderId("out_for_delivery").slice(0, 8) })).toHaveCount(1);
    await expect(cards.filter({ hasText: frozenOrderId("completed").slice(0, 8) })).toHaveCount(1);
  });

  test("DR-04 — Mark picked up on the driver_assigned order", async ({ page }) => {
    await signInAs(page, testUsers.driver, "page-driver-status");
    await page.getByTestId("driver-open-dashboard-link").click();
    const card = page
      .getByTestId("driver-delivery-card")
      .filter({ hasText: frozenOrderId("driver_assigned").slice(0, 8) })
      .first();
    await Promise.all([
      page.waitForURL(/\?delivery_updated=/),
      card.getByTestId("driver-mark-picked-up-button").click()
    ]);
    await expect(page.getByTestId("driver-delivery-updated-message")).toBeVisible();
  });

  test("DR-05 — Mark out for delivery on the picked_up order", async ({ page }) => {
    await signInAs(page, testUsers.driver, "page-driver-status");
    await page.getByTestId("driver-open-dashboard-link").click();
    const card = page
      .getByTestId("driver-delivery-card")
      .filter({ hasText: frozenOrderId("picked_up").slice(0, 8) })
      .first();
    await Promise.all([
      page.waitForURL(/\?delivery_updated=/),
      card.getByTestId("driver-mark-out-for-delivery-button").click()
    ]);
    await expect(page.getByTestId("driver-delivery-updated-message")).toBeVisible();
  });

  test("DR-06 — Complete delivery on the out_for_delivery order", async ({ page }) => {
    await signInAs(page, testUsers.driver, "page-driver-status");
    await page.getByTestId("driver-open-dashboard-link").click();
    const card = page
      .getByTestId("driver-delivery-card")
      .filter({ hasText: frozenOrderId("out_for_delivery").slice(0, 8) })
      .first();
    await Promise.all([
      page.waitForURL(/\?delivery_updated=/),
      card.getByTestId("driver-complete-delivery-button").click()
    ]);
    await expect(page.getByTestId("driver-delivery-updated-message")).toBeVisible();
  });

  // DR-08 is covered manually — there's no seeded "pending driver with role=driver"
  // user, and the seeded pending driver_profile attaches to a user whose role is
  // provider (so the role-gate fires before the approval-gate). The existing
  // end-to-end flow in product-delivery-flow.spec.ts exercises the approval gate
  // from a fresh registration. The manual runbook still covers this scenario.
  test.skip("DR-08 — pending driver approval gate (manual)", () => {});

  test("DR-09 — Earnings panel renders pending + last-paid cards", async ({ page }) => {
    await signInAs(page, testUsers.driver, "page-driver-status");
    await page.getByTestId("driver-open-dashboard-link").click();
    const earnings = page.getByTestId("driver-earnings-panel");
    await expect(earnings).toBeVisible();
    await expect(
      earnings.getByTestId("driver-earnings-pending-card")
    ).toBeVisible();
    await expect(
      earnings.getByTestId("driver-earnings-last-paid-card")
    ).toBeVisible();
  });
});
