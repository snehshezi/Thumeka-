export type MoneyInput = number | string | null | undefined;

export type OrderRuleStatus =
  | "order_requested"
  | "awaiting_provider_acceptance"
  | "provider_rejected"
  | "provider_location_warning"
  | "accepted_by_provider"
  | "delivery_fee_calculated"
  | "awaiting_buyer_eft"
  | "eft_submitted"
  | "payment_confirmed"
  | "preparing_or_scheduled"
  | "awaiting_driver_assignment"
  | "driver_assigned"
  | "picked_up"
  | "out_for_delivery"
  | "service_in_progress"
  | "completed"
  | "cancelled"
  | "issue_reported"
  /** Provider didn't accept within the SLA window; cron auto-flipped it. */
  | "expired";

export type PaymentStatus =
  | "not_requested"
  | "awaiting_buyer_eft"
  | "eft_submitted"
  | "confirmed"
  | "failed"
  | "refunded_manual";

/**
 * Human-friendly payment-status copy for the buyer surfaces.
 *
 * The raw `payment_status` reads like a system event (`not_requested`,
 * `eft_submitted`) — fine for admin / provider screens, but unfriendly
 * for buyers. This helper maps each enum value to a sentence framed
 * from the buyer's POV ("Waiting for seller to accept", "We're verifying
 * your payment"). Used by the buyer orders list + detail page.
 */
export function paymentStatusLabelForBuyer(status: PaymentStatus): string {
  switch (status) {
    case "not_requested":
      return "Waiting for seller to accept";
    case "awaiting_buyer_eft":
      return "Ready to pay — see EFT details";
    case "eft_submitted":
      return "We're verifying your payment";
    case "confirmed":
      return "Payment confirmed";
    case "failed":
      return "Payment didn't go through";
    case "refunded_manual":
      return "Refund issued";
  }
}

export type OrderForRules = {
  id: string;
  buyer_id: string;
  provider_id: string;
  listing_id: string;
  driver_id?: string | null;
  order_type: "product" | "service" | "errand";
  status: OrderRuleStatus;
  listing_price: MoneyInput;
  delivery_distance_km?: MoneyInput;
  delivery_base_fee?: MoneyInput;
  delivery_price_per_km?: MoneyInput;
  delivery_fee?: MoneyInput;
  buyer_total?: MoneyInput;
  commission_percentage?: MoneyInput;
  commission_amount?: MoneyInput;
  delivery_commission_amount?: MoneyInput;
  provider_earning?: MoneyInput;
  driver_earning?: MoneyInput;
  payment_status: PaymentStatus;
  payment_reference?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
};

export type AdminSettingsForRules = {
  commission_percentage?: MoneyInput;
  delivery_commission_percentage?: MoneyInput;
  driver_base_rate?: MoneyInput;
  driver_per_km_rate?: MoneyInput;
  default_delivery_fee?: MoneyInput;
  eft_payment_instructions?: string | null;
};

export type DriverForAssignment = {
  id: string;
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  availability_status: "unavailable" | "available" | "busy" | "suspended";
};

export type TransactionRecord = {
  id: string;
  order_id: string;
  transaction_type:
    | "buyer_eft_confirmed"
    | "platform_commission"
    | "delivery_commission"
    | "provider_earning"
    | "driver_earning";
  amount: number;
  direction: "debit" | "credit";
  status: "recorded";
  reference?: string;
  created_by: string;
};

export type PayoutItemLike = {
  id: string;
  order_id: string;
};

const EFT_VISIBLE_STATUSES = new Set<OrderRuleStatus>([
  "accepted_by_provider",
  "delivery_fee_calculated",
  "awaiting_buyer_eft",
  "eft_submitted",
  "payment_confirmed",
  "preparing_or_scheduled",
  "awaiting_driver_assignment",
  "driver_assigned",
  "picked_up",
  "out_for_delivery",
  "completed"
]);

function asNumber(value: MoneyInput, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCommission(
  listingPrice: MoneyInput,
  commissionPercentage: MoneyInput = 12
) {
  const price = asNumber(listingPrice);
  const percentage = asNumber(commissionPercentage, 12);
  const commissionAmount = roundMoney((price * percentage) / 100);

  return {
    commissionPercentage: percentage,
    commissionAmount,
    providerEarning: roundMoney(price - commissionAmount)
  };
}

export function calculateDeliveryFee({
  baseFee = 36,
  distanceKm,
  pricePerKm
}: {
  baseFee?: MoneyInput;
  distanceKm: MoneyInput;
  pricePerKm: MoneyInput;
}) {
  const base = asNumber(baseFee, 36);
  const distance = asNumber(distanceKm);
  const perKm = asNumber(pricePerKm);

  return roundMoney(base + distance * perKm);
}

export const DEFAULT_DELIVERY_COMMISSION_PERCENTAGE = 8;

export function calculateOrderFinancials({
  listingPrice,
  deliveryFee = 0,
  commissionPercentage = 12,
  deliveryCommissionPercentage = DEFAULT_DELIVERY_COMMISSION_PERCENTAGE,
  quantity = 1,
  lineSubtotalOverride
}: {
  listingPrice: MoneyInput;
  deliveryFee?: MoneyInput;
  commissionPercentage?: MoneyInput;
  deliveryCommissionPercentage?: MoneyInput;
  /** Units of the listing ordered. Defaults to 1 so existing call sites
   *  that haven't been updated keep their old behaviour. */
  quantity?: number;
  /** When set, replaces `unitPrice × quantity`. Used by the multi-item
   *  checkout path where the buyer's subtotal is the sum of N lines and
   *  can't be expressed as a single price × qty. */
  lineSubtotalOverride?: MoneyInput;
}) {
  const unitPrice = asNumber(listingPrice);
  const qty = Number.isInteger(quantity) && quantity >= 1 ? quantity : 1;
  // Line subtotal = unit price × qty (or the explicit override for
  // multi-line orders). Commission and provider earning derive off this;
  // the buyer pays subtotal + delivery.
  const lineSubtotal =
    lineSubtotalOverride !== undefined && lineSubtotalOverride !== null
      ? roundMoney(asNumber(lineSubtotalOverride))
      : roundMoney(unitPrice * qty);
  const delivery = roundMoney(asNumber(deliveryFee));
  const commission = calculateCommission(lineSubtotal, commissionPercentage);
  const deliveryCommissionPct = asNumber(
    deliveryCommissionPercentage,
    DEFAULT_DELIVERY_COMMISSION_PERCENTAGE
  );
  const deliveryCommissionAmount = roundMoney(
    (delivery * deliveryCommissionPct) / 100
  );
  // Subtract so the two amounts always reconcile to delivery_fee exactly,
  // even when rounding would otherwise drift by a cent.
  const driverEarning = roundMoney(delivery - deliveryCommissionAmount);

  return {
    // Snapshot of the *unit* price at order time (matches schema semantics).
    listingPrice: roundMoney(unitPrice),
    quantity: qty,
    lineSubtotal,
    deliveryFee: delivery,
    buyerTotal: roundMoney(lineSubtotal + delivery),
    commissionPercentage: commission.commissionPercentage,
    commissionAmount: commission.commissionAmount,
    deliveryCommissionPercentage: deliveryCommissionPct,
    deliveryCommissionAmount,
    providerEarning: commission.providerEarning,
    driverEarning
  };
}

export function canBuyerSeeEftInstructions(
  order: Pick<OrderForRules, "status" | "payment_status">,
  eftPaymentInstructions: string | null | undefined
) {
  return Boolean(
    eftPaymentInstructions?.trim() &&
      EFT_VISIBLE_STATUSES.has(order.status) &&
      ["awaiting_buyer_eft", "eft_submitted", "confirmed"].includes(
        order.payment_status
      )
  );
}

/**
 * Confirms a provider's acceptance of an order that has already been priced at
 * checkout. Orders must arrive with `delivery_fee > 0` and a non-null
 * `delivery_distance_km` — that's the only legal state, since
 * `createOrderRequestAction` blocks checkout if the delivery quote fails.
 *
 * Throws if the order isn't priced. There's no longer a fallback that
 * computes the fee from a provider-supplied distance — that path predated
 * server-side geocoding and has been retired.
 */
export function acceptProviderOrder(
  order: OrderForRules,
  acceptedAt = new Date().toISOString()
): OrderForRules {
  if (asNumber(order.delivery_fee) <= 0 || order.delivery_distance_km == null) {
    throw new Error(
      "Order is missing a delivery quote — refusing to accept. The buyer's " +
        "checkout should have priced it before submission."
    );
  }

  return {
    ...order,
    status: "awaiting_buyer_eft",
    payment_status: "awaiting_buyer_eft",
    accepted_at: acceptedAt
  };
}

export function confirmEftPayment({
  order,
  adminProfileId,
  paymentReference
}: {
  order: OrderForRules;
  adminProfileId: string;
  paymentReference: string;
}) {
  if (!["awaiting_buyer_eft", "eft_submitted"].includes(order.payment_status)) {
    throw new Error("EFT can only be confirmed after provider acceptance");
  }

  const paidOrder: OrderForRules = {
    ...order,
    status: "payment_confirmed",
    payment_status: "confirmed",
    payment_reference: paymentReference
  };
  const transactionBase = {
    order_id: order.id,
    direction: "credit" as const,
    status: "recorded" as const,
    reference: paymentReference,
    created_by: adminProfileId
  };
  const transactions: TransactionRecord[] = [
    {
      ...transactionBase,
      id: `${order.id}:buyer_eft_confirmed`,
      transaction_type: "buyer_eft_confirmed",
      amount: roundMoney(asNumber(paidOrder.buyer_total))
    },
    {
      ...transactionBase,
      id: `${order.id}:platform_commission`,
      transaction_type: "platform_commission",
      amount: roundMoney(asNumber(paidOrder.commission_amount))
    },
    {
      ...transactionBase,
      id: `${order.id}:provider_earning`,
      transaction_type: "provider_earning",
      amount: roundMoney(asNumber(paidOrder.provider_earning))
    }
  ];
  const driverEarning = roundMoney(asNumber(paidOrder.driver_earning));
  const deliveryCommission = roundMoney(
    asNumber(paidOrder.delivery_commission_amount)
  );

  if (deliveryCommission > 0) {
    transactions.push({
      ...transactionBase,
      id: `${order.id}:delivery_commission`,
      transaction_type: "delivery_commission",
      amount: deliveryCommission
    });
  }

  if (driverEarning > 0) {
    transactions.push({
      ...transactionBase,
      id: `${order.id}:driver_earning`,
      transaction_type: "driver_earning",
      amount: driverEarning
    });
  }

  return {
    order: paidOrder,
    transactions
  };
}

export function assignDriver(order: OrderForRules, driver: DriverForAssignment) {
  if (order.payment_status !== "confirmed") {
    throw new Error("Driver can only be assigned after EFT is confirmed");
  }

  if (driver.approval_status !== "approved") {
    throw new Error("Driver must be approved before assignment");
  }

  if (driver.availability_status === "suspended") {
    throw new Error("Suspended driver cannot be assigned");
  }

  return {
    ...order,
    driver_id: driver.id,
    status: "driver_assigned" as const
  };
}

export function markDriverPickedUp(order: OrderForRules) {
  if (!order.driver_id) {
    throw new Error("Order cannot be picked up without an assigned driver");
  }

  if (order.status !== "driver_assigned") {
    throw new Error("Order must be assigned before pickup");
  }

  if (order.payment_status !== "confirmed") {
    throw new Error("Order cannot be picked up before payment is confirmed");
  }

  return {
    ...order,
    status: "picked_up" as const
  };
}

export function markDriverOutForDelivery(order: OrderForRules) {
  if (!order.driver_id) {
    throw new Error("Order cannot go out for delivery without an assigned driver");
  }

  if (order.status !== "picked_up") {
    throw new Error("Order must be picked up before going out for delivery");
  }

  if (order.payment_status !== "confirmed") {
    throw new Error("Order cannot go out for delivery before payment is confirmed");
  }

  return {
    ...order,
    status: "out_for_delivery" as const
  };
}

export function completeDriverDelivery(
  order: OrderForRules,
  completedAt = new Date().toISOString()
) {
  if (!order.driver_id) {
    throw new Error("Delivery cannot be completed without an assigned driver");
  }

  if (order.payment_status !== "confirmed") {
    throw new Error("Delivery cannot be completed before payment is confirmed");
  }

  return {
    ...order,
    status: "completed" as const,
    completed_at: completedAt
  };
}

export function isPayoutEligible(
  order: OrderForRules,
  payoutItems: PayoutItemLike[] = []
) {
  const alreadyPaidOut = payoutItems.some((item) => item.order_id === order.id);

  return (
    order.status === "completed" &&
    order.payment_status === "confirmed" &&
    !alreadyPaidOut
  );
}

export function getPayoutEligibleOrders(
  orders: OrderForRules[],
  payoutItems: PayoutItemLike[] = []
) {
  return orders.filter((order) => isPayoutEligible(order, payoutItems));
}

export type ProviderOrderBucket = "needs_action" | "in_progress" | "closed";

export const PROVIDER_NEEDS_ACTION_STATUSES = new Set<OrderRuleStatus>([
  "order_requested",
  "awaiting_provider_acceptance",
  "provider_location_warning"
]);

export const PROVIDER_CLOSED_STATUSES = new Set<OrderRuleStatus>([
  "completed",
  "cancelled",
  "provider_rejected",
  "expired"
]);

export function getProviderOrderBucket(status: string): ProviderOrderBucket {
  if (PROVIDER_NEEDS_ACTION_STATUSES.has(status as OrderRuleStatus)) {
    return "needs_action";
  }

  if (PROVIDER_CLOSED_STATUSES.has(status as OrderRuleStatus)) {
    return "closed";
  }

  return "in_progress";
}
