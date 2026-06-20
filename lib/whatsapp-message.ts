import { formatMoney } from "@/lib/format";

type OrderForWhatsApp = {
  id: string;
  buyer_name: string | null;
  buyer_total: string | number;
};

/**
 * Pre-filled message for the buyer's "Send POP via WhatsApp" deep-link.
 *
 * Shape: `Hi Thumeka, here is my proof of payment for order #ABC12345
 * (R 320.00). — Andile`. The order ref slice and money formatting let the
 * support team match the chat to the order immediately. Trailing
 * `— {buyer_name}` keeps the message friendly and gives support a sanity
 * check that the chat is coming from the right person.
 */
export function buildPaymentProofMessage(order: OrderForWhatsApp): string {
  const ref = order.id.slice(0, 8).toUpperCase();
  const total = formatMoney(order.buyer_total);
  const namePart = order.buyer_name?.trim()
    ? ` — ${order.buyer_name.trim()}`
    : "";
  return `Hi Thumeka, here is my proof of payment for order #${ref} (${total}).${namePart}`;
}

/**
 * Pre-filled message for the footer "Report a bug" deep-link. WhatsApp
 * is the fastest path for support to triage something that broke. The
 * labelled placeholders cue the user on what to fill in — they can
 * type over each one before sending.
 */
export function buildBugReportMessage(): string {
  return [
    "Hi Thumeka team, I'd like to report a bug:",
    "",
    "What I was doing:",
    "What went wrong:",
    "Device / browser:"
  ].join("\n");
}

/**
 * Pre-filled message for the "Need urgent help?" pill on order surfaces.
 * Includes the order ref if known so support can pull the row up
 * immediately; otherwise the user fills it in themselves.
 */
export function buildUrgentOrderHelpMessage(orderId?: string): string {
  const ref = orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : "";
  return [
    "Hi Thumeka team, I need urgent help with an order:",
    "",
    `Order ref: ${ref}`,
    "Issue:"
  ].join("\n");
}
