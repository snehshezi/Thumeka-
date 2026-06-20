import { formatWaitingSince } from "@/lib/format";

/**
 * Tiered "how long has this been waiting" calculator for admin queue cards.
 *
 * Tiers are tuned to the homepage's "40-minute average delivery" promise:
 * once an order's been waiting 10 minutes the admin should glance, by 30
 * minutes they should act, and at 2+ hours something has gone wrong.
 *
 *   < 10 min   → normal    (no chip — fresh)
 *   10–30 min  → warning   (yellow chip)
 *   30 min–2h  → high      (red chip)
 *   ≥ 2 hours  → critical  (red chip + pulse)
 */

export type UrgencyLevel = "normal" | "warning" | "high" | "critical";

export type Urgency = {
  level: UrgencyLevel;
  /** Short visual label e.g. "32m", "1h 04m". */
  label: string;
  /** Verbose label for screen readers. */
  ariaLabel: string;
};

const WARNING_AFTER_MIN = 10;
const HIGH_AFTER_MIN = 30;
const CRITICAL_AFTER_MIN = 120;

export function getOrderUrgency(
  createdAtIso: string,
  now: Date = new Date()
): Urgency {
  const then = new Date(createdAtIso).getTime();
  const label = formatWaitingSince(createdAtIso, now);

  if (Number.isNaN(then)) {
    return { level: "normal", label: "—", ariaLabel: "Created at unknown" };
  }

  const minutes = Math.floor(Math.max(0, now.getTime() - then) / 60_000);
  const level: UrgencyLevel =
    minutes >= CRITICAL_AFTER_MIN
      ? "critical"
      : minutes >= HIGH_AFTER_MIN
        ? "high"
        : minutes >= WARNING_AFTER_MIN
          ? "warning"
          : "normal";

  return {
    level,
    label,
    ariaLabel: `Waiting ${label}`
  };
}
