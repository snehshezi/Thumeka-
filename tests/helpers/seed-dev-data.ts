/**
 * Programmable seed for manual + automated runbook testing.
 *
 * - `seedExtraDevData(seed)` runs on top of the base test seed and adds:
 *     - 3 extra categories
 *     - 4 extra active listings (so /listings looks alive)
 *     - 1 pending driver application
 *     - 7 orders frozen at every demonstrable workflow state
 *
 * - `seedWithFrozenOrders()` is the convenience used by both
 *   `scripts/seed-dev.ts` (CLI) and the runbook e2e specs.
 *
 * `FROZEN_ORDERS` is the public contract: tests look up an order id by its
 * target state (via `frozenOrderId`) rather than embedding magic uuids.
 */

import { seedLocalSupabase, type LocalSupabaseSeed } from "@/tests/helpers/seed";
import { createProductDeliveryDbFlow } from "@/tests/helpers/product-delivery-db-flow";
import { createTestSupabaseAdminClient } from "@/tests/helpers/supabase";
import { testUsers } from "@/tests/fixtures/users";
import { testListings, testProviderProfile } from "@/tests/fixtures/listings";

export type ExtraListing = {
  id: string;
  title: string;
  description: string;
  listing_type: "product" | "service" | "errand";
  price: number;
  category_slug: string;
  suburb: string;
};

export const EXTRA_LISTINGS: ExtraListing[] = [
  {
    id: "50000000-0000-4000-8000-000000000004",
    title: "Sunday roast tray",
    description: "Family-size roast chicken, veg, and Yorkshires for 4–6 people.",
    listing_type: "product",
    price: 320,
    category_slug: "food",
    suburb: "Berea"
  },
  {
    id: "50000000-0000-4000-8000-000000000005",
    title: "Grocery run — Pick n Pay",
    description: "We collect your list and drop it at your door within 90 minutes.",
    listing_type: "errand",
    price: 95,
    category_slug: "errands",
    suburb: "Berea"
  },
  {
    id: "50000000-0000-4000-8000-000000000006",
    title: "Office lunch platter (x10)",
    description: "Mixed sandwiches, fruit, and juice for ten — perfect for meetings.",
    listing_type: "product",
    price: 480,
    category_slug: "food",
    suburb: "Morningside"
  },
  {
    id: "50000000-0000-4000-8000-000000000007",
    title: "Same-day document delivery",
    description: "Hand-delivered envelope between any two Durban suburbs.",
    listing_type: "errand",
    price: 75,
    category_slug: "errands",
    suburb: "Glenwood"
  }
];

export const PENDING_DRIVER_ID = "40000000-0000-4000-8000-000000000099";

export type FrozenOrderState =
  | "order_requested"
  | "awaiting_buyer_eft"
  | "payment_confirmed"
  | "driver_assigned"
  | "picked_up"
  | "out_for_delivery"
  | "completed";

export type FrozenOrder = {
  id: string;
  buyerName: string;
  buyerKey: keyof typeof testUsers;
  notes: string;
  targetState: FrozenOrderState;
};

// Frozen-order UUIDs are deliberately distinct in their first 8 characters
// (`71000001` / `72000002` / …) so the truncated `id.slice(0, 8)` rendered on
// every order card is unique — Playwright locators can then filter by short id
// without picking up the wrong card.
export const FROZEN_ORDERS: FrozenOrder[] = [
  {
    id: "71000001-0000-4000-8000-000000000000",
    buyerName: "Sipho Buyer",
    buyerKey: "buyer",
    notes: "Leave at reception, please.",
    targetState: "order_requested"
  },
  {
    id: "72000002-0000-4000-8000-000000000000",
    buyerName: "Sipho Buyer",
    buyerKey: "buyer",
    notes: "Call before delivery.",
    targetState: "awaiting_buyer_eft"
  },
  {
    id: "73000003-0000-4000-8000-000000000000",
    buyerName: "Lerato Buyer",
    buyerKey: "otherBuyer",
    notes: "Ring the upstairs bell.",
    targetState: "payment_confirmed"
  },
  {
    id: "74000004-0000-4000-8000-000000000000",
    buyerName: "Lerato Buyer",
    buyerKey: "otherBuyer",
    notes: "Gate code 1234.",
    targetState: "driver_assigned"
  },
  {
    id: "75000005-0000-4000-8000-000000000000",
    buyerName: "Sipho Buyer",
    buyerKey: "buyer",
    notes: "Use side entrance.",
    targetState: "picked_up"
  },
  {
    id: "76000006-0000-4000-8000-000000000000",
    buyerName: "Lerato Buyer",
    buyerKey: "otherBuyer",
    notes: "",
    targetState: "out_for_delivery"
  },
  {
    id: "77000007-0000-4000-8000-000000000000",
    buyerName: "Sipho Buyer",
    buyerKey: "buyer",
    notes: "",
    targetState: "completed"
  }
];

/** Look up a seeded frozen order id by its workflow state. */
export function frozenOrderId(state: FrozenOrderState): string {
  const order = FROZEN_ORDERS.find((o) => o.targetState === state);
  if (!order) {
    throw new Error(`No frozen order is seeded at state "${state}"`);
  }
  return order.id;
}

const STEP_ORDER: Record<FrozenOrderState, number> = {
  order_requested: 0,
  awaiting_buyer_eft: 1,
  payment_confirmed: 2,
  driver_assigned: 3,
  picked_up: 4,
  out_for_delivery: 5,
  completed: 6
};

async function ensureExtraCategories(supabase: ReturnType<typeof createTestSupabaseAdminClient>) {
  const extras = [
    { id: "30000000-0000-4000-8000-000000000003", slug: "groceries", name: "Groceries", sort_order: 20 },
    { id: "30000000-0000-4000-8000-000000000004", slug: "cleaning", name: "Cleaning", sort_order: 30 },
    { id: "30000000-0000-4000-8000-000000000005", slug: "transport", name: "Transport", sort_order: 40 }
  ];
  for (const c of extras) {
    const { error } = await supabase
      .from("categories")
      .upsert({ ...c, is_active: true }, { onConflict: "slug" });
    if (error) throw new Error(`Failed to seed category ${c.slug}: ${error.message}`);
  }
}

async function categoryIdBySlug(
  supabase: ReturnType<typeof createTestSupabaseAdminClient>,
  slug: string
): Promise<string> {
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`Category "${slug}" not found after seeding: ${error?.message ?? "missing"}`);
  }
  return data.id as string;
}

async function seedExtraListings(supabase: ReturnType<typeof createTestSupabaseAdminClient>) {
  for (const listing of EXTRA_LISTINGS) {
    const category_id = await categoryIdBySlug(supabase, listing.category_slug);
    const { error } = await supabase
      .from("listings")
      .upsert(
        {
          id: listing.id,
          provider_id: testProviderProfile.id,
          category_id,
          title: listing.title,
          description: listing.description,
          listing_type: listing.listing_type,
          price: listing.price,
          pricing_type: "fixed",
          suburb: listing.suburb,
          fulfillment_address: `${listing.suburb}, Durban`,
          is_active: true,
          admin_disabled: false
        },
        { onConflict: "id" }
      );
    if (error) throw new Error(`Failed to seed listing ${listing.title}: ${error.message}`);
  }
}

async function ensureEftInstructions(
  supabase: ReturnType<typeof createTestSupabaseAdminClient>
) {
  // The buyer EFT instructions panel only renders once admin_settings has a
  // non-empty `eft_payment_instructions` row. Make sure there is one.
  const { data: existing } = await supabase
    .from("admin_settings")
    .select("id")
    .limit(1)
    .maybeSingle();
  const payload = {
    eft_payment_instructions:
      "Pay Thumeka by EFT using your order reference before fulfilment starts.",
    commission_percentage: 12,
    driver_base_rate: 36,
    driver_per_km_rate: 8.5
  };
  const { error } = existing
    ? await supabase.from("admin_settings").update(payload).eq("id", existing.id)
    : await supabase.from("admin_settings").insert(payload);
  if (error) throw new Error(`Failed to upsert admin_settings: ${error.message}`);
}

/**
 * Seed fixture document rows for the seeded pending provider + pending
 * driver applicants so admins have something to click View on. The Storage
 * objects don't exist — that's fine for the dev runbook (admin sees the
 * label + link, the actual binary is irrelevant to the UI demo).
 *
 * Tag with submitted_via='admin_note' so the dev knows these are fixtures.
 *
 * Provider gets only 2 of 3 required docs so the "missing" hint renders.
 */
async function seedPendingApplicantDocuments(
  supabase: ReturnType<typeof createTestSupabaseAdminClient>
) {
  const { data: pendingUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", testUsers.pendingProvider.email)
    .maybeSingle();
  if (!pendingUser) return;
  const ownerId = pendingUser.id as string;

  // Idempotency: wipe + reinsert so reseeding doesn't pile up rows.
  await supabase
    .from("documents")
    .delete()
    .eq("owner_user_id", ownerId);

  await supabase.from("documents").insert([
    // Provider: id_document + proof_of_address only — bank_confirmation missing
    // on purpose so the admin "Missing: Bank confirmation letter" hint shows.
    {
      owner_user_id: ownerId,
      owner_type: "provider",
      document_type: "id_document",
      file_url: `provider/${ownerId}/id_document-fixture.pdf`,
      submitted_via: "admin_note",
      status: "submitted",
      admin_notes: "fixture (seed-dev)"
    },
    {
      owner_user_id: ownerId,
      owner_type: "provider",
      document_type: "proof_of_address",
      file_url: `provider/${ownerId}/proof_of_address-fixture.pdf`,
      submitted_via: "admin_note",
      status: "submitted",
      admin_notes: "fixture (seed-dev)"
    },
    // Driver: full set — no missing hint, all four show as View links.
    {
      owner_user_id: ownerId,
      owner_type: "driver",
      document_type: "id_document",
      file_url: `driver/${ownerId}/id_document-fixture.pdf`,
      submitted_via: "admin_note",
      status: "submitted",
      admin_notes: "fixture (seed-dev)"
    },
    {
      owner_user_id: ownerId,
      owner_type: "driver",
      document_type: "drivers_licence",
      file_url: `driver/${ownerId}/drivers_licence-fixture.pdf`,
      submitted_via: "admin_note",
      status: "submitted",
      admin_notes: "fixture (seed-dev)"
    },
    {
      owner_user_id: ownerId,
      owner_type: "driver",
      document_type: "vehicle_licence_disc",
      file_url: `driver/${ownerId}/vehicle_licence_disc-fixture.pdf`,
      submitted_via: "admin_note",
      status: "submitted",
      admin_notes: "fixture (seed-dev)"
    },
    {
      owner_user_id: ownerId,
      owner_type: "driver",
      document_type: "bank_confirmation",
      file_url: `driver/${ownerId}/bank_confirmation-fixture.pdf`,
      submitted_via: "admin_note",
      status: "submitted",
      admin_notes: "fixture (seed-dev)"
    }
  ]);
}

async function seedPendingDriver(supabase: ReturnType<typeof createTestSupabaseAdminClient>) {
  const { data: pendingUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", testUsers.pendingProvider.email)
    .maybeSingle();
  if (!pendingUser) {
    return;
  }
  const { error } = await supabase
    .from("driver_profiles")
    .upsert(
      {
        id: PENDING_DRIVER_ID,
        user_id: pendingUser.id,
        vehicle_type: "Motorbike",
        vehicle_licence_number: "ND-987-654",
        bank_account_name: "Pending Driver",
        bank_name: "Standard Bank",
        bank_account_number: "5566778899",
        bank_branch_code: "051001",
        approval_status: "pending",
        availability_status: "unavailable"
      },
      { onConflict: "id" }
    );
  if (error) throw new Error(`Failed to seed pending driver: ${error.message}`);
}

async function createFrozenOrder(
  supabase: ReturnType<typeof createTestSupabaseAdminClient>,
  seed: LocalSupabaseSeed,
  order: FrozenOrder
) {
  const buyer = seed.users[order.buyerKey];
  const listing = testListings[0]; // "Durban lunch plate", price 85
  // Orders must arrive priced from checkout — the seed mirrors that, so the
  // provider's accept path doesn't need to recompute anything. Distance 4 km,
  // base R36, per-km R8.50 → R70 delivery fee. Driver gets 92%; platform
  // keeps 8% of the delivery fee plus the 12% listing commission.
  const listingPrice = Number(listing.price);
  const deliveryFee = 70;
  const deliveryCommissionAmount = 5.6;
  const buyerTotal = listingPrice + deliveryFee;
  const commissionAmount = Math.round(listingPrice * 0.12 * 100) / 100;
  const providerEarning =
    Math.round((listingPrice - commissionAmount) * 100) / 100;
  const driverEarning =
    Math.round((deliveryFee - deliveryCommissionAmount) * 100) / 100;
  const { error } = await supabase
    .from("orders")
    .upsert(
      {
        id: order.id,
        buyer_id: buyer.profileId,
        provider_id: testProviderProfile.id,
        listing_id: listing.id,
        order_type: listing.listing_type,
        status: "order_requested",
        payment_status: "not_requested",
        buyer_name: order.buyerName,
        buyer_phone: "0810000001",
        buyer_email: buyer.email,
        delivery_address: "Test address, Berea",
        suburb: "Berea",
        buyer_notes: order.notes || null,
        listing_price: listingPrice,
        delivery_distance_km: 4,
        delivery_base_fee: 36,
        delivery_price_per_km: 8.5,
        delivery_fee: deliveryFee,
        buyer_total: buyerTotal,
        commission_percentage: 12,
        commission_amount: commissionAmount,
        delivery_commission_amount: deliveryCommissionAmount,
        provider_earning: providerEarning,
        driver_earning: driverEarning
      },
      { onConflict: "id" }
    );
  if (error) throw new Error(`Failed to create frozen order ${order.id}: ${error.message}`);
}

async function advanceFrozenOrder(
  flow: ReturnType<typeof createProductDeliveryDbFlow>,
  order: FrozenOrder
) {
  const target = STEP_ORDER[order.targetState];
  if (target >= 1) await flow.providerAcceptsOrder(order.id);
  if (target >= 2) await flow.adminConfirmsEft(order.id);
  if (target >= 3) await flow.adminAssignsDriver(order.id);
  if (target >= 4) await flow.driverMarksPickedUp(order.id);
  if (target >= 5) await flow.driverMarksOutForDelivery(order.id);
  if (target >= 6) await flow.driverCompletesDelivery(order.id);
}

/**
 * Add extra dev data (categories, listings, pending driver, frozen orders) on
 * top of an existing base seed. Returns once every frozen order is at its
 * target state.
 */
export async function seedExtraDevData(seed: LocalSupabaseSeed): Promise<void> {
  const admin = createTestSupabaseAdminClient();
  await ensureExtraCategories(admin);
  await ensureEftInstructions(admin);
  await seedExtraListings(admin);
  await seedPendingDriver(admin);
  await seedPendingApplicantDocuments(admin);
  for (const order of FROZEN_ORDERS) {
    await createFrozenOrder(admin, seed, order);
  }
  const flow = createProductDeliveryDbFlow(seed);
  for (const order of FROZEN_ORDERS) {
    await advanceFrozenOrder(flow, order);
  }
}

/** Convenience: full reset + base seed + extra dev data. */
export async function seedWithFrozenOrders(): Promise<LocalSupabaseSeed> {
  const seed = await seedLocalSupabase();
  await seedExtraDevData(seed);
  return seed;
}
