import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/auth/sign-in",
  "/auth/register",
  "/support"
];

test.describe("accessibility", () => {
  for (const route of publicRoutes) {
    test(`${route} has no detectable axe violations`, async ({ page }) => {
      await page.goto(route);

      const results = await new AxeBuilder({ page }).analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
