/**
 * Shared fixtures + helpers for the runbook Playwright specs.
 *
 * Each runbook spec file calls `setupRunbookFixtures(test)` to install a
 * suite-level seed/reset. Helpers below are imported as needed.
 */

import { expect, type Page, type TestType } from "@playwright/test";

import { resetLocalSupabaseSeed } from "@/tests/helpers/seed";
import {
  frozenOrderId as _frozenOrderId,
  seedWithFrozenOrders,
  type FrozenOrderState
} from "@/tests/helpers/seed-dev-data";
import { loadTestEnvFile } from "@/tests/helpers/supabase-env";
import { testUsers, type TestUser } from "@/tests/fixtures/users";

export { testUsers };
export type { TestUser };
export const frozenOrderId = _frozenOrderId;
export type { FrozenOrderState };

const SA_TIMEZONE = "Africa/Johannesburg";

/**
 * Install one beforeAll/afterAll pair that seeds + resets the runbook data.
 * Call once at the top of every spec file.
 */
export function setupRunbookFixtures(
  test: TestType<Record<string, unknown>, Record<string, unknown>>
) {
  test.beforeAll(async () => {
    loadTestEnvFile();
    await seedWithFrozenOrders();
  });
  test.afterAll(async () => {
    await resetLocalSupabaseSeed().catch(() => {
      /* tolerate already-cleaned state */
    });
  });
}

/** Credentials sign-in. Asserts the expected landing page via testid. */
export async function signInAs(
  page: Page,
  user: TestUser,
  landingTestId: string
) {
  await page.goto("/auth/sign-in");
  await page.getByTestId("sign-in-email-input").fill(user.email);
  await page.getByTestId("sign-in-password-input").fill(user.password);
  await page.getByTestId("sign-in-submit-button").click();
  await expect(page.getByTestId(landingTestId)).toBeVisible();
}

/**
 * Always-works sign-out via the GET /auth/sign-out route — independent of
 * viewport size or which page the user is currently on.
 */
export async function forceSignOut(page: Page) {
  await page.goto("/auth/sign-out");
  await expect(page.getByTestId("page-sign-in")).toBeVisible();
}

/** Locate a buyer order card by short id (first 8 chars). */
export function buyerOrderCardBy(page: Page, orderId: string) {
  return page
    .getByTestId("buyer-order-card")
    .filter({ hasText: orderId.slice(0, 8) })
    .first();
}

/** Locate a provider order card (in the drawer-driven board) by short id. */
export function providerOrderCardBy(page: Page, orderId: string) {
  return page
    .getByTestId("provider-order-card")
    .filter({ hasText: orderId.slice(0, 8) })
    .first();
}

/** Locate an admin order card (operations tab) by short id. */
export function adminOrderCardBy(page: Page, orderId: string) {
  return page
    .getByTestId("admin-order-card")
    .filter({ hasText: orderId.slice(0, 8) })
    .first();
}

void SA_TIMEZONE;
