import {
  acceptProviderOrder,
  assignDriver,
  completeDriverDelivery,
  confirmEftPayment,
  isPayoutEligible,
  markDriverOutForDelivery,
  markDriverPickedUp,
  type DriverForAssignment,
  type OrderForRules
} from "@/lib/order-rules";
import { testProviderProfile } from "@/tests/fixtures/listings";
import { testUsers } from "@/tests/fixtures/users";
import {
  createAuthenticatedTestClient,
  createTestSupabaseAdminClient
} from "@/tests/helpers/supabase";
import type { LocalSupabaseSeed } from "@/tests/helpers/seed";

type ErrorLike = {
  message: string;
};

export const productDeliveryE2EListing = {
  id: "50000000-0000-4000-8000-000000000200",
  title: "E2E Durban lunch plate",
  description: "A real database listing used by the mobile product delivery E2E flow.",
  listing_type: "product",
  price: 250,
  pricing_type: "fixed",
  suburb: "Berea",
  is_active: true,
  admin_disabled: false
};

export const productDeliveryE2ESettings = {
  commission_percentage: 12,
  delivery_commission_percentage: 8,
  driver_base_rate: 36,
  driver_per_km_rate: 8.5,
  eft_payment_instructions:
    "Pay Thumeka by EFT using your order reference before fulfilment starts."
};

function throwIfError(error: ErrorLike | null | undefined, action: string) {
  if (error) {
    throw new Error(`${action}: ${error.message}`);
  }
}

function orderUpdateFromRules(order: OrderForRules) {
  return {
    driver_id: order.driver_id ?? null,
    status: order.status,
    delivery_distance_km: order.delivery_distance_km ?? null,
    delivery_base_fee: order.delivery_base_fee ?? null,
    delivery_price_per_km: order.delivery_price_per_km ?? null,
    delivery_fee: order.delivery_fee ?? 0,
    buyer_total: order.buyer_total ?? 0,
    commission_percentage: order.commission_percentage ?? 12,
    commission_amount: order.commission_amount ?? 0,
    delivery_commission_amount: order.delivery_commission_amount ?? 0,
    provider_earning: order.provider_earning ?? 0,
    driver_earning: order.driver_earning ?? 0,
    payment_status: order.payment_status,
    payment_reference: order.payment_reference ?? null,
    accepted_at: order.accepted_at ?? null,
    completed_at: order.completed_at ?? null
  };
}

export function createProductDeliveryDbFlow(seed: LocalSupabaseSeed) {
  const serviceRole = createTestSupabaseAdminClient();

  async function insertAuditLog({
    action,
    entityType,
    entityId,
    note
  }: {
    action: string;
    entityType: "provider_profile" | "driver_profile" | "order";
    entityId: string;
    note: string;
  }) {
    const { error } = await serviceRole.from("audit_logs").insert({
      actor_user_id: seed.users.admin.profileId,
      actor_role: "admin",
      action,
      entity_type: entityType,
      entity_id: entityId,
      note
    });

    throwIfError(error, `Failed to insert audit log ${action}`);
  }

  async function insertStatusEvent({
    orderId,
    oldStatus,
    newStatus,
    changedBy,
    note
  }: {
    orderId: string;
    oldStatus: string | null;
    newStatus: string;
    changedBy: string;
    note: string;
  }) {
    const { error } = await serviceRole.from("order_status_events").insert({
      order_id: orderId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: changedBy,
      note
    });

    throwIfError(error, `Failed to insert order status event ${newStatus}`);
  }

  async function fetchOrder(orderId: string): Promise<OrderForRules> {
    const { data, error } = await serviceRole
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    throwIfError(error, `Failed to fetch order ${orderId}`);

    return data as OrderForRules;
  }

  async function updateOrder(order: OrderForRules) {
    const { error } = await serviceRole
      .from("orders")
      .update(orderUpdateFromRules(order))
      .eq("id", order.id);

    throwIfError(error, `Failed to update order ${order.id}`);
    return fetchOrder(order.id);
  }

  return {
    async getOrder(orderId: string) {
      return fetchOrder(orderId);
    },

    async getProviderProfile(providerProfileId: string) {
      const { data, error } = await serviceRole
        .from("provider_profiles")
        .select("id, status, approved_at")
        .eq("id", providerProfileId)
        .single();

      throwIfError(error, `Failed to fetch provider profile ${providerProfileId}`);
      return data as { id: string; status: string; approved_at: string | null };
    },

    async getDriverProfile(driverProfileId: string) {
      const { data, error } = await serviceRole
        .from("driver_profiles")
        .select("id, approval_status, availability_status, approved_at")
        .eq("id", driverProfileId)
        .single();

      throwIfError(error, `Failed to fetch driver profile ${driverProfileId}`);
      return data as {
        id: string;
        approval_status: string;
        availability_status: string;
        approved_at: string | null;
      };
    },

    async preparePendingApprovals() {
      const { error: settingsError } = await serviceRole
        .from("admin_settings")
        .update(productDeliveryE2ESettings)
        .not("id", "is", null);
      throwIfError(settingsError, "Failed to seed E2E admin settings");

      const { error: providerError } = await serviceRole
        .from("provider_profiles")
        .update({
          status: "pending",
          approved_at: null
        })
        .eq("id", seed.providerProfile.id);
      throwIfError(providerError, "Failed to reset provider approval");

      const { error: driverError } = await serviceRole
        .from("driver_profiles")
        .update({
          approval_status: "pending",
          availability_status: "unavailable",
          approved_at: null
        })
        .eq("id", seed.driverProfile.id);
      throwIfError(driverError, "Failed to reset driver approval");
    },

    async approveProvider() {
      const approvedAt = "2026-05-25T06:00:00.000Z";
      const { data, error } = await serviceRole
        .from("provider_profiles")
        .update({
          status: "approved",
          approved_at: approvedAt
        })
        .eq("id", seed.providerProfile.id)
        .select("id, status, approved_at")
        .single();
      throwIfError(error, "Failed to approve provider");

      await insertAuditLog({
        action: "provider_approved",
        entityType: "provider_profile",
        entityId: seed.providerProfile.id,
        note: "E2E provider approval"
      });

      return data as { id: string; status: string; approved_at: string };
    },

    async createProductListingAsProvider() {
      const provider = await createAuthenticatedTestClient(testUsers.provider);
      const foodCategory = seed.categories.find((category) => category.slug === "food");

      if (!foodCategory) {
        throw new Error("Missing food category in E2E seed");
      }

      const { data, error } = await provider
        .from("listings")
        .insert({
          ...productDeliveryE2EListing,
          provider_id: testProviderProfile.id,
          category_id: foodCategory.id
        })
        .select("id, title, provider_id, price")
        .single();

      throwIfError(error, "Failed to create product listing as provider");
      return data as {
        id: string;
        title: string;
        provider_id: string;
        price: string;
      };
    },

    async approveDriver() {
      const approvedAt = "2026-05-25T06:10:00.000Z";
      const { data, error } = await serviceRole
        .from("driver_profiles")
        .update({
          approval_status: "approved",
          approved_at: approvedAt
        })
        .eq("id", seed.driverProfile.id)
        .select("id, approval_status, availability_status")
        .single();
      throwIfError(error, "Failed to approve driver");

      await insertAuditLog({
        action: "driver_approved",
        entityType: "driver_profile",
        entityId: seed.driverProfile.id,
        note: "E2E driver approval"
      });

      return data as {
        id: string;
        approval_status: string;
        availability_status: string;
      };
    },

    async makeDriverAvailable() {
      const driver = await createAuthenticatedTestClient(testUsers.driver);
      const { data, error } = await driver
        .from("driver_profiles")
        .update({
          availability_status: "available"
        })
        .eq("id", seed.driverProfile.id)
        .select("id, availability_status")
        .single();

      throwIfError(error, "Failed to make driver available");
      return data as { id: string; availability_status: string };
    },

    async providerAcceptsOrder(orderId: string) {
      const order = await fetchOrder(orderId);
      const oldStatus = order.status;
      // Orders must arrive priced from checkout; the seed inserts them with
      // all financial fields populated, mirroring the production flow.
      const acceptedOrder = acceptProviderOrder(order, "2026-05-25T06:30:00.000Z");
      const updatedOrder = await updateOrder(acceptedOrder);

      await insertStatusEvent({
        orderId,
        oldStatus,
        newStatus: updatedOrder.status,
        changedBy: seed.users.provider.profileId,
        note: "Provider accepted order"
      });

      return updatedOrder;
    },

    async adminConfirmsEft(orderId: string) {
      const order = await fetchOrder(orderId);
      const oldStatus = order.status;
      const result = confirmEftPayment({
        order,
        adminProfileId: seed.users.admin.profileId,
        paymentReference: "E2E-EFT-001"
      });
      const updatedOrder = await updateOrder(result.order);
      const transactions = result.transactions.map((transaction) => ({
        order_id: transaction.order_id,
        transaction_type: transaction.transaction_type,
        amount: transaction.amount,
        direction: transaction.direction,
        status: transaction.status,
        reference: transaction.reference ?? null,
        created_by: transaction.created_by
      }));
      const { error: transactionError } = await serviceRole
        .from("transactions")
        .insert(transactions);
      throwIfError(transactionError, "Failed to insert EFT transactions");

      await insertStatusEvent({
        orderId,
        oldStatus,
        newStatus: updatedOrder.status,
        changedBy: seed.users.admin.profileId,
        note: "Admin confirmed EFT"
      });
      await insertAuditLog({
        action: "eft_payment_confirmed",
        entityType: "order",
        entityId: orderId,
        note: "E2E EFT confirmation"
      });

      return updatedOrder;
    },

    async adminAssignsDriver(orderId: string) {
      const order = await fetchOrder(orderId);
      const oldStatus = order.status;
      const driver = {
        id: seed.driverProfile.id,
        approval_status: "approved",
        availability_status: "available"
      } satisfies DriverForAssignment;
      const assignedOrder = assignDriver(order, driver);
      const updatedOrder = await updateOrder(assignedOrder);

      await insertStatusEvent({
        orderId,
        oldStatus,
        newStatus: updatedOrder.status,
        changedBy: seed.users.admin.profileId,
        note: "Admin assigned driver"
      });
      await insertAuditLog({
        action: "driver_assigned",
        entityType: "order",
        entityId: orderId,
        note: "E2E driver assignment"
      });

      return updatedOrder;
    },

    async driverMarksPickedUp(orderId: string) {
      const order = await fetchOrder(orderId);
      const oldStatus = order.status;
      const updatedOrder = await updateOrder(markDriverPickedUp(order));

      await insertStatusEvent({
        orderId,
        oldStatus,
        newStatus: updatedOrder.status,
        changedBy: seed.users.driver.profileId,
        note: "Driver picked up order"
      });

      return updatedOrder;
    },

    async driverMarksOutForDelivery(orderId: string) {
      const order = await fetchOrder(orderId);
      const oldStatus = order.status;
      const updatedOrder = await updateOrder(markDriverOutForDelivery(order));

      await insertStatusEvent({
        orderId,
        oldStatus,
        newStatus: updatedOrder.status,
        changedBy: seed.users.driver.profileId,
        note: "Driver marked order out for delivery"
      });

      return updatedOrder;
    },

    async driverCompletesDelivery(orderId: string) {
      const order = await fetchOrder(orderId);
      const oldStatus = order.status;
      const updatedOrder = await updateOrder(
        completeDriverDelivery(order, "2026-05-25T07:30:00.000Z")
      );

      await insertStatusEvent({
        orderId,
        oldStatus,
        newStatus: updatedOrder.status,
        changedBy: seed.users.driver.profileId,
        note: "Driver completed delivery"
      });

      return updatedOrder;
    },

    async getTransactions(orderId: string) {
      const { data, error } = await serviceRole
        .from("transactions")
        .select("transaction_type, amount")
        .eq("order_id", orderId);

      throwIfError(error, "Failed to fetch transactions");
      return data ?? [];
    },

    async getAuditActions(orderId: string) {
      const { data, error } = await serviceRole
        .from("audit_logs")
        .select("action")
        .or(
          `entity_id.eq.${seed.providerProfile.id},entity_id.eq.${seed.driverProfile.id},entity_id.eq.${orderId}`
        );

      throwIfError(error, "Failed to fetch audit actions");
      return (data ?? []).map((row) => row.action as string);
    },

    async getOrderStatusEvents(orderId: string) {
      const { data, error } = await serviceRole
        .from("order_status_events")
        .select("old_status, new_status, note")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      throwIfError(error, "Failed to fetch order status events");
      return data ?? [];
    },

    async isOrderPayoutEligible(orderId: string) {
      const order = await fetchOrder(orderId);
      const { data, error } = await serviceRole
        .from("payout_items")
        .select("id, order_id")
        .eq("order_id", orderId);

      throwIfError(error, "Failed to fetch payout items");
      return isPayoutEligible(order, data ?? []);
    }
  };
}
