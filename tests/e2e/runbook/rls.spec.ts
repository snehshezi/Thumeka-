/**
 * Runbook section 10 — RLS / authorisation spot checks.
 *
 * The point is to prove that other tenants' data is invisible.
 */

import { expect, test } from "@playwright/test";

import {
  forceSignOut,
  setupRunbookFixtures,
  signInAs,
  testUsers
} from "./_setup";

setupRunbookFixtures(test);

test.describe.serial("Section 10 — RLS / authorisation", () => {
  test.beforeEach(async ({ page }) => {
    await forceSignOut(page).catch(() => undefined);
  });

  test("RLS-01 — buyer only sees their own orders", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    // 4 frozen + 1 base = 5 orders for buyer; none of otherBuyer's.
    await expect(page.getByTestId("buyer-order-card")).toHaveCount(5);
    // Switch to otherBuyer — different count.
    await forceSignOut(page);
    await signInAs(page, testUsers.otherBuyer, "page-buyer-orders");
    // 3 frozen + 1 base = 4 orders for otherBuyer.
    await expect(page.getByTestId("buyer-order-card")).toHaveCount(4);
  });

  test("RLS-05 — pending-provider listings hidden from the public marketplace", async ({ page }) => {
    await page.goto("/listings");
    // The seeded "Pending provider errand" comes from the pending provider and
    // must not appear in /listings.
    await expect(page.getByText("Pending provider errand")).toHaveCount(0);
  });

  test("RLS-06 — admin_disabled listings hidden from the public marketplace", async ({ page }) => {
    await page.goto("/listings");
    await expect(page.getByText("Disabled test plate")).toHaveCount(0);
  });
});
