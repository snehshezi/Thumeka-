import type { AdminSettingsRow } from "@/lib/database.types";

/**
 * SLA windows + deadline math.
 *
 * Three SLA stages today:
 *
 *   1. Provider acceptance — runs from `orders.created_at` to
 *      `orders.expires_at`. If the provider doesn't accept within
 *      `admin_settings.provider_acceptance_window_minutes`, the cron
 *      sweep flips the order to `expired`.
 *
 *   2. Admin EFT confirm — runs from when the buyer marks the order
 *      as EFT-paid (status flips to `eft_submitted`) to
 *      `orders.eft_confirm_due_at`. Used by the UI to show urgency on
 *      the admin's operational queue. No auto-action — admin must do
 *      the work.
 *
 *   3. Admin driver assignment — runs from `payment_confirmed` to
 *      `orders.driver_assign_due_at`. Same UI-only urgency role.
 *
 * The helpers are pure functions of (event time, settings) → deadline,
 * so they unit-test easily and don't need a DB connection.
 */

/** Fallbacks when no admin_settings row is available (tests, dev). */
export const SLA_DEFAULTS = {
  providerAcceptMinutes: 5,
  eftConfirmMinutes: 30,
  driverAssignMinutes: 60
} as const;

/** Subset of admin_settings the SLA helpers actually read. Accepts the
 *  full row OR a partial fixture for tests. */
export type AdminSettingsForSla = Partial<
  Pick<
    AdminSettingsRow,
    | "provider_acceptance_window_minutes"
    | "eft_confirm_window_minutes"
    | "driver_assign_window_minutes"
  >
> | null
| undefined;

function asInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function asDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Provider has this many minutes to accept after order creation. */
export function getAcceptanceWindowMinutes(
  settings: AdminSettingsForSla
): number {
  return asInt(
    settings?.provider_acceptance_window_minutes,
    SLA_DEFAULTS.providerAcceptMinutes
  );
}

export function getEftConfirmWindowMinutes(
  settings: AdminSettingsForSla
): number {
  return asInt(
    settings?.eft_confirm_window_minutes,
    SLA_DEFAULTS.eftConfirmMinutes
  );
}

export function getDriverAssignWindowMinutes(
  settings: AdminSettingsForSla
): number {
  return asInt(
    settings?.driver_assign_window_minutes,
    SLA_DEFAULTS.driverAssignMinutes
  );
}

export function computeAcceptanceDeadline(
  createdAt: Date | string | number,
  settings: AdminSettingsForSla = null
): Date {
  return addMinutes(asDate(createdAt), getAcceptanceWindowMinutes(settings));
}

export function computeEftConfirmDeadline(
  eftSubmittedAt: Date | string | number,
  settings: AdminSettingsForSla = null
): Date {
  return addMinutes(
    asDate(eftSubmittedAt),
    getEftConfirmWindowMinutes(settings)
  );
}

export function computeDriverAssignDeadline(
  paymentConfirmedAt: Date | string | number,
  settings: AdminSettingsForSla = null
): Date {
  return addMinutes(
    asDate(paymentConfirmedAt),
    getDriverAssignWindowMinutes(settings)
  );
}

/**
 * Compute a provider's rolling response rate.
 *
 * `total` = orders the provider has had a chance to respond to in the
 *           window (accepted + expired). Rejected orders count too if
 *           we want to penalise rejection — for the MVP we treat
 *           rejection as a valid response and only `expired` as a miss.
 * `accepted` = orders where the provider accepted in time.
 *
 * Returns a number 0-100, rounded to 2 decimals. When `total` is 0,
 * we return 100 (a fresh provider is full credit until proven
 * otherwise).
 */
export function computeResponseRatePct({
  accepted,
  total
}: {
  accepted: number;
  total: number;
}): number {
  if (!Number.isFinite(accepted) || !Number.isFinite(total) || total <= 0) {
    return 100;
  }
  const pct = Math.max(0, Math.min(100, (accepted / total) * 100));
  return Math.round(pct * 100) / 100;
}

/**
 * Threshold of consecutive missed orders before a provider's store is
 * auto-closed by the cron. Single source of truth — must match the
 * literal in `sweep_expired_orders()` (migration 020).
 */
export const AUTO_CLOSE_MISS_THRESHOLD = 3;

/**
 * Format remaining time as `MM:SS` (or `--:--` when negative).
 * Used by both the live countdown component and any server-side
 * "near-deadline" badges.
 */
export function formatRemaining(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs < 0) return "--:--";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Urgency level driven off the remaining fraction (`remainingMs /
 * windowMs`). Used by the countdown to colour-shift and by the
 * urgent-action banner to decide whether to even render.
 */
export type UrgencyLevel = "neutral" | "amber" | "red" | "expired";

export function urgencyOf(
  remainingMs: number,
  windowMs: number
): UrgencyLevel {
  if (remainingMs <= 0) return "expired";
  if (windowMs <= 0 || !Number.isFinite(windowMs)) return "neutral";
  const fraction = remainingMs / windowMs;
  if (remainingMs <= 30_000) return "red";
  if (fraction < 0.25) return "red";
  if (fraction < 0.5) return "amber";
  return "neutral";
}
