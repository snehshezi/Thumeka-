import { testListings, testProviderProfile } from "@/tests/fixtures/listings";
import { testUsers } from "@/tests/fixtures/users";

// Seeded orders mimic what `createOrderRequestAction` would insert: priced at
// checkout, ready for provider acceptance. Distance is 4 km, base R36, per-km
// R8.50 → R70 fee. listing.price + 70 = buyer_total. Driver receives 92%,
// platform keeps 8% of the delivery fee.
const SEED_LISTING_PRICE = Number(testListings[0].price);
const SEED_DELIVERY_FEE = 70;
const SEED_DELIVERY_COMMISSION_AMOUNT = 5.6;
const SEED_BUYER_TOTAL = SEED_LISTING_PRICE + SEED_DELIVERY_FEE;
const SEED_COMMISSION_AMOUNT = Math.round(SEED_LISTING_PRICE * 0.12 * 100) / 100;
const SEED_PROVIDER_EARNING =
  Math.round((SEED_LISTING_PRICE - SEED_COMMISSION_AMOUNT) * 100) / 100;
const SEED_DRIVER_EARNING =
  Math.round((SEED_DELIVERY_FEE - SEED_DELIVERY_COMMISSION_AMOUNT) * 100) / 100;

const sharedOrderFinancials = {
  listing_price: SEED_LISTING_PRICE,
  delivery_distance_km: 4,
  delivery_base_fee: 36,
  delivery_price_per_km: 8.5,
  delivery_fee: SEED_DELIVERY_FEE,
  buyer_total: SEED_BUYER_TOTAL,
  commission_percentage: 12,
  commission_amount: SEED_COMMISSION_AMOUNT,
  delivery_commission_amount: SEED_DELIVERY_COMMISSION_AMOUNT,
  provider_earning: SEED_PROVIDER_EARNING,
  driver_earning: SEED_DRIVER_EARNING,
  payment_status: "not_requested"
};

export const testOrders = [
  {
    id: "60000000-0000-4000-8000-000000000001",
    buyer_id: testUsers.buyer.profileId,
    provider_id: testProviderProfile.id,
    listing_id: testListings[0].id,
    order_type: testListings[0].listing_type,
    status: "order_requested",
    buyer_name: testUsers.buyer.fullName,
    buyer_phone: testUsers.buyer.phone,
    buyer_email: testUsers.buyer.email,
    suburb: "Berea",
    delivery_address: "1 Test Street, Berea",
    ...sharedOrderFinancials
  },
  {
    id: "60000000-0000-4000-8000-000000000002",
    buyer_id: testUsers.otherBuyer.profileId,
    provider_id: testProviderProfile.id,
    listing_id: testListings[0].id,
    order_type: testListings[0].listing_type,
    status: "order_requested",
    buyer_name: testUsers.otherBuyer.fullName,
    buyer_phone: testUsers.otherBuyer.phone,
    buyer_email: testUsers.otherBuyer.email,
    suburb: "Berea",
    delivery_address: "2 Test Street, Berea",
    ...sharedOrderFinancials
  }
];
