import {
  acceptProviderOrder,
  assignDriver,
  canBuyerSeeEftInstructions,
  completeDriverDelivery,
  confirmEftPayment,
  type DriverForAssignment,
  isPayoutEligible,
  markDriverOutForDelivery,
  markDriverPickedUp,
  type OrderForRules,
  type TransactionRecord
} from "@/lib/order-rules";
import {
  createCriticalOrderFixture,
  criticalOrderSettings
} from "@/tests/fixtures/critical-order-flow";
import {
  testCategories,
  testListings,
  testProviderProfile
} from "@/tests/fixtures/listings";
import { testUsers } from "@/tests/fixtures/users";

type FlowProvider = typeof testProviderProfile & {
  status: "pending" | "approved" | "rejected" | "suspended";
  approved_at: string | null;
};

type FlowDriver = DriverForAssignment & {
  user_id: string;
  approved_at: string | null;
};

export type FlowAuditLog = {
  action:
    | "provider_approved"
    | "driver_approved"
    | "eft_payment_confirmed"
    | "driver_assigned";
  actor_user_id: string;
  actor_role: "admin";
  entity_type: "provider_profile" | "driver_profile" | "order";
  entity_id: string;
};

export function createProductDeliveryFlowHarness() {
  const auditLogs: FlowAuditLog[] = [];
  let provider: FlowProvider = {
    ...testProviderProfile,
    status: "pending",
    approved_at: null
  };
  let driver: FlowDriver = {
    id: "70000000-0000-4000-8000-000000000100",
    user_id: testUsers.driver.profileId,
    approval_status: "pending",
    availability_status: "unavailable",
    approved_at: null
  };
  let listing: typeof testListings[number] | null = null;
  let order: OrderForRules | null = null;
  let transactions: TransactionRecord[] = [];

  function addAuditLog(log: Omit<FlowAuditLog, "actor_user_id" | "actor_role">) {
    auditLogs.push({
      ...log,
      actor_user_id: testUsers.admin.profileId,
      actor_role: "admin"
    });
  }

  return {
    get state() {
      return {
        auditLogs,
        provider,
        driver,
        listing,
        order,
        transactions
      };
    },

    approveProvider() {
      provider = {
        ...provider,
        status: "approved",
        approved_at: "2026-05-25T06:00:00.000Z"
      };
      addAuditLog({
        action: "provider_approved",
        entity_type: "provider_profile",
        entity_id: provider.id
      });

      return provider;
    },

    createProductListing() {
      if (provider.status !== "approved") {
        throw new Error("Provider must be approved before creating a listing");
      }

      listing = {
        ...testListings[0],
        id: "50000000-0000-4000-8000-000000000100",
        provider_id: provider.id,
        category_id: testCategories[0].id,
        title: "E2E Durban lunch plate",
        listing_type: "product",
        is_active: true,
        admin_disabled: false
      };

      return listing;
    },

    approveDriver() {
      driver = {
        ...driver,
        approval_status: "approved",
        approved_at: "2026-05-25T06:10:00.000Z"
      };
      addAuditLog({
        action: "driver_approved",
        entity_type: "driver_profile",
        entity_id: driver.id
      });

      return driver;
    },

    makeDriverAvailable() {
      if (driver.approval_status !== "approved") {
        throw new Error("Driver must be approved before becoming available");
      }

      driver = {
        ...driver,
        availability_status: "available"
      };

      return driver;
    },

    placeOrderRequest() {
      if (!listing) {
        throw new Error("Listing is required before order request");
      }

      order = createCriticalOrderFixture({
        id: "60000000-0000-4000-8000-000000000200",
        provider_id: provider.id,
        listing_id: listing.id,
        order_type: "product",
        status: "order_requested",
        payment_status: "not_requested"
      });

      return order;
    },

    buyerCanSeeEftInstructions() {
      if (!order) {
        throw new Error("Order is required before checking EFT visibility");
      }

      return canBuyerSeeEftInstructions(
        order,
        criticalOrderSettings.eft_payment_instructions
      );
    },

    providerAcceptsOrder() {
      if (!order) {
        throw new Error("Order is required before provider acceptance");
      }

      order = acceptProviderOrder(order, "2026-05-25T06:30:00.000Z");

      return order;
    },

    adminConfirmsEft() {
      if (!order) {
        throw new Error("Order is required before EFT confirmation");
      }

      const result = confirmEftPayment({
        order,
        adminProfileId: testUsers.admin.profileId,
        paymentReference: "E2E-EFT-001"
      });
      order = result.order;
      transactions = result.transactions;
      addAuditLog({
        action: "eft_payment_confirmed",
        entity_type: "order",
        entity_id: order.id
      });

      return {
        order,
        transactions
      };
    },

    adminAssignsDriver() {
      if (!order) {
        throw new Error("Order is required before driver assignment");
      }

      order = assignDriver(order, driver);
      addAuditLog({
        action: "driver_assigned",
        entity_type: "order",
        entity_id: order.id
      });

      return order;
    },

    driverMarksPickedUp() {
      if (!order) {
        throw new Error("Order is required before pickup");
      }

      order = markDriverPickedUp(order);
      return order;
    },

    driverMarksOutForDelivery() {
      if (!order) {
        throw new Error("Order is required before delivery progress");
      }

      order = markDriverOutForDelivery(order);
      return order;
    },

    driverCompletesDelivery() {
      if (!order) {
        throw new Error("Order is required before delivery completion");
      }

      order = completeDriverDelivery(order, "2026-05-25T07:30:00.000Z");
      return order;
    },

    isCurrentOrderPayoutEligible(payoutItems: { id: string; order_id: string }[] = []) {
      if (!order) {
        throw new Error("Order is required before payout eligibility check");
      }

      return isPayoutEligible(order, payoutItems);
    }
  };
}
