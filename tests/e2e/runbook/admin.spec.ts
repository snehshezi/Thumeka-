/**
 * Runbook section 6 — Admin flows (AD-01..13).
 *
 * Tab-aware: AD-04..06 are in the default Approvals tab; AD-07 switches and
 * AD-08..12 act on Operations; AD-13 checks Settings.
 */

import { expect, test } from "@playwright/test";

import {
  adminOrderCardBy,
  forceSignOut,
  frozenOrderId,
  setupRunbookFixtures,
  signInAs,
  testUsers
} from "./_setup";

setupRunbookFixtures(test);

test.describe.serial("Section 6 — Admin flows", () => {
  test.beforeEach(async ({ page }) => {
    await forceSignOut(page).catch(() => undefined);
  });

  test("AD-01 — greeting summarises pending approvals and open orders", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    await expect(page.getByText(/Good (morning|afternoon|evening), admin/i)).toBeVisible();
    await expect(page.getByTestId("admin-dashboard-greeting")).toContainText(
      /pending/i
    );
  });

  test("AD-02 — stat strip renders the 5 cards (visible on every viewport)", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    const strip = page.getByTestId("admin-stat-strip");
    await expect(strip).toBeVisible();
    await expect(page.getByTestId("admin-pending-providers-card")).toBeVisible();
    await expect(page.getByTestId("admin-pending-drivers-card")).toBeVisible();
    await expect(page.getByTestId("admin-open-orders-card")).toBeVisible();
    await expect(page.getByTestId("admin-transactions-card")).toBeVisible();
    await expect(page.getByTestId("admin-audit-logs-card")).toBeVisible();
  });

  test("AD-03 — Approvals tab is the default and lists seeded pending records", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    await expect(page.getByTestId("admin-provider-approvals-panel")).toBeVisible();
    await expect(page.getByTestId("admin-driver-approvals-panel")).toBeVisible();
    // At least one pending provider card (seeded `pendingProvider`).
    await expect(page.getByTestId("admin-provider-approval-card").first()).toBeVisible();
    // At least one pending driver card (seeded pending driver).
    await expect(page.getByTestId("admin-driver-approval-card").first()).toBeVisible();
  });

  test("AD-04 — approving the seeded pending provider shows the banner", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    await Promise.all([
      page.waitForURL(/\/admin\/dashboard\?provider_approved=/),
      page
        .getByTestId("admin-provider-approval-card")
        .first()
        .getByTestId("admin-approve-provider-button")
        .click()
    ]);
    await expect(page.getByTestId("admin-provider-approved-message")).toBeVisible();
  });

  test("AD-06 — approving the seeded pending driver shows the banner", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    await Promise.all([
      page.waitForURL(/\/admin\/dashboard\?driver_approved=/),
      page
        .getByTestId("admin-driver-approval-card")
        .first()
        .getByTestId("admin-approve-driver-button")
        .click()
    ]);
    await expect(page.getByTestId("admin-driver-approved-message")).toBeVisible();
  });

  test("AD-07 — Operations tab switches via URL", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    await page.getByTestId("tab-operations").click();
    await page.waitForURL(/tab=operations/);
    await expect(page.getByTestId("admin-operational-orders-panel")).toBeVisible();
    // Approvals are hidden on this tab.
    await expect(page.getByTestId("admin-provider-approvals-panel")).toHaveCount(0);
  });

  test("AD-08 — Confirm EFT on the awaiting_buyer_eft frozen order", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    await page.goto("/admin/dashboard?tab=operations");
    const card = adminOrderCardBy(page, frozenOrderId("awaiting_buyer_eft"));
    await expect(card).toBeVisible();
    await card
      .getByTestId("admin-payment-reference-input")
      .fill("RUNBOOK-EFT-001");
    await Promise.all([
      page.waitForURL(/\?eft_confirmed=/),
      card.getByTestId("admin-confirm-eft-button").click()
    ]);
    await expect(page.getByTestId("admin-eft-confirmed-message")).toBeVisible();
  });

  test("AD-10 — Assign driver on a payment_confirmed order", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    await page.goto("/admin/dashboard?tab=operations");
    const card = adminOrderCardBy(page, frozenOrderId("payment_confirmed"));
    await expect(card).toBeVisible();
    // Pick the first non-empty option (the seeded available driver).
    const select = card.getByTestId("admin-assign-driver-select");
    const options = await select.locator("option").allTextContents();
    const realOption = options.find((label) => !/select driver/i.test(label));
    expect(realOption).toBeTruthy();
    await select.selectOption({ label: realOption! });
    await Promise.all([
      page.waitForURL(/\?driver_assigned=/),
      card.getByTestId("admin-assign-driver-button").click()
    ]);
    await expect(page.getByTestId("admin-driver-assigned-message")).toBeVisible();
  });

  test("AD-11 — Create payout on the completed frozen order", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    await page.goto("/admin/dashboard?tab=operations");
    const payout = page
      .getByTestId("admin-payout-card")
      .filter({ hasText: frozenOrderId("completed").slice(0, 8) })
      .first();
    await expect(payout).toBeVisible();
    await Promise.all([
      page.waitForURL(/\?payout_created=/),
      payout.getByTestId("admin-create-payout-button").click()
    ]);
    await expect(page.getByTestId("admin-payout-created-message")).toBeVisible();
  });

  test("AD-12 — Duplicate payout is blocked", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    await page.goto("/admin/dashboard?tab=operations");
    // The previous test already created a payout for the completed order.
    // The card should no longer be in the payout list.
    const payout = page
      .getByTestId("admin-payout-card")
      .filter({ hasText: frozenOrderId("completed").slice(0, 8) });
    await expect(payout).toHaveCount(0);
  });

  test("AD-13 — Settings tab renders financial defaults", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    await page.getByTestId("tab-settings").click();
    await page.waitForURL(/tab=settings/);
    const card = page.getByTestId("admin-financial-defaults-card");
    await expect(card).toBeVisible();
    // Scope inside the card so "Commission" (the listing one) doesn't strict-
    // mode-clash with the new "Delivery commission" row.
    await expect(card.getByText("Commission", { exact: true })).toBeVisible();
    await expect(card.getByText("Delivery commission")).toBeVisible();
    await expect(card.getByText(/Driver base rate/i)).toBeVisible();
  });

  test("AD-14 — Payouts tab lists driver owed money and Create payout works", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    await page.getByTestId("tab-payouts").click();
    await page.waitForURL(/tab=payouts/);
    // The seeded "completed" frozen order — driver_earning 64.40 — appears as
    // an owed amount for the seeded driver.
    const card = page.getByTestId("admin-driver-payable-card").first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(/R\s?64[.,]40/);
    await Promise.all([
      page.waitForURL(/\?driver_payout_created=/),
      card.getByTestId("admin-create-driver-payout-button").click()
    ]);
    await expect(
      page.getByTestId("admin-driver-payout-created-message")
    ).toBeVisible();
    // After creation, the card moves out of owed and into pending.
    await expect(
      page.getByTestId("admin-driver-pending-payout-card").first()
    ).toBeVisible();
  });

  test("AD-19 — Approval card lists the applicant's submitted documents with View links", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    // Approvals tab is the default. The pending provider was seeded with two
    // of three required documents; we expect at least one document row and a
    // View link.
    const providerCard = page.getByTestId("admin-provider-approval-card").first();
    await expect(providerCard).toBeVisible();
    await expect(
      providerCard.getByTestId("admin-approval-documents-section")
    ).toBeVisible();
    await expect(
      providerCard.getByTestId("admin-approval-document-row").first()
    ).toBeVisible();
    const viewLink = providerCard.getByTestId("admin-approval-document-view-link").first();
    await expect(viewLink).toBeVisible();
    const href = await viewLink.getAttribute("href");
    expect(href).toMatch(/^\/admin\/documents\/[a-f0-9-]+\/view$/);
  });

  test("AD-20 — Pending provider with only some docs shows the Missing hint", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    const providerCard = page.getByTestId("admin-provider-approval-card").first();
    // The seed leaves bank_confirmation out on purpose so the hint renders.
    await expect(
      providerCard.getByTestId("admin-approval-documents-missing-hint")
    ).toContainText(/Bank confirmation/i);
  });

  test("AD-15 — Mark driver payout as paid stamps reference + clears the card", async ({ page }) => {
    await signInAs(page, testUsers.admin, "page-admin-dashboard");
    await page.goto("/admin/dashboard?tab=payouts");
    const pendingCard = page
      .getByTestId("admin-driver-pending-payout-card")
      .first();
    await expect(pendingCard).toBeVisible();
    await pendingCard
      .getByTestId("admin-payout-reference-input")
      .fill("FNB-RUNBOOK-001");
    await Promise.all([
      page.waitForURL(/\?payout_paid=/),
      pendingCard.getByTestId("admin-mark-payout-paid-button").click()
    ]);
    await expect(page.getByTestId("admin-payout-paid-message")).toBeVisible();
    await expect(
      page.getByTestId("admin-driver-paid-history-card").first()
    ).toBeVisible();
  });
});
