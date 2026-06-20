import { defineConfig, devices } from "@playwright/test";

import { loadTestEnvFile } from "./tests/helpers/supabase-env";

loadTestEnvFile();

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    testIdAttribute: "data-testid"
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        command: "npm run dev:test",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key",
          NEXT_PUBLIC_APP_URL: baseURL,
          NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER:
            process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER ?? "27000000000",
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
            process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
          DELIVERY_FALLBACK_KM: process.env.DELIVERY_FALLBACK_KM ?? "4"
        }
      },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 }
      }
    },
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 }
      }
    }
  ]
});
