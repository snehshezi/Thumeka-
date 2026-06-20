/**
 * Runbook section 4 — Provider flows (PR-01..10).
 *
 * Uses the seeded "Thumeka Test Kitchen" (approved) provider plus the frozen
 * orders. PR-04 accepts the seeded `order_requested` order — every order
 * arrives priced from checkout in the new world, so accept just confirms.
 */

import { expect, test } from "@playwright/test";

import {
  forceSignOut,
  frozenOrderId,
  providerOrderCardBy,
  setupRunbookFixtures,
  signInAs,
  testUsers
} from "./_setup";

setupRunbookFixtures(test);

test.describe.serial("Section 4 — Provider flows", () => {
  test.beforeEach(async ({ page }) => {
    await forceSignOut(page).catch(() => undefined);
  });

  test("PR-01 — greeting + needs-action count + business name", async ({ page }) => {
    await signInAs(page, testUsers.provider, "page-provider-status");
    await page.getByTestId("provider-open-dashboard-link").click();
    await expect(page.getByTestId("page-provider-dashboard")).toBeVisible();
    await expect(page.getByText(/Good (morning|afternoon|evening)/i)).toBeVisible();
    await expect(page.getByText(/Thumeka Test Kitchen/i)).toBeVisible();
    // At least one frozen order is in `order_requested` → "X order needs you".
    await expect(page.getByTestId("provider-dashboard-greeting")).toContainText(
      /need/i
    );
  });

  test("PR-02 — Orders tab is the default and shows the three buckets", async ({ page }) => {
    await signInAs(page, testUsers.provider, "page-provider-status");
    await page.getByTestId("provider-open-dashboard-link").click();
    // The "Needs your action" bucket label
    await expect(page.getByText(/Needs your action/i)).toBeVisible();
    // The seeded order_requested card is in needs-action
    await expect(
      providerOrderCardBy(page, frozenOrderId("order_requested"))
    ).toBeVisible();
    // The completed card is in Completed bucket
    await expect(
      providerOrderCardBy(page, frozenOrderId("completed"))
    ).toBeVisible();
  });

  test("PR-03 — opening an order opens the drawer with full detail (mobile)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "mobile drawer behaviour");
    await signInAs(page, testUsers.provider, "page-provider-status");
    await page.getByTestId("provider-open-dashboard-link").click();
    await providerOrderCardBy(page, frozenOrderId("awaiting_buyer_eft")).click();
    const drawer = page.getByTestId("provider-order-drawer");
    await expect(drawer).toBeVisible();
    // The Buyer / Delivery / Earnings section headings render.
    await expect(drawer.getByRole("heading", { name: "Buyer", exact: true })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Delivery", exact: true })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Earnings", exact: true })).toBeVisible();
    // Close button is scoped inside the drawer (the bottom-nav sheet shares
    // the same testid).
    await drawer.getByTestId("drawer-close-button").click();
  });

  test("PR-04 — accepting the seeded order_requested confirms the locked checkout price", async ({ page }) => {
    await signInAs(page, testUsers.provider, "page-provider-status");
    await page.getByTestId("provider-open-dashboard-link").click();
    const card = providerOrderCardBy(page, frozenOrderId("order_requested"));
    await expect(card).toContainText("Order Requested");
    await card.click();

    const drawer = page.getByTestId("provider-order-drawer");
    await expect(drawer).toBeVisible();
    // No manual distance input — orders arrive priced from checkout.
    await expect(
      drawer.getByTestId("provider-order-distance-input")
    ).toHaveCount(0);
    await Promise.all([
      page.waitForURL(/\/provider\/dashboard\?accepted=/),
      drawer.getByTestId("provider-order-accept-button").click()
    ]);
    await expect(page.getByTestId("provider-order-accepted-message")).toBeVisible();
  });

  test("PR-05 — already-accepted order does not show the accept form", async ({ page }) => {
    await signInAs(page, testUsers.provider, "page-provider-status");
    await page.getByTestId("provider-open-dashboard-link").click();
    // Click the awaiting_buyer_eft order (already past needs-action).
    await providerOrderCardBy(page, frozenOrderId("awaiting_buyer_eft")).click();
    const drawer = page.getByTestId("provider-order-drawer");
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByTestId("provider-order-accept-form")
    ).toHaveCount(0);
  });

  test("PR-06 — Switching to Listings tab updates the URL and renders the form panel", async ({ page }) => {
    await signInAs(page, testUsers.provider, "page-provider-status");
    await page.getByTestId("provider-open-dashboard-link").click();
    await page.getByTestId("tab-listings").click();
    await page.waitForURL(/tab=listings/);
    await expect(page.getByTestId("provider-create-listing-toggle")).toBeVisible();
    await expect(page.getByTestId("provider-listings-panel")).toBeVisible();
    // The orders board (drawer trigger cards) is not rendered on this tab.
    await expect(page.getByTestId("provider-order-card")).toHaveCount(0);
  });

  test("PR-07 — Creating a listing redirects with listing_created and shows the new card", async ({ page }) => {
    await signInAs(page, testUsers.provider, "page-provider-status");
    await page.getByTestId("provider-open-dashboard-link").click();
    await page.getByTestId("tab-listings").click();
    await page.getByTestId("provider-create-listing-toggle").click();

    const title = `Runbook listing ${Date.now()}`;
    await page.getByTestId("provider-listing-title-input").fill(title);
    await page.getByTestId("provider-listing-description-input").fill("A runbook-created listing.");
    await page.getByTestId("provider-listing-category-select").selectOption({ label: "Food" });
    await page.getByTestId("provider-listing-type-select").selectOption("product");
    await page.getByTestId("provider-listing-price-input").fill("150");
    await page.getByTestId("provider-listing-suburb-input").fill("Berea");
    await page
      .getByTestId("provider-listing-fulfillment-address-input")
      .fill("1 Runbook Road, Berea");
    await Promise.all([
      // Redirect now keeps the Listings tab — assert the substring without
      // anchoring on the leading `?` so future query-param shuffles don't
      // break this.
      page.waitForURL(/listing_created=/),
      page.getByTestId("provider-create-listing-button").click()
    ]);
    await expect(page.getByTestId("provider-listing-created-message")).toBeVisible();
    // The new listing appears in the recent listings list (Listings tab).
    const newCard = page
      .getByTestId("provider-listing-card")
      .filter({ hasText: title })
      .first();
    await expect(newCard).toBeVisible();
    // No image was uploaded — the card should render the mint placeholder.
    await expect(
      newCard.getByTestId("provider-listing-image-placeholder")
    ).toBeVisible();
  });

  test("PR-09 — Listing with an uploaded cover image renders the photo on provider + public surfaces", async ({ page }) => {
    await signInAs(page, testUsers.provider, "page-provider-status");
    await page.getByTestId("provider-open-dashboard-link").click();
    await page.getByTestId("tab-listings").click();
    await page.getByTestId("provider-create-listing-toggle").click();

    const title = `Runbook image listing ${Date.now()}`;
    // Real 1×1 transparent PNG so Supabase Storage accepts it regardless of
    // whether it sniffs bytes or trusts contentType. About 67 bytes.
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      "base64"
    );
    await page
      .getByTestId("listing-image-upload-file-input")
      .setInputFiles({
        name: "cover.png",
        mimeType: "image/png",
        buffer: pngBuffer
      });
    // Wait for Storage round-trip to resolve and the preview to show.
    await expect(page.getByTestId("listing-image-upload-status")).toHaveAttribute(
      "data-status",
      "uploaded",
      { timeout: 15000 }
    );
    await expect(page.getByTestId("listing-image-upload-preview")).toBeVisible();

    await page.getByTestId("provider-listing-title-input").fill(title);
    await page
      .getByTestId("provider-listing-description-input")
      .fill("Runbook listing with a cover image.");
    await page
      .getByTestId("provider-listing-category-select")
      .selectOption({ label: "Food" });
    await page.getByTestId("provider-listing-type-select").selectOption("product");
    await page.getByTestId("provider-listing-price-input").fill("175");
    await page.getByTestId("provider-listing-suburb-input").fill("Berea");
    await page
      .getByTestId("provider-listing-fulfillment-address-input")
      .fill("2 Runbook Road, Berea");
    await Promise.all([
      page.waitForURL(/listing_created=/),
      page.getByTestId("provider-create-listing-button").click()
    ]);

    // Provider-side: the new card shows the real photo, not the placeholder.
    const newCard = page
      .getByTestId("provider-listing-card")
      .filter({ hasText: title })
      .first();
    await expect(newCard).toBeVisible();
    await expect(
      newCard.getByTestId("provider-listing-image-photo")
    ).toBeVisible();
    await expect(
      newCard.getByTestId("provider-listing-image-placeholder")
    ).toHaveCount(0);

    // Public marketplace: same listing has a photo when viewed unauth.
    await page.goto("/auth/sign-out");
    await page.goto("/listings");
    const publicCard = page
      .getByTestId("listing-card")
      .filter({ hasText: title })
      .first();
    await expect(publicCard).toBeVisible();
    await expect(publicCard.getByTestId("listing-image-photo")).toBeVisible();
  });

  test("PR-08 — Pending provider hits the approval gate", async ({ page }) => {
    await signInAs(page, testUsers.pendingProvider, "page-provider-status");
    await page.goto("/provider/dashboard");
    await expect(
      page.getByTestId("page-provider-dashboard-approval-required")
    ).toBeVisible();
  });
});
