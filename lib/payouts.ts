import type { OrderRow } from "@/lib/database.types";

export type DriverPayoutOrder = Pick<
  OrderRow,
  | "id"
  | "driver_id"
  | "status"
  | "payment_status"
  | "delivery_fee"
  | "delivery_commission_amount"
  | "driver_earning"
  | "completed_at"
>;

export type PaidPayoutItemLike = {
  order_id: string;
  recipient_type: "provider" | "driver";
};

export type DriverPayable = {
  driverProfileId: string;     // matches orders.driver_id (driver_profiles.id)
  driverUserId: string;        // matches profiles.id (used for payouts.recipient_user_id)
  driverName: string;
  driverEmail: string | null;
  orders: DriverPayoutOrder[];
  orderCount: number;
  netAmount: number;
  grossAmount: number;
  commissionAmount: number;
  periodStart: string;
  periodEnd: string;
};

export type DriverProfileLike = {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
};

function asMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * An order is eligible to be paid out to its driver when it's completed, paid,
 * has a driver assigned, the driver has a non-zero earning, and it isn't
 * already in a *driver* payout item. (A provider payout item for the same
 * order is ignored — the same order can pay both parties independently.)
 */
export function isDriverPayoutEligible(
  order: DriverPayoutOrder,
  paidItems: PaidPayoutItemLike[]
): boolean {
  if (order.status !== "completed") return false;
  if (order.payment_status !== "confirmed") return false;
  if (!order.driver_id) return false;
  if (asMoney(order.driver_earning) <= 0) return false;
  return !paidItems.some(
    (item) => item.order_id === order.id && item.recipient_type === "driver"
  );
}

/**
 * Bucket completed driver orders by driver and sum the money owed. `today`
 * is passed in so the function stays pure (no Date.now()).
 */
export function groupDriverPayables(
  orders: DriverPayoutOrder[],
  driverProfilesByProfileId: Map<string, DriverProfileLike>,
  paidItems: PaidPayoutItemLike[],
  today: string
): DriverPayable[] {
  const buckets = new Map<string, DriverPayable>();

  for (const order of orders) {
    if (!isDriverPayoutEligible(order, paidItems)) continue;
    const driverProfileId = order.driver_id as string;
    const driver = driverProfilesByProfileId.get(driverProfileId);
    // If we can't resolve the driver profile to a user, skip — we can't write
    // a payout without a recipient_user_id.
    if (!driver) continue;
    const existing = buckets.get(driverProfileId);
    const completedDate = (order.completed_at ?? today).slice(0, 10);
    const driverEarning = asMoney(order.driver_earning);
    const deliveryFee = asMoney(order.delivery_fee);
    const deliveryCommission = asMoney(order.delivery_commission_amount);

    if (existing) {
      existing.orders.push(order);
      existing.orderCount += 1;
      existing.netAmount = roundMoney(existing.netAmount + driverEarning);
      existing.grossAmount = roundMoney(existing.grossAmount + deliveryFee);
      existing.commissionAmount = roundMoney(
        existing.commissionAmount + deliveryCommission
      );
      if (completedDate < existing.periodStart) {
        existing.periodStart = completedDate;
      }
    } else {
      buckets.set(driverProfileId, {
        driverProfileId,
        driverUserId: driver.user_id,
        driverName: driver.full_name ?? driver.email ?? "Driver",
        driverEmail: driver.email ?? null,
        orders: [order],
        orderCount: 1,
        netAmount: roundMoney(driverEarning),
        grossAmount: roundMoney(deliveryFee),
        commissionAmount: roundMoney(deliveryCommission),
        periodStart: completedDate,
        periodEnd: today.slice(0, 10)
      });
    }
  }

  return Array.from(buckets.values()).sort(
    (a, b) => b.netAmount - a.netAmount
  );
}
