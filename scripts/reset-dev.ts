/**
 * Wipe everything the dev seed created.
 *
 * Run: npm run reset:dev
 */

import { loadTestEnvFile } from "@/tests/helpers/supabase-env";

loadTestEnvFile(".env.local");

import { resetLocalSupabaseSeed } from "@/tests/helpers/seed";
import { createTestSupabaseAdminClient } from "@/tests/helpers/supabase";

const EXTRA_LISTING_IDS = [
  "50000000-0000-4000-8000-000000000004",
  "50000000-0000-4000-8000-000000000005",
  "50000000-0000-4000-8000-000000000006",
  "50000000-0000-4000-8000-000000000007"
];

const EXTRA_CATEGORY_SLUGS = ["groceries", "cleaning", "transport"];

const PENDING_DRIVER_ID = "40000000-0000-4000-8000-000000000099";

const FROZEN_ORDER_IDS = [
  "71000001-0000-4000-8000-000000000000",
  "72000002-0000-4000-8000-000000000000",
  "73000003-0000-4000-8000-000000000000",
  "74000004-0000-4000-8000-000000000000",
  "75000005-0000-4000-8000-000000000000",
  "76000006-0000-4000-8000-000000000000",
  "77000007-0000-4000-8000-000000000000"
];

async function main() {
  const admin = createTestSupabaseAdminClient();

  console.log("[reset-dev] removing dev-only orders, listings, categories…");
  // Order matters — payouts/items/events/transactions FK to orders.
  await admin.from("payout_items").delete().in("order_id", FROZEN_ORDER_IDS);
  await admin.from("transactions").delete().in("order_id", FROZEN_ORDER_IDS);
  await admin.from("order_status_events").delete().in("order_id", FROZEN_ORDER_IDS);
  await admin.from("orders").delete().in("id", FROZEN_ORDER_IDS);
  await admin.from("driver_profiles").delete().eq("id", PENDING_DRIVER_ID);
  await admin.from("listings").delete().in("id", EXTRA_LISTING_IDS);
  await admin.from("categories").delete().in("slug", EXTRA_CATEGORY_SLUGS);

  console.log("[reset-dev] resetting the base seed (users, profiles, base listings/orders)…");
  await resetLocalSupabaseSeed();

  console.log("[reset-dev] ✅ done.");
}

main().catch((error) => {
  console.error("[reset-dev] failed:", error);
  process.exitCode = 1;
});
