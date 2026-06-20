import type { SupabaseClient } from "@supabase/supabase-js";

import { testDriverProfile } from "@/tests/fixtures/drivers";
import {
  testCategories,
  testListings,
  testPendingProviderProfile,
  testProviderProfile,
  type TestCategory,
  type TestListing
} from "@/tests/fixtures/listings";
import { testOrders } from "@/tests/fixtures/orders";
import { testUsers, type TestUser } from "@/tests/fixtures/users";
import { createTestSupabaseAdminClient } from "@/tests/helpers/supabase";

type ErrorLike = {
  message: string;
};

type ProfileRow = {
  id: string;
  auth_user_id: string;
  role: TestUser["role"];
  full_name: string | null;
  email: string;
  phone: string | null;
};

type TestUserKey = keyof typeof testUsers;

export type SeededTestUser = TestUser;

export type LocalSupabaseSeed = {
  users: Record<TestUserKey, SeededTestUser>;
  providerProfile: typeof testProviderProfile;
  pendingProviderProfile: typeof testPendingProviderProfile;
  driverProfile: typeof testDriverProfile;
  categories: TestCategory[];
  listings: TestListing[];
  orders: typeof testOrders;
};

const TEST_EMAILS = Object.values(testUsers).map((user) => user.email);

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function throwIfError(error: ErrorLike | null | undefined, action: string) {
  if (error) {
    throw new Error(`${action}: ${error.message}`);
  }
}

async function deleteWhereIn(
  supabase: SupabaseClient,
  table: string,
  column: string,
  values: string[]
) {
  const safeValues = uniq(values);

  if (safeValues.length === 0) {
    return;
  }

  const { error } = await supabase.from(table).delete().in(column, safeValues);
  throwIfError(error, `Failed to delete ${table}`);
}

async function selectIdsWhereIn(
  supabase: SupabaseClient,
  table: string,
  column: string,
  values: string[]
) {
  const safeValues = uniq(values);

  if (safeValues.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from(table)
    .select("id")
    .in(column, safeValues);

  throwIfError(error, `Failed to select ${table}`);
  return (data ?? []).map((row) => row.id as string);
}

async function listFixtureAuthUsers(supabase: SupabaseClient) {
  const users = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    });
    throwIfError(error, "Failed to list auth users");

    const pageUsers = data.users.filter((user) =>
      TEST_EMAILS.includes(user.email ?? "")
    );
    users.push(...pageUsers);

    if (data.users.length < perPage) {
      return users;
    }

    page += 1;
  }
}

async function findProfileForAuthUser(
  supabase: SupabaseClient,
  authUserId: string
): Promise<ProfileRow> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, auth_user_id, role, full_name, email, phone")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    throwIfError(error, "Failed to fetch seeded profile");

    if (data) {
      return data as ProfileRow;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for profile for auth user ${authUserId}`);
}

async function createSeededAuthUser(
  supabase: SupabaseClient,
  user: TestUser
) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
      phone: user.phone,
      role: user.role
    }
  });

  throwIfError(error, `Failed to create auth user ${user.email}`);

  if (!data.user) {
    throw new Error(`Auth user was not returned for ${user.email}`);
  }

  const profile = await findProfileForAuthUser(supabase, data.user.id);
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role: user.role,
      full_name: user.fullName,
      phone: user.phone
    })
    .eq("id", profile.id);

  throwIfError(profileError, `Failed to update profile for ${user.email}`);

  return {
    ...user,
    authUserId: data.user.id,
    profileId: profile.id
  };
}

async function seedCategories(supabase: SupabaseClient) {
  const categories: TestCategory[] = [];

  for (const category of testCategories) {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, sort_order")
      .eq("slug", category.slug)
      .maybeSingle();

    throwIfError(error, `Failed to fetch category ${category.slug}`);

    if (data) {
      categories.push(data as TestCategory);
      continue;
    }

    const { data: insertedCategory, error: insertError } = await supabase
      .from("categories")
      .insert({
        name: category.name,
        slug: category.slug,
        sort_order: category.sort_order,
        is_active: true
      })
      .select("id, name, slug, sort_order")
      .single();

    throwIfError(insertError, `Failed to insert category ${category.slug}`);
    categories.push(insertedCategory as TestCategory);
  }

  return categories;
}

function categoryIdForSlug(categories: TestCategory[], slug: string) {
  const category = categories.find((item) => item.slug === slug);

  if (!category) {
    throw new Error(`Missing seeded category ${slug}`);
  }

  return category.id;
}

function listingWithSeededCategory(
  listing: TestListing,
  categories: TestCategory[]
) {
  const fixtureCategory = testCategories.find(
    (category) => category.id === listing.category_id
  );

  if (!fixtureCategory) {
    throw new Error(`Missing fixture category ${listing.category_id}`);
  }

  return {
    ...listing,
    category_id: categoryIdForSlug(categories, fixtureCategory.slug)
  };
}

export async function resetLocalSupabaseSeed() {
  const supabase = createTestSupabaseAdminClient();
  const authUsers = await listFixtureAuthUsers(supabase);
  const authUserIds = authUsers.map((user) => user.id);

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, auth_user_id")
    .in("email", TEST_EMAILS);

  throwIfError(profilesError, "Failed to find seeded profiles");

  const profileIds = uniq([
    ...(profiles ?? []).map((profile) => profile.id as string),
    ...Object.values(testUsers).map((user) => user.profileId)
  ]);

  const providerProfileIds = uniq([
    testProviderProfile.id,
    testPendingProviderProfile.id,
    ...(await selectIdsWhereIn(
      supabase,
      "provider_profiles",
      "user_id",
      profileIds
    ))
  ]);
  const driverProfileIds = uniq([
    testDriverProfile.id,
    ...(await selectIdsWhereIn(
      supabase,
      "driver_profiles",
      "user_id",
      profileIds
    ))
  ]);
  const orderIds = uniq([
    ...testOrders.map((order) => order.id),
    ...(await selectIdsWhereIn(supabase, "orders", "buyer_id", profileIds)),
    ...(await selectIdsWhereIn(
      supabase,
      "orders",
      "provider_id",
      providerProfileIds
    )),
    ...(await selectIdsWhereIn(supabase, "orders", "driver_id", driverProfileIds))
  ]);
  const payoutIds = await selectIdsWhereIn(
    supabase,
    "payouts",
    "recipient_user_id",
    profileIds
  );

  await deleteWhereIn(supabase, "payout_items", "order_id", orderIds);
  await deleteWhereIn(supabase, "payout_items", "payout_id", payoutIds);
  await deleteWhereIn(supabase, "transactions", "order_id", orderIds);
  await deleteWhereIn(supabase, "transactions", "created_by", profileIds);
  await deleteWhereIn(supabase, "order_status_events", "order_id", orderIds);
  await deleteWhereIn(supabase, "order_status_events", "changed_by", profileIds);
  await deleteWhereIn(supabase, "payouts", "id", payoutIds);
  await deleteWhereIn(supabase, "orders", "id", orderIds);
  await deleteWhereIn(
    supabase,
    "listings",
    "id",
    testListings.map((listing) => listing.id)
  );
  await deleteWhereIn(supabase, "listings", "provider_id", providerProfileIds);
  await deleteWhereIn(supabase, "audit_logs", "actor_user_id", profileIds);
  await deleteWhereIn(supabase, "audit_logs", "entity_id", [
    ...providerProfileIds,
    ...driverProfileIds,
    ...orderIds
  ]);
  await deleteWhereIn(supabase, "documents", "owner_user_id", profileIds);
  await deleteWhereIn(supabase, "provider_profiles", "id", providerProfileIds);
  await deleteWhereIn(supabase, "driver_profiles", "id", driverProfileIds);
  await deleteWhereIn(supabase, "profiles", "id", profileIds);

  for (const authUserId of authUserIds) {
    const { error } = await supabase.auth.admin.deleteUser(authUserId);
    throwIfError(error, `Failed to delete auth user ${authUserId}`);
  }
}

export async function seedLocalSupabase(): Promise<LocalSupabaseSeed> {
  const supabase = createTestSupabaseAdminClient();

  try {
    await resetLocalSupabaseSeed();

    const users = {} as Record<TestUserKey, SeededTestUser>;

    for (const [key, user] of Object.entries(testUsers) as Array<
      [TestUserKey, TestUser]
    >) {
      users[key] = await createSeededAuthUser(supabase, user);
    }

    const categories = await seedCategories(supabase);
    const providerProfile = {
      ...testProviderProfile,
      user_id: users.provider.profileId,
      status: "approved",
      approved_at: "2026-05-25T06:00:00.000Z"
    };
    const pendingProviderProfile = {
      ...testPendingProviderProfile,
      user_id: users.pendingProvider.profileId,
      status: "pending",
      approved_at: null
    };
    const driverProfile = {
      ...testDriverProfile,
      user_id: users.driver.profileId,
      approval_status: "approved",
      availability_status: "available",
      approved_at: "2026-05-25T06:10:00.000Z"
    };

    const { error: providerError } = await supabase
      .from("provider_profiles")
      .upsert([providerProfile, pendingProviderProfile], { onConflict: "id" });
    throwIfError(providerError, "Failed to seed provider profiles");

    const { error: driverError } = await supabase
      .from("driver_profiles")
      .upsert(driverProfile, { onConflict: "id" });
    throwIfError(driverError, "Failed to seed driver profile");

    const listings = testListings.map((listing) =>
      listingWithSeededCategory(listing, categories)
    );
    const { error: listingError } = await supabase
      .from("listings")
      .upsert(listings, { onConflict: "id" });
    throwIfError(listingError, "Failed to seed listings");

    const orders = testOrders.map((order) => ({
      ...order,
      buyer_id:
        order.buyer_email === users.otherBuyer.email
          ? users.otherBuyer.profileId
          : users.buyer.profileId,
      provider_id: providerProfile.id,
      listing_id: listings[0].id
    }));
    const { error: orderError } = await supabase
      .from("orders")
      .upsert(orders, { onConflict: "id" });
    throwIfError(orderError, "Failed to seed orders");

    return {
      users,
      providerProfile,
      pendingProviderProfile,
      driverProfile,
      categories,
      listings,
      orders: orders as typeof testOrders
    };
  } catch (error) {
    await resetLocalSupabaseSeed().catch(() => undefined);
    throw error;
  }
}
