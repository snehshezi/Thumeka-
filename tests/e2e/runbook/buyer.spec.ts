/**
 * Runbook section 3 — Buyer flows (BU-01..12).
 *
 * Uses the seeded frozen orders so we can act on every state without driving
 * an order from scratch first.
 */

import { expect, test } from "@playwright/test";

import {
  buyerOrderCardBy,
  forceSignOut,
  frozenOrderId,
  setupRunbookFixtures,
  signInAs,
  testUsers
} from "./_setup";

setupRunbookFixtures(test);

test.describe.serial("Section 3 — Buyer flows", () => {
  test.beforeEach(async ({ page }) => {
    await forceSignOut(page).catch(() => undefined);
  });

  test("BU-01 — greeting + active order count render", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    // Greeting runs server-side; we assert the heading renders one of the
    // three time-of-day variants and includes the active-orders count line.
    await expect(page.getByText(/Good (morning|afternoon|evening)/i)).toBeVisible();
    const greeting = page.getByTestId("buyer-orders-greeting");
    await expect(greeting).toBeVisible();
    await expect(greeting).toContainText(/active order/i);
  });

  test("BU-02 — All filter shows every buyer order with iconed status pills", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    // 4 frozen orders + 1 base seed order owned by buyer = 5.
    await expect(page.getByTestId("buyer-order-card")).toHaveCount(5);
    // Each card's StatusPill contains an icon (svg).
    const pills = page.getByTestId("status-pill");
    await expect(pills.first()).toBeVisible();
    await expect(pills.first().locator("svg")).toBeVisible();
  });

  test("BU-03 — Active filter narrows to non-closed orders", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    await page.getByTestId("tab-active").click();
    await page.waitForURL(/status=active/);
    // The buyer's `completed` frozen order is the only closed one → 4 active remain.
    await expect(page.getByTestId("buyer-order-card")).toHaveCount(4);
  });

  test("BU-04 — Closed filter shows the completed order", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    await page.getByTestId("tab-closed").click();
    await page.waitForURL(/status=closed/);
    await expect(page.getByTestId("buyer-order-card")).toHaveCount(1);
    await expect(
      page.getByTestId("buyer-order-card").first().getByTestId("status-pill")
    ).toContainText(/Completed/i);
  });

  test("BU-05 — EFT instructions visible on awaiting_buyer_eft", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    const card = buyerOrderCardBy(page, frozenOrderId("awaiting_buyer_eft"));
    await expect(card).toBeVisible();
    await expect(card.getByTestId("buyer-order-eft-instructions")).toBeVisible();
  });

  test("BU-06 — EFT instructions HIDDEN on order_requested", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    const card = buyerOrderCardBy(page, frozenOrderId("order_requested"));
    await expect(card).toBeVisible();
    await expect(card.getByTestId("buyer-order-eft-instructions")).toHaveCount(0);
  });

  test("BU-07 — full successful checkout produces a priced order", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    await page.goto("/listings");
    await page
      .getByTestId("listing-card")
      .filter({ hasText: "Sunday roast tray" })
      .first()
      .click();
    await page.waitForURL(/\/listings\//);
    await page.getByTestId("listing-request-order-link").click();
    await page.waitForURL(/\/checkout\//);
    await expect(page.getByTestId("page-checkout")).toBeVisible();

    await page.getByTestId("checkout-suburb-input").fill("Berea");
    await page.getByTestId("checkout-delivery-address-input").fill("12 Test Lane, Berea");

    // Calculate the delivery quote (DELIVERY_FALLBACK_KM=4 in test env).
    await page.getByTestId("checkout-calculate-delivery-button").click();
    await expect(page.getByTestId("checkout-delivery-fee")).toBeVisible();
    await expect(page.getByTestId("checkout-order-total")).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/buyer\/orders\?created=/),
      page.getByTestId("checkout-submit-button").click()
    ]);
    await expect(page.getByText(/Order request created/i)).toBeVisible();
  });

  test("BU-08 — submit blocked when address changes after quoting", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    await page.goto("/listings");
    await page.getByText("Sunday roast tray").first().click();
    await page.getByTestId("listing-request-order-link").click();

    await page.getByTestId("checkout-suburb-input").fill("Berea");
    await page.getByTestId("checkout-delivery-address-input").fill("Initial address");
    await page.getByTestId("checkout-calculate-delivery-button").click();
    await expect(page.getByTestId("checkout-order-total")).toBeVisible();

    // Editing the address invalidates the quote.
    await page.getByTestId("checkout-delivery-address-input").fill("Changed address");
    await expect(page.getByTestId("checkout-submit-button")).toBeDisabled();
  });

  test("BU-10 — opening checkout for a disabled listing shows unavailable message", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    // testListings[1] is the disabled lunch plate.
    await page.goto("/checkout/50000000-0000-4000-8000-000000000002");
    await expect(page.getByText(/no longer available/i)).toBeVisible();
    // The checkout form should not render.
    await expect(page.getByTestId("checkout-form")).toHaveCount(0);
  });

  test("BU-11 — bottom-nav Browse navigates to listings (mobile only)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "mobile-only nav");
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    await expect(page.getByTestId("bottom-nav")).toBeVisible();
    await page.getByTestId("bottom-nav-browse").click();
    await page.waitForURL(/\/listings/);
    await expect(page.getByTestId("page-listings")).toBeVisible();
  });

  test("BU-12 — Account sheet shows email + signs out (mobile only)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "mobile-only nav");
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    await page.getByTestId("bottom-nav-account").click();
    const sheet = page.getByTestId("bottom-nav-account-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(testUsers.buyer.email);
    await expect(sheet).toContainText(/Buyer account/i);
    await Promise.all([
      page.waitForURL(/\/auth\/sign-in/),
      page.getByTestId("bottom-nav-sign-out-button").click()
    ]);
    await expect(page.getByTestId("page-sign-in")).toBeVisible();
  });
});
