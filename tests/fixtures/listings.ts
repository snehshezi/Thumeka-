import type { ListingType } from "@/lib/constants";

export type TestCategory = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

export type TestListing = {
  id: string;
  provider_id: string;
  category_id: string;
  title: string;
  description: string;
  listing_type: ListingType;
  price: number;
  pricing_type: "fixed" | "from" | "quote_required" | "hourly" | "daily";
  suburb: string;
  is_active: boolean;
  admin_disabled: boolean;
};

export const testCategories: TestCategory[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    name: "Food",
    slug: "food",
    sort_order: 1
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    name: "Errands",
    slug: "errands",
    sort_order: 8
  }
];

export const testProviderProfile = {
  id: "40000000-0000-4000-8000-000000000001",
  user_id: "20000000-0000-4000-8000-000000000002",
  business_name: "Thumeka Test Kitchen",
  provider_type: "business",
  description: "Local test provider",
  suburb: "Berea",
  address: "1 Test Road, Berea",
  status: "approved"
};

export const testPendingProviderProfile = {
  id: "40000000-0000-4000-8000-000000000002",
  user_id: "20000000-0000-4000-8000-000000000006",
  business_name: "Pending Test Kitchen",
  provider_type: "business",
  description: "Pending local test provider",
  suburb: "Glenwood",
  address: "2 Test Road, Glenwood",
  status: "pending"
};

export const testListings: TestListing[] = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    provider_id: testProviderProfile.id,
    category_id: testCategories[0].id,
    title: "Durban lunch plate",
    description: "A stable fixture listing for marketplace tests.",
    listing_type: "product",
    price: 85,
    pricing_type: "fixed",
    suburb: "Berea",
    is_active: true,
    admin_disabled: false
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    provider_id: testProviderProfile.id,
    category_id: testCategories[0].id,
    title: "Disabled test plate",
    description: "A disabled fixture listing that should not be public.",
    listing_type: "product",
    price: 95,
    pricing_type: "fixed",
    suburb: "Berea",
    is_active: true,
    admin_disabled: true
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    provider_id: testPendingProviderProfile.id,
    category_id: testCategories[1].id,
    title: "Pending provider errand",
    description: "A fixture listing from a pending provider.",
    listing_type: "errand",
    price: 120,
    pricing_type: "fixed",
    suburb: "Glenwood",
    is_active: true,
    admin_disabled: false
  }
];
