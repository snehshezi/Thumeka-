/**
 * Runbook section 2 — Registration & sign-in (R-01..10).
 */

import { expect, test } from "@playwright/test";

import {
  forceSignOut,
  setupRunbookFixtures,
  signInAs,
  testUsers
} from "./_setup";

setupRunbookFixtures(test);

function uniqueEmail(prefix: string) {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}-${stamp}@thumeka.local`;
}

test.describe.serial("Section 2 — Registration & sign-in", () => {
  test.beforeEach(async ({ page }) => {
    await forceSignOut(page).catch(() => undefined);
  });

  test("R-01 — buyer registration redirects to sign-in with registered=1", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByTestId("register-full-name-input").fill("Runbook Buyer");
    await page.getByTestId("register-phone-input").fill("0810000000");
    await page.getByTestId("register-email-input").fill(uniqueEmail("rb-buyer"));
    await page.getByTestId("register-password-input").fill("Thumeka-runbook-1");
    await page.getByTestId("register-confirm-password-input").fill("Thumeka-runbook-1");
    await page.getByTestId("register-role-buyer-input").check();
    await page.getByTestId("register-terms-checkbox").check();
    await Promise.all([
      page.waitForURL(/\/(auth\/sign-in|buyer\/orders)/),
      page.getByTestId("register-submit-button").click()
    ]);
    await expect(page).toHaveURL(/\?(registered|created)=/);
  });

  test("R-02 — provider registration redirects to provider status", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByTestId("register-full-name-input").fill("Runbook Provider");
    await page.getByTestId("register-phone-input").fill("0810000000");
    await page.getByTestId("register-email-input").fill(uniqueEmail("rb-provider"));
    await page.getByTestId("register-password-input").fill("Thumeka-runbook-1");
    await page.getByTestId("register-confirm-password-input").fill("Thumeka-runbook-1");
    await page.getByTestId("register-role-provider-input").check();
    await page.getByTestId("register-terms-checkbox").check();
    await Promise.all([
      page.waitForURL(/\/(provider\/status|auth\/sign-in)/),
      page.getByTestId("register-submit-button").click()
    ]);
    // Either we land at /provider/status?registered=1 (immediate session) or
    // sign-in if email confirmation is on. Both are valid expected outcomes.
    await expect(page).toHaveURL(/\/(provider\/status|auth\/sign-in)\?/);
  });

  test("R-11 — provider apply page renders the Documents section with all 4 slots", async ({ page }) => {
    await signInAs(page, testUsers.provider, "page-provider-status");
    await page.goto("/provider/apply");
    await expect(page.getByTestId("provider-documents-section")).toBeVisible();
    await expect(page.getByTestId("document-slot-id_document")).toBeVisible();
    await expect(page.getByTestId("document-slot-proof_of_address")).toBeVisible();
    await expect(page.getByTestId("document-slot-bank_confirmation")).toBeVisible();
    // business_registration is optional but always rendered.
    await expect(page.getByTestId("document-slot-business_registration")).toBeVisible();
  });

  test("R-15 — Picking a PDF in a document slot uploads to Storage and reveals the storage path", async ({ page }) => {
    await signInAs(page, testUsers.provider, "page-provider-status");
    await page.goto("/provider/apply");

    // A minimal PDF payload — Supabase Storage validates by content-type, not
    // bytes, and the slot component passes contentType: "application/pdf".
    const pdfBuffer = Buffer.from(
      "%PDF-1.4\nfake document used by the runbook upload smoke\n%%EOF"
    );
    await page
      .getByTestId("document-slot-id_document-file-input")
      .setInputFiles({
        name: "runbook-id.pdf",
        mimeType: "application/pdf",
        buffer: pdfBuffer
      });

    // The slot flips its data-status attribute as soon as the Storage round
    // trip resolves. 15 s is comfortable even on a slow local stack.
    const status = page.getByTestId("document-slot-id_document-status");
    await expect(status).toHaveAttribute("data-status", "uploaded", {
      timeout: 15000
    });
    await expect(status).toContainText(/Uploaded/);

    // The hidden field now carries a real path under the provider's folder.
    const hidden = page.locator('input[name="document_path__id_document"]');
    const value = await hidden.inputValue();
    expect(value).toMatch(/^provider\/[0-9a-f-]+\/id_document-[0-9a-f]+\.pdf$/);

    // We intentionally don't submit the form — that would flip the seeded
    // provider's status back to pending and break later runbook tests. The
    // upload mechanic is what this case is about.
  });

  test("R-12 — submitting provider apply with no uploads is blocked with a friendly error", async ({ page }) => {
    await signInAs(page, testUsers.provider, "page-provider-status");
    await page.goto("/provider/apply");
    await page.getByTestId("provider-business-name-input").fill("Document Test Kitchen");
    await page.getByTestId("provider-description-input").fill("Just testing the required-doc gate.");
    await page.getByTestId("provider-suburb-input").fill("Berea");
    await page.getByTestId("provider-address-input").fill("1 Runbook Road");
    await page.getByTestId("provider-bank-account-name-input").fill("Document Test");
    await page.getByTestId("provider-bank-name-input").fill("FNB");
    await page.getByTestId("provider-bank-account-number-input").fill("1234567890");
    await page.getByTestId("provider-bank-branch-code-input").fill("250655");
    await Promise.all([
      page.waitForURL(/\/provider\/apply\?error=/),
      page.getByTestId("provider-apply-submit-button").click()
    ]);
    await expect(page.getByText(/Please upload the ID document/i)).toBeVisible();
  });

  test("R-03 — driver registration redirects to driver status", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByTestId("register-full-name-input").fill("Runbook Driver");
    await page.getByTestId("register-phone-input").fill("0810000000");
    await page.getByTestId("register-email-input").fill(uniqueEmail("rb-driver"));
    await page.getByTestId("register-password-input").fill("Thumeka-runbook-1");
    await page.getByTestId("register-confirm-password-input").fill("Thumeka-runbook-1");
    await page.getByTestId("register-role-driver-input").check();
    await page.getByTestId("register-terms-checkbox").check();
    await Promise.all([
      page.waitForURL(/\/(driver\/status|auth\/sign-in)/),
      page.getByTestId("register-submit-button").click()
    ]);
    await expect(page).toHaveURL(/\/(driver\/status|auth\/sign-in)\?/);
  });

  test("R-04 — missing fields shows the required-field error", async ({ page }) => {
    await page.goto("/auth/register");
    // Fill ONLY email so the server's checks kick in (browser-level required
    // would otherwise short-circuit submission).
    await page.getByTestId("register-email-input").fill(uniqueEmail("rb-empty"));
    // Browser-level required attributes will prevent submission; verify the
    // first required input is flagged invalid.
    await page.getByTestId("register-submit-button").click();
    const nameInput = page.getByTestId("register-full-name-input");
    await expect(nameInput).toHaveJSProperty("validity.valueMissing", true);
  });

  test("R-05 — short password rejected by the browser minLength", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByTestId("register-full-name-input").fill("Runbook Short");
    await page.getByTestId("register-phone-input").fill("0810000000");
    await page.getByTestId("register-email-input").fill(uniqueEmail("rb-short"));
    await page.getByTestId("register-password-input").fill("abc123");
    await page.getByTestId("register-role-buyer-input").check();
    await page.getByTestId("register-submit-button").click();
    const pwInput = page.getByTestId("register-password-input");
    await expect(pwInput).toHaveJSProperty("validity.tooShort", true);
  });

  test("R-06 — admin email blocked at server", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByTestId("register-full-name-input").fill("Block Test");
    await page.getByTestId("register-phone-input").fill("0810000000");
    await page.getByTestId("register-email-input").fill("admin@thumeka.co.za");
    await page.getByTestId("register-password-input").fill("Thumeka-runbook-1");
    await page.getByTestId("register-confirm-password-input").fill("Thumeka-runbook-1");
    await page.getByTestId("register-role-buyer-input").check();
    await page.getByTestId("register-terms-checkbox").check();
    await page.getByTestId("register-submit-button").click();
    // Server redirects back with an error in the URL.
    await page.waitForURL(/\/auth\/register\?error=/);
    await expect(page).toHaveURL(/error=/);
  });

  test("R-07 — safe next redirect after sign-in", async ({ page }) => {
    await page.goto(`/auth/sign-in?next=${encodeURIComponent("/listings?q=lunch")}`);
    await page.getByTestId("sign-in-email-input").fill(testUsers.buyer.email);
    await page.getByTestId("sign-in-password-input").fill(testUsers.buyer.password);
    await Promise.all([
      page.waitForURL(/\/listings\?q=lunch/),
      page.getByTestId("sign-in-submit-button").click()
    ]);
    await expect(page).toHaveURL(/\/listings\?q=lunch/);
  });

  test("R-08 — malicious next redirect rejected (lands at role home)", async ({ page }) => {
    await page.goto(`/auth/sign-in?next=${encodeURIComponent("//evil.example/")}`);
    await page.getByTestId("sign-in-email-input").fill(testUsers.buyer.email);
    await page.getByTestId("sign-in-password-input").fill(testUsers.buyer.password);
    await page.getByTestId("sign-in-submit-button").click();
    // We expect to land on /buyer/orders, NOT the external URL.
    await page.waitForURL(/\/buyer\/orders/);
    expect(page.url()).not.toContain("evil.example");
  });

  test("R-09 — sign in as seeded buyer lands at /buyer/orders", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    expect(page.url()).toContain("/buyer/orders");
  });

  test("R-10 — sign-out clears the session", async ({ page }) => {
    await signInAs(page, testUsers.buyer, "page-buyer-orders");
    await forceSignOut(page);
    await expect(page.getByTestId("page-sign-in")).toBeVisible();
  });
});
