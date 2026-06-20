/**
 * Runbook section 1 — Public surfaces (PU-01..06).
 *
 * Unauthenticated browsing: homepage, listings, listing detail, support.
 */

import { expect, test } from "@playwright/test";

import { forceSignOut, setupRunbookFixtures } from "./_setup";

setupRunbookFixtures(test);

test.describe.serial("Section 1 — Public surfaces", () => {
  test.beforeEach(async ({ page }) => {
    // Make sure we land truly unauthenticated even if a prior test signed in.
    await forceSignOut(page).catch(() => {
      /* not signed in is fine */
    });
  });

  test("PU-01 + PU-02 — homepage hero, dual CTAs, and Browse navigates", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("page-home")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Durban, delivered\./i })).toBeVisible();
    await expect(page.getByTestId("home-cta-group")).toBeVisible();
    // 6 category tiles, one "see all", three "how" cards, final CTAs
    await expect(page.getByTestId("home-category-link")).toHaveCount(6);
    await expect(page.getByTestId("home-how-buy")).toBeVisible();
    await expect(page.getByTestId("home-how-sell")).toBeVisible();
    await expect(page.getByTestId("home-how-drive")).toBeVisible();
    // Footer must render
    await expect(page.getByTestId("site-footer")).toBeVisible();

    // PU-02 — Browse CTA navigates to /listings
    await page.getByTestId("home-browse-link").click();
    await page.waitForURL("**/listings");
    await expect(page.getByTestId("page-listings")).toBeVisible();
  });

  test("PU-03 — /listings shows approved listings only", async ({ page }) => {
    await page.goto("/listings");
    await expect(page.getByTestId("page-listings")).toBeVisible();
    await expect(page.getByTestId("listings-heading")).toContainText(
      /Browse the marketplace/i
    );

    const cards = page.getByTestId("listing-card");
    await expect(cards.first()).toBeVisible();
    // Active seeded listings
    await expect(page.getByText("Durban lunch plate")).toBeVisible();
    await expect(page.getByText("Sunday roast tray")).toBeVisible();
    await expect(page.getByText("Office lunch platter")).toBeVisible();
    // Hidden / pending-provider listings must not appear
    await expect(page.getByText("Disabled test plate")).toHaveCount(0);
    await expect(page.getByText("Pending provider errand")).toHaveCount(0);
  });

  test("PU-04 — opening a listing shows detail + Request order CTA", async ({ page }) => {
    await page.goto("/listings");
    await page.getByText("Durban lunch plate").first().click();
    await expect(page.getByTestId("listing-detail-card")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Durban lunch plate/i })).toBeVisible();
    await expect(page.getByTestId("listing-request-order-link")).toBeVisible();
  });

  test("PU-05 — Request order while signed-out bounces to sign-in with next param", async ({ page }) => {
    await page.goto("/listings");
    await page.getByText("Durban lunch plate").first().click();
    await page.getByTestId("listing-request-order-link").click();
    await page.waitForURL(/\/auth\/sign-in/);
    await expect(page).toHaveURL(/next=/);
    await expect(page.getByTestId("page-sign-in")).toBeVisible();
  });

  test("PU-06 — Support page renders", async ({ page }) => {
    await page.goto("/support");
    await expect(page.getByRole("heading", { name: /Support/i })).toBeVisible();
  });
});
