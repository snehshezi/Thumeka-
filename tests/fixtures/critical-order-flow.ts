import type {
  AdminSettingsForRules,
  DriverForAssignment,
  OrderForRules,
  PayoutItemLike
} from "@/lib/order-rules";
import { testListings, testProviderProfile } from "@/tests/fixtures/listings";
import { testUsers } from "@/tests/fixtures/users";

export const criticalOrderSettings: AdminSettingsForRules = {
  commission_percentage: 12,
  delivery_commission_percentage: 8,
  driver_base_rate: 36,
  driver_per_km_rate: 8.5,
  eft_payment_instructions:
    "Pay Thumeka by EFT using your order reference before fulfilment starts."
};

export const criticalDriver: DriverForAssignment = {
  id: "70000000-0000-4000-8000-000000000001",
  approval_status: "approved",
  availability_status: "available"
};

// Fixture matches what `createOrderRequestAction` would persist: a fully
// priced order with all financial fields populated from the buyer's checkout
// quote. listing_price 250 + distance 4 km × R8.50/km + base R36 → R70 delivery
// fee → R320 buyer total. Commission 12% of listing → R30. Delivery commission
// 8% of fee → R5.60. Net: provider R220 + driver R64.40.
export function createCriticalOrderFixture(
  overrides: Partial<OrderForRules> = {}
): OrderForRules {
  const listing = testListings[0];

  return {
    id: "60000000-0000-4000-8000-000000000100",
    buyer_id: testUsers.buyer.profileId,
    provider_id: testProviderProfile.id,
    listing_id: listing.id,
    order_type: listing.listing_type,
    status: "order_requested",
    listing_price: 250,
    delivery_distance_km: 4,
    delivery_base_fee: 36,
    delivery_price_per_km: criticalOrderSettings.driver_per_km_rate,
    delivery_fee: 70,
    buyer_total: 320,
    commission_percentage: 12,
    commission_amount: 30,
    delivery_commission_amount: 5.6,
    provider_earning: 220,
    driver_earning: 64.4,
    payment_status: "not_requested",
    ...overrides
  };
}

export function createPayoutItemForOrder(
  orderId: string,
  overrides: Partial<PayoutItemLike> = {}
): PayoutItemLike {
  return {
    id: `payout-item:${orderId}`,
    order_id: orderId,
    ...overrides
  };
}
