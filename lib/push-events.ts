import type { PushPayload } from "@/lib/push";

/**
 * Single source of truth for every push-notification's copy + deep
 * link. Keeping these as pure functions (rather than scattered
 * inline string literals) means:
 *
 *   1. Copy changes happen in one place.
 *   2. Tests can assert that variables (listing title, suburb, …)
 *      actually appear in the rendered string, catching the silent
 *      "I renamed the prop but forgot to update the template" bug.
 *   3. The trigger-point call sites stay readable:
 *        await sendPush({ userId, ...pushEvents.providerNewOrder(...) });
 */
export const pushEvents = {
  providerNewOrder(listingTitle: string, orderRef: string): PushPayload {
    return {
      title: "New order request",
      body: `${listingTitle} — tap to accept or decline · #${orderRef}`,
      url: "/provider/dashboard"
    };
  },

  providerPaymentConfirmed(orderRef: string): PushPayload {
    return {
      title: "Payment confirmed",
      body: `Order #${orderRef} is paid — start preparing.`,
      url: "/provider/dashboard"
    };
  },

  buyerOrderAccepted(providerName: string): PushPayload {
    return {
      title: "Order accepted!",
      body: `${providerName} accepted your order. Send your proof of payment via WhatsApp.`,
      url: "/buyer/orders"
    };
  },

  buyerOrderRejected(providerName: string): PushPayload {
    return {
      title: "Order declined",
      body: `${providerName} couldn't fulfil your order. Tap to browse alternatives.`,
      url: "/listings"
    };
  },

  buyerPaymentConfirmed(): PushPayload {
    return {
      title: "Payment confirmed",
      body: "Your order is on its way through. We'll ping when the driver picks it up.",
      url: "/buyer/orders"
    };
  },

  buyerOutForDelivery(): PushPayload {
    return {
      title: "Driver on the way",
      body: "Your order is out for delivery.",
      url: "/buyer/orders"
    };
  },

  buyerCompleted(): PushPayload {
    return {
      title: "Order delivered",
      body: "Enjoy! Tap to rate the experience.",
      url: "/buyer/orders"
    };
  },

  buyerOrderExpired(providerName: string): PushPayload {
    return {
      title: "Seller didn't respond",
      body: `${providerName} didn't accept in time. Tap to browse alternatives.`,
      url: "/listings"
    };
  },

  driverNewAssignment(suburb: string, distanceKm: number | string): PushPayload {
    const km = typeof distanceKm === "number" ? distanceKm.toFixed(1) : distanceKm;
    return {
      title: "New delivery",
      body: `Pickup in ${suburb} · ${km} km · tap for details`,
      url: "/driver/dashboard"
    };
  }
} as const;

/** Helper for shortening order ids to the 8-char display ref everywhere. */
export function orderRef(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}
