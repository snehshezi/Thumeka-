import { Clock, Flame } from "lucide-react";

import { getOrderUrgency, type UrgencyLevel } from "@/lib/urgency";

type OrderAgeChipProps = {
  /** ISO timestamp of when the order / application landed. */
  createdAt: string;
  /** Optional test-id prefix to keep multiple chips on a page addressable. */
  testIdPrefix?: string;
};

/**
 * Coloured chip that announces how long an item has been waiting. Tied to the
 * urgency tiers in [[urgency]]: fresh items stay quiet (small grey label),
 * stale ones escalate to yellow → red → pulsing red. Server-renders fine —
 * the page is `force-dynamic` so the chip recomputes on every navigation.
 */
export function OrderAgeChip({ createdAt, testIdPrefix }: OrderAgeChipProps) {
  const urgency = getOrderUrgency(createdAt);
  const cls = STYLE_BY_LEVEL[urgency.level];
  const Icon = urgency.level === "critical" ? Flame : Clock;
  const testId = testIdPrefix ? `${testIdPrefix}-age-chip` : "order-age-chip";

  return (
    <span
      aria-label={urgency.ariaLabel}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${cls}`}
      data-level={urgency.level}
      data-testid={testId}
    >
      <Icon aria-hidden="true" className="h-3 w-3" />
      {urgency.label}
    </span>
  );
}

const STYLE_BY_LEVEL: Record<UrgencyLevel, string> = {
  normal: "bg-black/5 text-black/55",
  warning: "bg-maize/30 text-ink",
  high: "bg-red-100 text-red-700",
  // Tailwind doesn't ship a built-in pulse for backgrounds; use the
  // standard `animate-pulse` utility, which dips the whole element's
  // opacity. Subtle enough not to be annoying, loud enough to spot.
  critical: "bg-red-600 text-white animate-pulse"
};
