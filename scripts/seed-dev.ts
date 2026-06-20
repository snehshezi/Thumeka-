/**
 * Comprehensive dev seed for manual flow testing.
 *
 * Thin CLI wrapper around `seedWithFrozenOrders()` — see
 * `tests/helpers/seed-dev-data.ts` for the data and `tests/helpers/seed.ts`
 * for the base seed.
 *
 * Run:   npm run seed:dev
 * Reset: npm run reset:dev
 */

import { loadTestEnvFile } from "@/tests/helpers/supabase-env";

loadTestEnvFile(".env.local");

import { resetLocalSupabaseSeed } from "@/tests/helpers/seed";
import {
  FROZEN_ORDERS,
  seedWithFrozenOrders
} from "@/tests/helpers/seed-dev-data";
import { testUsers } from "@/tests/fixtures/users";
import type { LocalSupabaseSeed } from "@/tests/helpers/seed";

function summarize(seed: LocalSupabaseSeed) {
  const password = testUsers.buyer.password;
  console.log("");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("  ✅ Seed complete. Local Supabase is loaded with demo data.");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("");
  console.log("Credentials (all share the same password):");
  console.log(`  Password: ${password}`);
  console.log("");
  for (const [key, u] of Object.entries(testUsers)) {
    console.log(`  ${key.padEnd(16)} ${u.email.padEnd(38)} role: ${u.role}`);
  }
  console.log("");
  console.log("What each user can demonstrate:");
  console.log("  buyer            — browse + checkout + see orders progress");
  console.log("  otherBuyer       — a second buyer for cross-tenant isolation checks");
  console.log("  provider         — approved seller (Thumeka Test Kitchen) with 5 listings");
  console.log("  pendingProvider  — application waiting on admin approval");
  console.log("  driver           — approved + available; gets delivery assignments");
  console.log("  admin            — approvals / EFT confirm / driver assign / payouts");
  console.log("");
  console.log("Frozen orders (each at a different stage of the flow):");
  for (const o of FROZEN_ORDERS) {
    const shortId = o.id.slice(-6);
    console.log(`  …${shortId}   ${o.targetState.padEnd(20)} buyer=${o.buyerKey}`);
  }
  console.log("");
  console.log("Listings seeded:");
  console.log("  Active           — Durban lunch plate, Sunday roast tray,");
  console.log("                     Grocery run, Office lunch platter, Same-day docs");
  console.log("  Hidden           — Disabled test plate (admin_disabled = true)");
  console.log("  Pending provider — Pending provider errand (not browseable)");
  console.log("");
  console.log("Next:");
  console.log("  1. Add DELIVERY_FALLBACK_KM=4 to .env.local so checkout works without a Google key.");
  console.log("  2. npm run dev   →  open http://localhost:3000");
  console.log("  3. Follow docs/manual-test-cases.md to walk every flow.");
  console.log("");
  console.log(`Seed id summary: ${seed.users.buyer.profileId.slice(0, 8)}… (buyer profile)`);
  console.log("─────────────────────────────────────────────────────────────");
}

async function main() {
  console.log("[seed-dev] resetting local Supabase…");
  await resetLocalSupabaseSeed().catch((err) => {
    // First-run is fine — there may be nothing to delete.
    console.warn(`[seed-dev] reset skipped (${err instanceof Error ? err.message : err})`);
  });

  console.log("[seed-dev] seeding base data + frozen orders…");
  const seed = await seedWithFrozenOrders();

  summarize(seed);
}

main().catch((error) => {
  console.error("[seed-dev] failed:", error);
  process.exitCode = 1;
});
