import { Store, ZapOff } from "lucide-react";

import { updateProviderOpenStatusAction } from "@/app/provider/dashboard/actions";
import { AUTO_CLOSE_MISS_THRESHOLD } from "@/lib/sla";

type StoreOpenStatusPanelProps = {
  isOpen: boolean;
  consecutiveMissedOrders: number;
  closedAt: string | null;
};

/**
 * Open/Closed toggle panel on the provider dashboard.
 *
 * - When OPEN: shows a quiet leaf-coloured strip with a "Close" button.
 *   The miss counter is shown when non-zero ("1 miss away from auto-
 *   closing") as an early-warning nudge.
 * - When CLOSED: shows a louder sunset banner with the reason (auto vs
 *   manual) + a "Reopen" CTA. Opening also resets the miss counter,
 *   which the action handles atomically.
 */
export function StoreOpenStatusPanel({
  isOpen,
  consecutiveMissedOrders,
  closedAt
}: StoreOpenStatusPanelProps) {
  const wasAutoClosed =
    !isOpen && consecutiveMissedOrders >= AUTO_CLOSE_MISS_THRESHOLD;

  if (isOpen) {
    const remainingBeforeClose = Math.max(
      0,
      AUTO_CLOSE_MISS_THRESHOLD - consecutiveMissedOrders
    );
    const showMissWarning =
      consecutiveMissedOrders > 0 && remainingBeforeClose > 0;

    return (
      <form
        action={updateProviderOpenStatusAction}
        className="flex flex-col gap-3 rounded-lg border border-leaf/20 bg-mint p-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid="provider-store-open-panel"
      >
        <input name="is_open" type="hidden" value="false" />
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf text-white">
            <Store aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-body-sm font-semibold text-leaf">
              Your store is open
            </p>
            <p className="mt-0.5 text-caption text-leaf/80">
              Buyers can place new orders and your listings show the OPEN
              badge across the marketplace.
            </p>
            {showMissWarning ? (
              <p
                className="mt-2 text-caption font-semibold text-sunset"
                data-testid="provider-store-miss-warning"
              >
                {consecutiveMissedOrders === 1
                  ? "1 missed order — 2 more and the store auto-closes."
                  : `${consecutiveMissedOrders} missed orders — ${remainingBeforeClose} more and the store auto-closes.`}
              </p>
            ) : null}
          </div>
        </div>
        <button
          className="btn-secondary self-start sm:self-center"
          data-testid="provider-store-close-button"
          type="submit"
        >
          Close store
        </button>
      </form>
    );
  }

  return (
    <form
      action={updateProviderOpenStatusAction}
      className="flex flex-col gap-3 rounded-2xl border-2 border-sunset/40 bg-sunset/10 p-4 sm:flex-row sm:items-center sm:justify-between"
      data-testid="provider-store-closed-panel"
    >
      <input name="is_open" type="hidden" value="true" />
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sunset/20 text-sunset">
          <ZapOff aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-h3 font-semibold text-sunset">
            Your store is closed
          </p>
          <p className="mt-1 text-body-sm text-sunset/85">
            {wasAutoClosed
              ? `Auto-closed after ${AUTO_CLOSE_MISS_THRESHOLD} missed orders. Reopen below to start accepting again — your miss counter resets to zero.`
              : "Buyers can still browse your listings but can't place new orders until you reopen."}
          </p>
          {closedAt ? (
            <p className="mt-1 text-caption text-sunset/70">
              Closed{" "}
              {new Date(closedAt).toLocaleString("en-ZA", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
              })}
            </p>
          ) : null}
        </div>
      </div>
      <button
        className="btn-primary self-start sm:self-center"
        data-testid="provider-store-open-button"
        type="submit"
      >
        Reopen store
      </button>
    </form>
  );
}
